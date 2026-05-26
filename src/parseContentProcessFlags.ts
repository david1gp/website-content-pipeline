import type { ContentProcessFlags } from "./types.js"

function numericArg(argv: string[], names: string[]): number | null {
  for (const name of names) {
    const equalsPrefix = `--${name}=`
    const equalsValue = argv.find((arg) => arg.startsWith(equalsPrefix))?.slice(equalsPrefix.length)
    const flagIndex = argv.findIndex((arg) => arg === `--${name}`)
    const value = equalsValue ?? (flagIndex >= 0 ? argv[flagIndex + 1] : null)
    if (!value || value.startsWith("--")) continue

    const parsed = Number.parseInt(value, 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  }

  return null
}

export function parseContentProcessFlags(argv: string[]): ContentProcessFlags {
  return {
    sync: argv.includes("--sync") || argv.includes("--resync"),
    resync: argv.includes("--resync"),
    strict: argv.includes("--strict"),
    articleIndex: numericArg(argv, ["index", "number"]),
  }
}
