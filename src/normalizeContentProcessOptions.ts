import { join } from "node:path"
import {
  DEFAULT_CONTENT_CACHE_CONTROL,
  DEFAULT_CONTENT_LIST_GENERATED_BY,
} from "./defaults.js"
import { getBuildDate } from "./getBuildDate.js"
import { normalizePublicPathBase } from "./normalizePublicPathBase.js"
import type { ContentProcessOptions, NormalizedContentProcessOptions } from "./types.js"

export function normalizeContentProcessOptions(options: ContentProcessOptions): NormalizedContentProcessOptions {
  const publicPathBase = normalizePublicPathBase(options.publicPathBase)
  const publicContentPathBase = normalizePublicPathBase(options.publicContentPathBase ?? `${publicPathBase}/content`)

  return {
    contentDir: options.contentDir,
    publicBlogDir: options.publicBlogDir,
    publicContentDir: options.publicContentDir ?? join(options.publicBlogDir, "content"),
    publicPathBase,
    publicContentPathBase,
    imagePromptsDir: options.imagePromptsDir,
    contentListOutputPath: options.contentListOutputPath,
    imageOriginalsDir: options.imageOriginalsDir,
    imageOptimizedDir: options.imageOptimizedDir,
    sourceRemote: options.sourceRemote,
    destinationRemote: options.destinationRemote,
    cacheControl: options.cacheControl ?? DEFAULT_CONTENT_CACHE_CONTROL,
    cwd: options.cwd ?? process.cwd(),
    buildDate: options.buildDate ?? getBuildDate(),
    logLevel: options.logLevel ?? 3,
    optimizeImages: options.optimizeImages ?? true,
    generateMissingImages: options.generateMissingImages ?? true,
    generateImagePrompts: options.generateImagePrompts ?? true,
    runCodexImageGeneration: options.runCodexImageGeneration ?? true,
    contentListGeneratedBy: options.contentListGeneratedBy ?? DEFAULT_CONTENT_LIST_GENERATED_BY,
  }
}
