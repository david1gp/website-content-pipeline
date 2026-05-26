import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { spawn } from "node:child_process"
import { DEFAULT_CONTENT_IMAGE_GENERATION_SIZE } from "./defaults.js"
import { ensureDir } from "./ensureDir.js"
import { log } from "./log.js"
import type { LogLevel, MissingImage } from "./types.js"

const DEFAULT_CODEX_LB_MODEL = "gpt-image-2" as const
const DEFAULT_CODEX_LB_KEY_FILE = `${process.env.HOME ?? ""}/.config/opencode/codex-lb-api-key`
const IMAGE_GENERATION_ATTEMPTS = 3
const IMAGE_GENERATION_TIMEOUT_MS = 5 * 60 * 1000

function isValidImage(path: string): boolean {
  if (!existsSync(path)) return false

  const header = readFileSync(path).subarray(0, 12)
  const asText = header.toString("latin1")
  return (
    asText.startsWith("\xFF\xD8\xFF") ||
    asText.startsWith("\x89PNG\r\n\x1A\n") ||
    asText.startsWith("RIFF") ||
    asText.startsWith("GIF87a") ||
    asText.startsWith("GIF89a") ||
    asText.startsWith("<svg")
  )
}

function getCodexLbApiToken(): string | null {
  if (process.env.CODEX_LB_API_TOKEN) return process.env.CODEX_LB_API_TOKEN
  if (!DEFAULT_CODEX_LB_KEY_FILE || !existsSync(DEFAULT_CODEX_LB_KEY_FILE)) return null

  const token = readFileSync(DEFAULT_CODEX_LB_KEY_FILE, "utf-8").trim()
  return token || null
}

async function generateViaCodexLb(options: {
  codexLbUrl: string
  prompt: string
  targetPathAbsolute: string
  logLevel: LogLevel
  imageKey: string
  imageGenerationSize: string
}): Promise<boolean> {
  const apiToken = getCodexLbApiToken()
  if (!apiToken) {
    log(options.logLevel, 0, "contentProcess", "CODEX_LB_API_TOKEN is not set and no codex-lb key file was found.")
    return false
  }

  const baseUrl = options.codexLbUrl.replace(/\/+$/, "")
  const response = await fetch(`${baseUrl}/images/generations`, {
    method: "POST",
    signal: AbortSignal.timeout(IMAGE_GENERATION_TIMEOUT_MS),
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: DEFAULT_CODEX_LB_MODEL,
      prompt: options.prompt,
      n: 1,
      size: options.imageGenerationSize,
    }),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    log(options.logLevel, 0, "contentProcess", `codexLb image generation failed for ${options.imageKey}: HTTP ${response.status} ${body}`)
    return false
  }

  const payload = (await response.json()) as { data?: Array<{ b64_json?: string }> }
  const b64 = payload.data?.[0]?.b64_json
  if (!b64) {
    log(options.logLevel, 0, "contentProcess", `codexLb image generation returned no b64_json for ${options.imageKey}.`)
    return false
  }

  writeFileSync(options.targetPathAbsolute, Buffer.from(b64, "base64"))
  if (!isValidImage(options.targetPathAbsolute)) {
    log(options.logLevel, 0, "contentProcess", `codexLb wrote an invalid image for ${options.imageKey}: ${options.targetPathAbsolute}`)
    return false
  }

  log(options.logLevel, 2, "contentProcess", `codexLb created: ${options.targetPathAbsolute}`)
  return true
}

