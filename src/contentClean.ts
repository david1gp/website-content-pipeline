import { readdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import matter from "gray-matter"
import { cleanFrontmatter } from "./cleanFrontmatter.js"
import { ensureDir } from "./ensureDir.js"
import { log } from "./log.js"
import { normalizeContentProcessOptions } from "./normalizeContentProcessOptions.js"
import { normalizeFrontmatter } from "./normalizeFrontmatter.js"
import { parseContentFilename } from "./parseContentFilename.js"
import type { ContentCleanResult, ContentProcessOptions } from "./types.js"

/**
 * Canonicalize ("clean") the frontmatter of every source `.md` in the content dir.
 *
 * This is the explicit, opt-in counterpart to {@link contentProcess}: where
 * `contentProcess` never mutates the source files, `contentClean` deliberately
 * rewrites them into a canonical shape (normalized + derived defaults, fixed key
 * order via `matter.stringify`).
 *
 * It is pure-local on purpose — no bisync, no remote sync. The crux is the
 * `normalized !== raw` guard: re-running over already-clean content writes
 * nothing, so it never churns mtimes and is safe to run repeatedly.
 */
export function contentClean(options: ContentProcessOptions): ContentCleanResult {
  const config = normalizeContentProcessOptions(options)

  log(config.logLevel, 3, "contentClean", `Content dir: ${config.contentDir}`)
  ensureDir(config.contentDir)

  const contentFiles = readdirSync(config.contentDir)
    .filter((file) => file.endsWith(".md"))
    .sort()

  const changed: string[] = []
  let unchanged = 0

  for (const file of contentFiles) {
    const filePath = join(config.contentDir, file)
    const raw = readFileSync(filePath, "utf-8")
    const parsed = matter(raw)
    const parsedFilename = parseContentFilename(file)

    if (!parsedFilename) {
      log(config.logLevel, 0, "contentClean", `Skipping file with unexpected naming pattern: ${file}`)
      continue
    }

    const frontmatter = normalizeFrontmatter(parsed.data, parsedFilename)
    const normalizedFrontmatter = cleanFrontmatter({
      title: frontmatter.title,
      description: frontmatter.description,
      publishedAt: frontmatter.publishedAt,
      updatedAt: frontmatter.updatedAt,
      author: frontmatter.author,
      slug: frontmatter.slug,
      image: frontmatter.image,
      imageAlt: frontmatter.imageAlt,
    })

    const normalized = matter.stringify(parsed.content || "", normalizedFrontmatter)

    if (normalized !== raw) {
      writeFileSync(filePath, normalized, "utf-8")
      changed.push(file)
      log(config.logLevel, 2, "contentClean", `Cleaned: ${file}`)
    } else {
      unchanged += 1
    }
  }

  log(
    config.logLevel,
    1,
    "contentClean",
    `Clean complete. scanned=${contentFiles.length}, changed=${changed.length}, unchanged=${unchanged}`,
  )

  return { scanned: contentFiles.length, changed, unchanged }
}
