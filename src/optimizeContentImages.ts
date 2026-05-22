import { assetsOptimize } from "@adaptive-ds/assets-optimizer"
import { log } from "./log.js"
import type { LogLevel } from "./types.js"

export async function optimizeContentImages(options: {
  imageOriginalsDir: string
  imageOptimizedDir: string
  logLevel: LogLevel
}): Promise<void> {
  log(options.logLevel, 2, "contentProcess", "Optimizing content images...")
  await assetsOptimize({
    logLevel: options.logLevel,
    imageOriginalsDir: options.imageOriginalsDir,
    imageOptimizedDir: options.imageOptimizedDir,
    generateImageList: false,
    processVideos: false,
    processFonts: false,
  })
  log(options.logLevel, 2, "contentProcess", "Image optimization complete.")
}