async function generateViaCodex(options: {
  prompt: string
  targetDir: string
  targetPathAbsolute: string
  logLevel: LogLevel
  imageKey: string
  imageGenerationSize: string
}): Promise<boolean> {
  log(options.logLevel, 2, "contentProcess", `Attempting Codex image generation for: ${options.imageKey}`)
  const codexPrompt = `$imagegen

Generate exactly one image with these requirements:

PROMPT:
Generate image: ${options.prompt}

REQUIREMENTS:
- Model: gpt-image-2
- Size: ${options.imageGenerationSize}
- Save the generated image to this absolute path: ${options.targetPathAbsolute}
- Do not modify any other files in the workspace.
- After saving, print this exact line: SAVED: ${options.targetPathAbsolute}
- End the session immediately. Do not propose follow-up work.

CRITICAL REQUIREMENTS:
- Create ONLY the target file: ${options.targetPathAbsolute}
- Do NOT edit, create, or modify any other files
- Do NOT write any documentation, code, or text files
- The image must be a valid JPEG or PNG image suitable for a 2:1 website hero crop
- Only create the file if you can generate a real, non-placeholder image; otherwise do nothing
- Do NOT create simple circles, dark gradient placeholders, diagrams, text cards, or abstract backgrounds

Target path: ${options.targetPathAbsolute}`

  const proc = spawn(
    "codex",
    [
      "exec",
      "--skip-git-repo-check",
      "--sandbox",
      "workspace-write",
      "--cd",
      options.targetDir,
      "--add-dir",
      options.targetDir,
      codexPrompt,
    ],
    { stdio: ["ignore", "pipe", "pipe"], timeout: IMAGE_GENERATION_TIMEOUT_MS },
  )

  let stderr = ""
  let stdout = ""
  proc.stdout?.on("data", (chunk) => {
    stdout += String(chunk)
  })
  proc.stderr?.on("data", (chunk) => {
    stderr += String(chunk)
  })

  const exited = await new Promise<number | null>((resolve) => {
    const timeout = setTimeout(() => {
      proc.kill()
      resolve(null)
    }, IMAGE_GENERATION_TIMEOUT_MS)

    proc.on("close", (code) => {
      clearTimeout(timeout)
      resolve(code)
    })
  })

  if (exited === 0 && isValidImage(options.targetPathAbsolute)) {
    log(options.logLevel, 2, "contentProcess", `Codex created: ${options.targetPathAbsolute}`)
    return true
  }

  const output = [stdout.trim(), stderr.trim()].filter(Boolean).join(" ")
  const details = output ? ` output: ${output}` : ""
  log(
    options.logLevel,
    0,
    "contentProcess",
    `Codex did not create a valid target image (code: ${exited}). No placeholder fallback created.${details}`,
  )
  return false
}

export async function generateMissingImage(
  missingImage: MissingImage,
  options: {
    cwd: string
    imagePromptsDir: string
    logLevel: LogLevel
    generateImagePrompts: boolean
    runCodexImageGeneration: boolean
    codexLbUrl: string
    imageGenerationSize?: string
  },
): Promise<boolean> {
  const { imageKey, prompt, targetPath } = missingImage
  const targetPathAbsolute = resolve(options.cwd, targetPath)
  const targetDir = dirname(targetPathAbsolute)
  const promptText = prompt.trim()
  const imageGenerationSize = options.imageGenerationSize ?? DEFAULT_CONTENT_IMAGE_GENERATION_SIZE

  ensureDir(targetDir)

  if (isValidImage(targetPathAbsolute)) {
    log(options.logLevel, 3, "contentProcess", `Source image already exists: ${targetPathAbsolute}`)
    return true
  }

  if (options.generateImagePrompts) {
    ensureDir(options.imagePromptsDir)
    const promptFile = join(options.imagePromptsDir, `${imageKey}.md`)
    const promptContent = `# Image Generation Prompt: ${imageKey}\n\n${promptText}\n\nTarget file: ${targetPathAbsolute}\n`
    writeFileSync(promptFile, promptContent, "utf-8")
    log(options.logLevel, 2, "contentProcess", `Created image prompt: ${promptFile}`)
  }

  if (options.runCodexImageGeneration) {
    for (let attempt = 1; attempt <= IMAGE_GENERATION_ATTEMPTS; attempt++) {
      try {
        if (attempt > 1) {
          log(options.logLevel, 1, "contentProcess", `Retrying image generation for ${imageKey} (${attempt}/${IMAGE_GENERATION_ATTEMPTS})`)
        }

        if (options.codexLbUrl) {
          log(options.logLevel, 2, "contentProcess", `Attempting codexLb image generation for: ${imageKey}`)
          const codexLbSuccess = await generateViaCodexLb({
            codexLbUrl: options.codexLbUrl,
            prompt: promptText,
            targetPathAbsolute,
            logLevel: options.logLevel,
            imageKey,
            imageGenerationSize,
          })
          if (codexLbSuccess) return true

          log(options.logLevel, 2, "contentProcess", `Falling back to local Codex for: ${imageKey}`)
        }

        const codexSuccess = await generateViaCodex({
          prompt: promptText,
          targetDir,
          targetPathAbsolute,
          logLevel: options.logLevel,
          imageKey,
          imageGenerationSize,
        })
        if (codexSuccess) return true
      } catch (err) {
        log(options.logLevel, 0, "contentProcess", `Codex call failed: ${err}. No placeholder fallback created.`)
      }
    }

    log(options.logLevel, 0, "contentProcess", `Image generation failed after ${IMAGE_GENERATION_ATTEMPTS} attempts for: ${imageKey}`)
    return false
  } else {
    log(options.logLevel, 2, "contentProcess", `Codex image generation disabled. Prompt saved for: ${imageKey}`)
    return false
  }
}
