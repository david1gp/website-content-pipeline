export function formatContentListWithBiome(options: { contentListOutputPath: string; cwd: string }) {
  const result = Bun.spawnSync(["bunx", "--no-install", "biome", "format", "--write", options.contentListOutputPath], {
    cwd: options.cwd,
    stderr: "inherit",
    stdout: "inherit",
  })

  if (result.exitCode !== 0) {
    throw new Error(`Biome could not format ${options.contentListOutputPath} (exit code ${result.exitCode}).`)
  }
}
