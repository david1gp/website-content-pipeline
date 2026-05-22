import { existsSync, readdirSync } from "node:fs"
import { findSourceImage } from "./findSourceImage.js"
import { log } from "./log.js"
import type { ContentEntry, LogLevel } from "./types.js"

export function assignOptimizedImagePaths(options: {
  entries: ContentEntry[]
  imageOriginalsDir: string
  imageOptimizedDir: string
  logLevel: LogLevel
}): void {
  if (!existsSync(options.imageOptimizedDir)) return

  const optimizedFiles = readdirSync(options.imageOptimizedDir)
  for (const entry of options.entries) {
    if (!entry.image) continue
    const sourceImage = findSourceImage(options.imageOriginalsDir, entry.image)
    if (!sourceImage) {
      log(options.logLevel, 0, "contentProcess", `No source image available: ${entry.image}`)
      continue
    }
    const basePattern = entry.image.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const pattern = new RegExp(`^${basePattern}_[a-f0-9]+\\.(webp|jpg|png)$`)
    const matchFile = optimizedFiles.find((file) => pattern.test(file))
    if (matchFile) entry.imagePath = `/images/${matchFile}`
    else log(options.logLevel, 0, "contentProcess", `No optimized file found for: ${entry.image}`)
  }
}
