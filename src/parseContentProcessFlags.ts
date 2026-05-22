import type { ContentProcessFlags } from "./types.js"

export function parseContentProcessFlags(argv: string[]): ContentProcessFlags {
  return {
    sync: argv.includes("--sync") || argv.includes("--resync"),
    resync: argv.includes("--resync"),
    strict: argv.includes("--strict"),
  }
}
