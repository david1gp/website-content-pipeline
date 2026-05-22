import type { Frontmatter } from "./FrontmatterSchema.js"
import { stringValue } from "./stringValue.js"
import { titleFromSlug } from "./titleFromSlug.js"
import type { ContentFilenameParts } from "./types.js"

export function normalizeFrontmatter(data: Record<string, unknown>, parsedFilename: ContentFilenameParts): Frontmatter {
  const slug = stringValue(data.slug) ?? parsedFilename.slug
  const title = stringValue(data.title) ?? titleFromSlug(slug)
  const description = stringValue(data.description) ?? stringValue(data.excerpt) ?? `Artikel über ${slug.replace(/-/g, " ")}`

  return {
    title,
    description,
    publishedAt: stringValue(data.publishedAt) ?? parsedFilename.date,
    updatedAt: stringValue(data.updatedAt),
    author: stringValue(data.author),
    slug,
    image: stringValue(data.image),
    imageAlt: stringValue(data.imageAlt) ?? stringValue(data.alt),
  }
}
