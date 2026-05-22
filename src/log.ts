import type { LogLevel } from "./types.js"

export function log(configuredLevel: LogLevel, messageLevel: LogLevel, prefix: string, message: string): void {
  if (messageLevel <= configuredLevel) console.log(`[${prefix}] ${message}`)
}
