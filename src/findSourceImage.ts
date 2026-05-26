import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"

const SOURCE_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif", ".tiff", ".svg"])

export function findSourceImage(imageOriginalsDir: string, imageKey: string): string | null {
  if (!existsSync(imageOriginalsDir)) return null

  const dirs = readdirSync(imageOriginalsDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name)

  for (const dir of dirs) {
    const fullDir = join(imageOriginalsDir, dir)
    const files = readdirSync(fullDir)
    const match = files.find((file) => {
      if (!SOURCE_IMAGE_EXTENSIONS.has(file.slice(file.lastIndexOf(".")).toLowerCase())) return false
      const fileBasename = file.replace(/\.[^.]+$/, "")
      return fileBasename === imageKey || file.startsWith(`${imageKey}.`)
    })
    if (match) return join(fullDir, match)
  }

  return null
}
