export function normalizePublicPathBase(path: string): string {
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "")
  return withoutTrailingSlash === "" ? "/" : withoutTrailingSlash
}
