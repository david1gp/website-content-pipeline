export type LogLevel = 0 | 1 | 2 | 3

export type ContentEntry = {
  id: string
  slug: string
  path: string
  contentPath: string
  image: string | null
  imagePath: string | null
  title: string
  description: string
  publishedAt: string
  updatedAt: string | null
  author: string | null
  imageAlt: string | null
}

export type ContentFilenameParts = {
  date: string
  slug: string
  id: string
}

export type ContentProcessFlags = {
  sync: boolean
  resync: boolean
  strict: boolean
  articleIndex: number | null
}

export type MissingImage = {
  imageKey: string
  prompt: string
  targetPath: string
}

export type ContentProcessOptions = {
  contentDir: string
  contentSection?: string
  publicBlogDir?: string
  publicContentDir?: string
  publicPathBase?: string
  publicContentPathBase?: string
  imagePromptsDir: string
  contentListOutputPath: string
  imageOriginalsDir: string
  imageOptimizedDir: string
  sourceRemote?: string
  destinationRemote?: string
  cacheControl?: string
  cwd?: string
  buildDate?: string
  logLevel?: LogLevel
  optimizeImages?: boolean
  generateMissingImages?: boolean
  generateImagePrompts?: boolean
  runCodexImageGeneration?: boolean
  codexLbUrl?: string
  imageGenerationSize?: string
  imagePromptTemplatePrefix?: string
  contentListGeneratedBy?: string
}

export type NormalizedContentProcessOptions = Required<
  Pick<
    ContentProcessOptions,
    | "contentDir"
    | "contentSection"
    | "publicBlogDir"
    | "publicContentDir"
    | "publicPathBase"
    | "publicContentPathBase"
    | "imagePromptsDir"
    | "contentListOutputPath"
    | "imageOriginalsDir"
    | "imageOptimizedDir"
    | "cacheControl"
    | "cwd"
    | "buildDate"
    | "logLevel"
    | "optimizeImages"
    | "generateMissingImages"
    | "generateImagePrompts"
    | "runCodexImageGeneration"
    | "codexLbUrl"
    | "imageGenerationSize"
    | "imagePromptTemplatePrefix"
    | "contentListGeneratedBy"
  >
> &
  Pick<ContentProcessOptions, "sourceRemote" | "destinationRemote">

export type ContentProcessResult = {
  buildDate: string
  entries: ContentEntry[]
  missingImages: MissingImage[]
}

export type ContentCleanResult = {
  scanned: number
  changed: string[]
  unchanged: number
}
