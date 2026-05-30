import { isAbsolute, join, resolve } from "node:path"
import { DEFAULT_IMAGE_PROMPT_TEMPLATE_PREFIX } from "./createImagePrompt.js"
import {
  DEFAULT_CONTENT_CACHE_CONTROL,
  DEFAULT_CONTENT_IMAGE_GENERATION_SIZE,
  DEFAULT_CONTENT_LIST_GENERATED_BY,
} from "./defaults.js"
import { getBuildDate } from "./getBuildDate.js"
import { normalizePublicPathBase } from "./normalizePublicPathBase.js"
import type { ContentProcessOptions, NormalizedContentProcessOptions } from "./types.js"

function resolveFromCwd(cwd: string, path: string): string {
  return isAbsolute(path) ? path : resolve(cwd, path)
}

export function normalizeContentProcessOptions(options: ContentProcessOptions): NormalizedContentProcessOptions {
  const cwd = resolve(options.cwd ?? process.cwd())
  const contentSection = (options.contentSection ?? options.publicPathBase ?? "blog").replace(/^\/+|\/+$/g, "")
  const publicPathBase = normalizePublicPathBase(options.publicPathBase ?? `/${contentSection}`)
  const publicBlogDir = options.publicBlogDir ?? join("./public", contentSection)
  const publicContentPathBase = normalizePublicPathBase(options.publicContentPathBase ?? publicPathBase)

  return {
    contentDir: resolveFromCwd(cwd, options.contentDir),
    contentSection,
    publicBlogDir: resolveFromCwd(cwd, publicBlogDir),
    publicContentDir: resolveFromCwd(cwd, options.publicContentDir ?? publicBlogDir),
    publicPathBase,
    publicContentPathBase,
    imagePromptsDir: resolveFromCwd(cwd, options.imagePromptsDir),
    contentListOutputPath: resolveFromCwd(cwd, options.contentListOutputPath),
    imageOriginalsDir: resolveFromCwd(cwd, options.imageOriginalsDir),
    imageOptimizedDir: resolveFromCwd(cwd, options.imageOptimizedDir),
    sourceRemote: options.sourceRemote,
    destinationRemote: options.destinationRemote,
    cacheControl: options.cacheControl ?? DEFAULT_CONTENT_CACHE_CONTROL,
    cwd,
    buildDate: options.buildDate ?? getBuildDate(),
    logLevel: options.logLevel ?? 3,
    optimizeImages: options.optimizeImages ?? true,
    generateMissingImages: options.generateMissingImages ?? true,
    generateImagePrompts: options.generateImagePrompts ?? true,
    runCodexImageGeneration: options.runCodexImageGeneration ?? true,
    codexLbUrl: options.codexLbUrl ?? process.env.CODEX_LB_URL ?? "",
    imageGenerationSize:
      options.imageGenerationSize ?? process.env.CONTENT_IMAGE_GENERATION_SIZE ?? DEFAULT_CONTENT_IMAGE_GENERATION_SIZE,
    imagePromptTemplatePrefix: options.imagePromptTemplatePrefix ?? DEFAULT_IMAGE_PROMPT_TEMPLATE_PREFIX,
    contentListGeneratedBy: options.contentListGeneratedBy ?? DEFAULT_CONTENT_LIST_GENERATED_BY,
  }
}
