import { cpSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { bisync, runRclone } from "@adaptive-ds/assets-optimizer"
import matter from "gray-matter"
import { marked } from "marked"
import { parse } from "valibot"
import { assignOptimizedImagePaths } from "./assignOptimizedImagePaths.js"
import { cleanFrontmatter } from "./cleanFrontmatter.js"
import { createImagePrompt } from "./createImagePrompt.js"
import { DEFAULT_CONTENT_IMAGE_TRANSFORM_DIR } from "./defaults.js"
import { ensureDir } from "./ensureDir.js"
import { findSourceImage } from "./findSourceImage.js"
import { FrontmatterSchema } from "./FrontmatterSchema.js"
import { generateContentListCode } from "./generateContentListCode.js"
import { generateMissingImage } from "./generateMissingImage.js"
import { log } from "./log.js"
import { normalizeContentProcessOptions } from "./normalizeContentProcessOptions.js"
import { normalizeFrontmatter } from "./normalizeFrontmatter.js"
import { optimizeContentImages } from "./optimizeContentImages.js"
import { parseContentFilename } from "./parseContentFilename.js"
import { parseContentProcessFlags } from "./parseContentProcessFlags.js"
import type { ContentEntry, ContentProcessOptions, ContentProcessResult, MissingImage } from "./types.js"

export async function contentProcess(
  options: ContentProcessOptions,
  argv: string[] = process.argv,
): Promise<ContentProcessResult> {
  const config = normalizeContentProcessOptions(options)
  const flags = parseContentProcessFlags(argv)

  log(config.logLevel, 3, "contentProcess", `Build date: ${config.buildDate}`)
  log(config.logLevel, 3, "contentProcess", `Content dir: ${config.contentDir}`)

  ensureDir(config.contentDir)
  ensureDir(config.publicContentDir)
  ensureDir(config.imagePromptsDir)
  ensureDir(config.imageOptimizedDir)

  if (flags.sync && config.sourceRemote) {
    log(config.logLevel, 2, "contentProcess", `Syncing content from remote: ${config.sourceRemote}`)
    try {
      await bisync(config.contentDir, config.sourceRemote, { cwd: config.cwd, resync: flags.resync })
      log(config.logLevel, 2, "contentProcess", "Sync completed.")
    } catch (syncErr) {
      log(config.logLevel, 0, "contentProcess", `Sync failed: ${syncErr}. Continuing without sync.`)
      if (flags.strict) process.exit(1)
    }
  }

  const contentFiles = readdirSync(config.contentDir)
    .filter((file) => file.endsWith(".md"))
    .sort()

  if (contentFiles.length === 0) {
    log(config.logLevel, 1, "contentProcess", "No .md files found in content/. Skipping.")
    return { buildDate: config.buildDate, entries: [], missingImages: [] }
  }

  log(config.logLevel, 3, "contentProcess", `Found ${contentFiles.length} content file(s)`)

  const entries: ContentEntry[] = []
  const missingImages: MissingImage[] = []

  for (const file of contentFiles) {
    const filePath = join(config.contentDir, file)
    const raw = readFileSync(filePath, "utf-8")
    const parsed = matter(raw)
    const parsedFilename = parseContentFilename(file)

    if (!parsedFilename) {
      log(config.logLevel, 0, "contentProcess", `Skipping file with unexpected naming pattern: ${file}`)
      continue
    }

    const frontmatter = normalizeFrontmatter(parsed.data, parsedFilename)

    try {
      parse(FrontmatterSchema, frontmatter)
    } catch (err) {
      const ve = err instanceof Error ? err : new Error(String(err))
      log(config.logLevel, 0, "contentProcess", `Frontmatter validation failed for ${file}: ${ve.message}`)
      if (flags.strict) process.exit(1)
      continue
    }

    const imageKey = frontmatter.image ?? parsedFilename.id
    const hasSourceImage = findSourceImage(config.imageOriginalsDir, imageKey)
    log(
      config.logLevel,
      3,
      "contentProcess",
      `Image check for ${parsedFilename.id}: imageKey=${imageKey}, hasSourceImage=${hasSourceImage !== null}`,
    )

    if (config.generateMissingImages && !hasSourceImage) {
      const targetPath = join(config.imageOriginalsDir, DEFAULT_CONTENT_IMAGE_TRANSFORM_DIR, `${imageKey}.jpg`)
      log(config.logLevel, 2, "contentProcess", `Adding missing image: ${imageKey}`)
      missingImages.push({ imageKey, prompt: createImagePrompt(frontmatter), targetPath })
    }

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
    writeFileSync(filePath, normalized, "utf-8")
    cpSync(filePath, join(config.publicContentDir, file))

    entries.push({
      id: parsedFilename.id,
      slug: frontmatter.slug,
      path: `${config.publicPathBase}/${frontmatter.slug}`,
      contentPath: `${config.publicContentPathBase}/${file}`,
      image: imageKey,
      imagePath: null,
      title: frontmatter.title,
      description: frontmatter.description,
      publishedAt: frontmatter.publishedAt,
      updatedAt: frontmatter.updatedAt ?? null,
      author: frontmatter.author ?? null,
      imageAlt: frontmatter.imageAlt ?? null,
      body: parsed.content || "",
      html: marked(parsed.content || "") as string,
      isPublishedAtBuild: frontmatter.publishedAt < config.buildDate,
    })

    log(
      config.logLevel,
      3,
      "contentProcess",
      `Processed: ${file} (published: ${frontmatter.publishedAt}, build: ${config.buildDate}, isPublished: ${frontmatter.publishedAt < config.buildDate})`,
    )
  }

  for (const missingImage of missingImages) {
    await generateMissingImage(missingImage, {
      cwd: config.cwd,
      imagePromptsDir: config.imagePromptsDir,
      logLevel: config.logLevel,
      generateImagePrompts: config.generateImagePrompts,
      runCodexImageGeneration: config.runCodexImageGeneration,
    })
  }

  if (config.optimizeImages) {
    try {
      await optimizeContentImages({
        imageOriginalsDir: config.imageOriginalsDir,
        imageOptimizedDir: config.imageOptimizedDir,
        logLevel: config.logLevel,
      })
    } catch (err) {
      log(config.logLevel, 0, "contentProcess", `assetsOptimize failed: ${err}. Continuing.`)
      if (flags.strict) process.exit(1)
    }
  }

  assignOptimizedImagePaths({
    entries,
    imageOriginalsDir: config.imageOriginalsDir,
    imageOptimizedDir: config.imageOptimizedDir,
    logLevel: config.logLevel,
  })

  const contentListCode = generateContentListCode({
    entries,
    buildDate: config.buildDate,
    generatedBy: config.contentListGeneratedBy,
  })

  ensureDir(dirname(config.contentListOutputPath))
  writeFileSync(config.contentListOutputPath, contentListCode, "utf-8")
  log(config.logLevel, 2, "contentProcess", `Generated ${config.contentListOutputPath} with ${entries.length} entries`)

  if (flags.sync && config.destinationRemote) {
    log(config.logLevel, 2, "contentProcess", `Syncing public content to remote: ${config.destinationRemote}`)
    try {
      await runRclone(["sync", config.publicBlogDir, config.destinationRemote, "--header-upload", config.cacheControl], config.cwd)
      log(config.logLevel, 2, "contentProcess", "Public content sync completed.")
    } catch (syncErr) {
      log(config.logLevel, 0, "contentProcess", `Public content sync failed: ${syncErr}. Continuing.`)
      if (flags.strict) process.exit(1)
    }
  }

  log(config.logLevel, 1, "contentProcess", "Content processing complete.")
  return { buildDate: config.buildDate, entries, missingImages }
}
