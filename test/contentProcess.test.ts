import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { beforeEach, describe, expect, test } from "bun:test"
import { contentProcess } from "../src/contentProcess.js"

const FILE = "2026-05-20-photovoltaik-grevenbroich.md"
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
  root = mkdtempSync(join(tmpdir(), "content-process-"))
  contentDir = join(root, "content")
  mkdirSync(contentDir, { recursive: true })
})

function baseOptions() {
  return {
    contentDir,
    contentSection: "ratgeber",
    // intersolaris case: served dir IS the source dir → nothing to copy
    publicBlogDir: contentDir,
    publicContentDir: contentDir,
    imagePromptsDir: join(root, "image-prompts"),
    contentListOutputPath: join(root, "contentList.ts"),
    imageOriginalsDir: join(root, "images"),
    imageOptimizedDir: join(root, "public", "images"),
    logLevel: 0 as const,
    optimizeImages: false,
    generateMissingImages: false,
    generateImagePrompts: false,
    runCodexImageGeneration: false,
  }
}

describe("contentProcess (read-only source)", () => {
  test("does not mutate the source .md and still emits contentList.ts", async () => {
    const filePath = join(contentDir, FILE)
    writeFileSync(filePath, MESSY, "utf-8")

    const past = new Date("2020-01-01T00:00:00Z")
    utimesSync(filePath, past, past)
    const beforeMtime = statSync(filePath).mtimeMs
    const beforeContent = readFileSync(filePath, "utf-8")

    const result = await contentProcess(baseOptions(), [])

    // source untouched: byte-identical and mtime-stable
    expect(readFileSync(filePath, "utf-8")).toBe(beforeContent)
    expect(statSync(filePath).mtimeMs).toBe(beforeMtime)

    // still a correct producer of the content list
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0]?.slug).toBe("photovoltaik-grevenbroich")
    const generated = readFileSync(join(root, "contentList.ts"), "utf-8")
    expect(generated).toContain("photovoltaik-grevenbroich")
  })

  test("running twice leaves all source mtimes unchanged (bisync regression)", async () => {
    const filePath = join(contentDir, FILE)
    writeFileSync(filePath, MESSY, "utf-8")

    await contentProcess(baseOptions(), [])

    const past = new Date("2020-01-01T00:00:00Z")
    utimesSync(filePath, past, past)
    const mtimes = Object.fromEntries(
      readdirSync(contentDir).map((f) => [f, statSync(join(contentDir, f)).mtimeMs]),
    )

    await contentProcess(baseOptions(), [])

    for (const [f, mtime] of Object.entries(mtimes)) {
      expect(statSync(join(contentDir, f)).mtimeMs).toBe(mtime)
    }
  })
})
