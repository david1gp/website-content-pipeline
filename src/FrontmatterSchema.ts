import { object, optional, string, type InferOutput } from "valibot"

export const FrontmatterSchema = object({
  title: string(),
  description: string(),
  publishedAt: string(),
  updatedAt: optional(string()),
  author: optional(string()),
  slug: string(),
  image: optional(string()),
  imageAlt: optional(string()),
})

export type Frontmatter = InferOutput<typeof FrontmatterSchema>
