import type { Frontmatter } from "./FrontmatterSchema.js"

export function createImagePrompt(frontmatter: Frontmatter): string {
  return `Create a featured image for article: ${frontmatter.title}. ${frontmatter.description}`
}
