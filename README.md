# @adaptive-ds/website-content-pipeline

Markdown content processing pipeline for scheduled website articles, generated content lists, raw public content, and featured images.

## What it does

- Reads scheduled markdown articles from a content directory
- Normalizes and validates frontmatter (title, description, dates, author, slug, image, imageAlt) **in memory** — it never rewrites your source `.md` files
- Generates a typed `contentList.ts` for consumption by the site
- Optionally syncs source content from a remote (rclone bisync) and publishes optimized assets to a destination remote
- Optimizes content images and (optionally) generates missing featured images via an external service
- Provides a separate, opt-in `contentClean` step to canonicalize frontmatter on disk when you explicitly want it

## Install

```bash
bun add @adaptive-ds/website-content-pipeline
```

## Usage

```ts
import { contentProcess } from "@adaptive-ds/website-content-pipeline"

await contentProcess({
  contentDir: "./public/ratgeber",
  contentListOutputPath: "./src/app/content/contentList.ts",
  imageOriginalsDir: "./images",
  imageOptimizedDir: "./public/images",
  imagePromptsDir: "./src/app/content/image-prompts",
})
```

## API

### `contentProcess(options)`

Runs the full pipeline. **It is read-only with respect to your source `.md` files** — frontmatter is normalized in memory only to build `contentList.ts`.

1. (optional, with `--sync`) bisync source content from `sourceRemote`; on a failed bisync it auto-retries once with `--resync` to re-establish a missing/stale baseline, then continues
2. read + normalize + validate each `.md` in memory
3. generate featured-image prompts / missing images (prompt files are only rewritten when their content changes)
4. when `publicContentDir` differs from `contentDir`, copy the **raw** source `.md` to the public dir as a build artifact (only when missing or changed)
5. optimize images
6. generate `contentList.ts`
7. (optional, with `--sync`) sync public content to `destinationRemote`

A normal run leaves every source `.md` byte- and mtime-identical, so rclone bisync sees no spurious changes and propagates real edits/deletes normally.

### `contentClean(options)`

The explicit, opt-in counterpart to `contentProcess`. Iterates the content dir and canonicalizes each `.md`'s frontmatter (`normalizeFrontmatter` → `cleanFrontmatter` → `matter.stringify`), writing **only when the normalized output differs from the source** (so re-running on already-clean content is a true no-op and never churns mtimes). Pure-local: no bisync, no remote sync.

Returns `ContentCleanResult`: `{ scanned, changed: string[], unchanged }`.

```ts
import { contentClean } from "@adaptive-ds/website-content-pipeline"

const result = contentClean({
  contentDir: "./public/ratgeber",
  contentListOutputPath: "./src/app/content/contentList.ts",
  imageOriginalsDir: "./images",
  imageOptimizedDir: "./public/images",
  imagePromptsDir: "./src/app/content/image-prompts",
})
```

Run `contentClean` only when you deliberately want to re-canonicalize frontmatter (e.g. after bulk-importing messy drafts), then run `contentProcess` to pick up and publish the changes.

## Configuration

See `ContentProcessOptions` in `src/types.ts` for the full set of options. Key fields:

- `contentDir` (required): where source `.md` files live
- `contentListOutputPath` (required): output path for the generated content list
- `imageOriginalsDir`, `imageOptimizedDir`: image input/output directories
- `imagePromptsDir`: where image-generation prompts are written
- `sourceRemote`, `destinationRemote`: rclone remotes for bisync/publish
- `publicContentDir`, `publicPathBase`: where raw content is copied and its public URL base
- `optimizeImages`, `generateMissingImages`, `generateImagePrompts`: toggles

## Scripts

```bash
bun run build      # compile to dist/
bun run typecheck  # type-check without emit
bun run format     # biome check --write
bun run release    # bump version, build, commit, tag, push, GitHub release (ops/release.sh)
                   # pushing the v* tag triggers .github/workflows/publish.yml, which publishes to npm
```

## Exports

See exported functions in `src/index.ts` (e.g. `contentProcess`, `contentClean`, `cleanFrontmatter`, `normalizeFrontmatter`, `generateContentListCode`).
