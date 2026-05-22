import { CONTENT_FILENAME_PATTERN } from "./defaults.js"
import type { ContentFilenameParts } from "./types.js"

export function parseContentFilename(filename: string): ContentFilenameParts | null {
  const match = filename.match(CONTENT_FILENAME_PATTERN)
  if (!match || !match[1] || !match[2]) return null
  const id = filename.replace(/\.md$/, "")
  return { date: match[1], slug: match[2], id }
}
