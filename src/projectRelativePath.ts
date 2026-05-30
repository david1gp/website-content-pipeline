import { isAbsolute, relative, resolve } from "node:path"

// Render a path relative to the project root (cwd), POSIX-normalized and
// "./"-prefixed. Generated artifacts (contentList entries, image-prompt files)
// embed these so they stay machine-independent and don't churn in git when
// different contributors regenerate from different absolute checkout paths.
export function projectRelativePath(cwd: string, path: string): string {
  const absolutePath = isAbsolute(path) ? path : resolve(cwd, path)
  const normalized = relative(cwd, absolutePath).replace(/\\/g, "/")
  return normalized.startsWith(".") ? normalized : `./${normalized}`
}
