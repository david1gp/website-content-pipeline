import { describe, expect, test } from "bun:test"
import { parseContentFilename } from "../src/parseContentFilename.js"

describe("parseContentFilename", () => {
  test("parses scheduled markdown filenames", () => {
    expect(parseContentFilename("2026-05-20-photovoltaik-grevenbroich.md")).toEqual({
      date: "2026-05-20",
      slug: "photovoltaik-grevenbroich",
      id: "2026-05-20-photovoltaik-grevenbroich",
    })
  })

  test("rejects filenames without a date prefix", () => {
    expect(parseContentFilename("photovoltaik-grevenbroich.md")).toBeNull()
  })
})
