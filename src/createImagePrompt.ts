import type { Frontmatter } from "./FrontmatterSchema.js"

export const DEFAULT_IMAGE_PROMPT_TEMPLATE_PREFIX =
  "Generate image, resolution 1920x960, aspect ratio 2:1 for a website hero. Create a realistic, professional editorial image. No text, no logos, no watermarks, no diagrams, no abstract placeholder shapes."

export type CreateImagePromptOptions = {
  imagePromptTemplatePrefix?: string
}

export function createImagePrompt(
  frontmatter: Frontmatter,
  _content = "",
  options: CreateImagePromptOptions = {},
): string {
  const prefix = (options.imagePromptTemplatePrefix ?? DEFAULT_IMAGE_PROMPT_TEMPLATE_PREFIX).trim()

  return [prefix, `Article headline/title: "${frontmatter.title}".`].filter(Boolean).join("\n\n")
}
