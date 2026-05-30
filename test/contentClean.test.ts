import { mkdirSync, mkdtempSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { contentClean } from "../src/contentClean.js"

const FILE = "2026-05-20-photovoltaik-grevenbroich.md"
// A deliberately messy/partial source file: derived defaults missing, legacy `alt` key, blank line gaps.
const MESSY = `---
title: Photovoltaik in Grevenbroich
publishedAt: 2026-05-20
alt: Solaranlage auf einem Dach
---

Body text.
`

let root: string
let contentDir: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "content-clean-"))
  contentDir = join(root, "content")
  mkdirSync(contentDir, { recursive: true })
})

afterEach(() => {
  // best-effort cleanup; tmp dirs are reaped by the OS regardless
})

function baseOptions() {
  return {
    contentDir,
    contentSection: "ratgeber",
    imagePromptsDir: join(root, "image-prompts"),
    contentListOutputPath: join(root, "contentList.ts"),
    imageOriginalsDir: join(root, "images"),
    imageOptimizedDir: join(root, "public", "images"),
    logLevel: 0 as const,
  }
}

describe("contentClean", () => {
  test("rewrites messy/partial frontmatter into canonical form", () => {
    writeFileSync(join(contentDir, FILE), MESSY, "utf-8")

    const result = contentClean(baseOptions())

    expect(result.scanned).toBe(1)
    expect(result.changed).toEqual([FILE])
    expect(result.unchanged).toBe(0)

    const cleaned = readFileSync(join(contentDir, FILE), "utf-8")
    // legacy `alt` is migrated to `imageAlt`, derived defaults are filled in
    expect(cleaned).toContain("imageAlt: Solaranlage auf einem Dach")
    expect(cleaned).toContain("slug: photovoltaik-grevenbroich")
    expect(cleaned).toContain("description:")
    expect(cleaned).not.toMatch(/^alt:/m)
    expect(cleaned).toContain("Body text.")
  })

  test("is a no-op on already-canonical content (no write, mtime preserved)", () => {
    const filePath = join(contentDir, FILE)
    writeFileSync(filePath, MESSY, "utf-8")

    // first pass canonicalizes
    contentClean(baseOptions())

    // pin mtime to a known past instant
    const past = new Date("2020-01-01T00:00:00Z")
    utimesSync(filePath, past, past)
    const beforeMtime = statSync(filePath).mtimeMs
    const beforeContent = readFileSync(filePath, "utf-8")

    // second pass should change nothing
    const result = contentClean(baseOptions())

    expect(result.scanned).toBe(1)
    expect(result.changed).toEqual([])
    expect(result.unchanged).toBe(1)
    expect(statSync(filePath).mtimeMs).toBe(beforeMtime)
    expect(readFileSync(filePath, "utf-8")).toBe(beforeContent)
  })

  test("skips files with an unexpected naming pattern", () => {
    writeFileSync(join(contentDir, "no-date-prefix.md"), MESSY, "utf-8")
    const result = contentClean(baseOptions())
    expect(result.scanned).toBe(1)
    expect(result.changed).toEqual([])
  })
})
