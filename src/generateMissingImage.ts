import { existsSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { spawn } from "node:child_process"
import { execFileSync } from "node:child_process"
import { ensureDir } from "./ensureDir.js"
import { log } from "./log.js"
import type { LogLevel, MissingImage } from "./types.js"

export async function generateMissingImage(
  missingImage: MissingImage,
  options: {
    cwd: string
    imagePromptsDir: string
    logLevel: LogLevel
    generateImagePrompts: boolean
    runCodexImageGeneration: boolean
  },
): Promise<void> {
  const { imageKey, prompt, targetPath } = missingImage
  if (existsSync(targetPath)) {
    log(options.logLevel, 3, "contentProcess", `Source image already exists: ${targetPath}`)
    return
  }

  if (options.generateImagePrompts) {
    ensureDir(options.imagePromptsDir)
    const promptFile = join(options.imagePromptsDir, `${imageKey}.md`)
    const promptContent = `# Image Generation Prompt: ${imageKey}\n\n${prompt}\n\nTarget file: ${targetPath}\n`
    writeFileSync(promptFile, promptContent, "utf-8")
    log(options.logLevel, 2, "contentProcess", `Created image prompt: ${promptFile}`)
  }

  let codexSuccess = false
  if (options.runCodexImageGeneration) {
    try {
      log(options.logLevel, 2, "contentProcess", `Attempting Codex image generation for: ${imageKey}`)
      const codexPrompt = `You are an image generation tool. Your task: create the file "${targetPath}" containing a featured image for an article about: ${prompt}.

CRITICAL REQUIREMENTS:
- Create ONLY the target file: ${targetPath}
- Do NOT edit, create, or modify any other files
- Do NOT write any documentation, code, or text files
- The image must be a valid JPEG, 1920x1080 pixels
- Only create the file if you can generate a real image; otherwise do nothing

Target path: ${targetPath}
Image dimensions: 1920x1080
Format: JPEG`

      const proc = spawn(
        "codex",
        ["exec", "--cd", options.cwd, "--sandbox", "workspace-write", "--ask-for-approval", "never", codexPrompt],
        { timeout: 60000 },
      )

      const exited = await Promise.race([
        new Promise<number | null>((resolve) => proc.on("close", resolve)),
        new Promise<null>((resolve) =>
          setTimeout(() => {
            proc.kill()
            resolve(null)
          }, 55000),
        ),
      ])

      if (exited === 0 && existsSync(targetPath)) {
        log(options.logLevel, 2, "contentProcess", `Codex created: ${targetPath}`)
        codexSuccess = true
      } else {
        log(options.logLevel, 2, "contentProcess", `Codex did not create target file (code: ${exited}). Falling back to ImageMagick.`)
      }
    } catch {
      log(options.logLevel, 2, "contentProcess", "Codex call failed. Falling back to ImageMagick.")
    }
  }

  if (!codexSuccess && !existsSync(targetPath)) {
    try {
      ensureDir(dirname(targetPath))
      const seedHash = imageKey.split("").reduce((hash, char) => (Math.imul(31, hash) + char.charCodeAt(0)) | 0, 0)
      const hue = Math.abs(seedHash % 360)
      execFileSync(
        "magick",
        [
          "-size",
          "1920x1080",
          "gradient:#0a1628-#1a3a5c",
          "-fill",
          `hsl(${hue},60%,30%)`,
          "-draw",
          "circle 960,540 960,200",
          targetPath,
        ],
        { timeout: 30000 },
      )
      log(options.logLevel, 2, "contentProcess", `ImageMagick fallback created: ${targetPath}`)
    } catch (err) {
      log(options.logLevel, 0, "contentProcess", `ImageMagick fallback failed: ${err}`)
    }
  }
}
