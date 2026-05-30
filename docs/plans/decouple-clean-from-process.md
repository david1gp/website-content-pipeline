# Plan: stop `contentProcess` from rewriting source `.md` files — split frontmatter cleaning into a separate `contentClean` step

Status: proposed
Package: `@adaptive-ds/website-content-pipeline` (currently `0.4.0`)
Primary consumer affected: `intersolaris` (and any project that bisyncs its content dir to a remote).

---

## 1. Problem

### Symptom
In consuming projects, `bun run content:process` runs an `rclone bisync` between the content dir (`public/<section>/`) and a remote (`gdrive_beta:.../Content`). On **every normal run** the bisync safety-aborts:

```
ERROR : Safety abort: all files were changed on Path1 "…/public/ratgeber/". Run with --force if desired.
NOTICE: Bisync aborted. Please try again.
```

Consequences:
- Deletions and edits never propagate to the gdrive mirror through the normal script (only `--resync` "works", and a resync is a union copy that cannot delete). Removing an article from gdrive currently requires a manual `rclone delete`.
- Every `.md` shows up as modified, so `git` and any change-detection downstream is noisy.

### Root cause
`src/contentProcess.ts`, inside the per-file loop (≈ lines 144–160), rewrites **every** content file unconditionally on every run:

```ts
const normalizedFrontmatter = cleanFrontmatter({ title, description, publishedAt, updatedAt, author, slug, image, imageAlt })
const normalized = matter.stringify(parsed.content || "", normalizedFrontmatter)
writeFileSync(filePath, normalized, "utf-8")        // <-- always writes, no change check
const publicContentFilePath = join(config.publicContentDir, file)
if (resolve(config.cwd, filePath) !== resolve(config.cwd, publicContentFilePath)) {
  cpSync(filePath, publicContentFilePath)
}
```

`filePath` lives in `config.contentDir`, which is the **bisync Path1**. There is no `if (normalized !== raw)` guard, so even byte-identical output is written, bumping the mtime. `matter.stringify` also re-emits frontmatter in a fixed key order with its own YAML formatting, and `normalizeFrontmatter` fills derived defaults (slug from filename, title from slug, description fallback, `alt`→`imageAlt`), so author-authored files get reshaped on first touch and then re-touched forever after.

All-mtimes-changed → rclone bisync's safety check ("all files were changed on Path1") → abort.

### Why a flag/`--force` is not the fix
`--force` / `--resync` mask the abort but don't restore correct sync semantics (resync can't delete; force is dangerous). The real issue is that a *read+derive* operation is mutating the synced source of truth as a side effect.

---

## 2. Goal

1. **`contentProcess` must not mutate the source content dir.** A normal run leaves every source `.md` byte-identical (and mtime-identical) → bisync sees no changes and behaves normally (propagates real edits/deletes).
2. **Frontmatter canonicalization ("cleaning") becomes an explicit, opt-in operation** — a separate exported function `contentClean(...)` and a `content:clean` script in consuming projects — run deliberately, not as a side effect of every build.
3. No loss of capability: `contentList.ts` generation, image-prompt/missing-image handling, optimization, and remote sync continue to work exactly as today.

---

## 3. Design

### Part A — make `contentProcess` read-only w.r.t. the source `.md`
- Keep reading + parsing + `normalizeFrontmatter` **in memory** (the normalized values still feed each `ContentEntry` that goes into `contentList.ts`). Normalization only touches frontmatter, never the markdown body.
- **Remove the `writeFileSync(filePath, normalized)` call.** The source file is never written during `contentProcess`.
- Public copy behavior when `publicContentDir !== contentDir`: `cpSync` the **raw** source file to the public dir (a build artifact), guarded so it only copies when missing/changed. When `publicContentDir === contentDir` (the intersolaris case), there is nothing to copy and nothing to write — the served file is the source, untouched. (Frontmatter is consumed via the generated `contentList.ts`, and the served markdown body is unaffected by cleaning, so serving raw source is correct.)

Net effect: `contentProcess` is now a pure producer of `contentList.ts` (+ optimized images + prompts + remote sync) and a pure reader of source content.

### Part B — extract `contentClean` (idempotent, change-guarded)
New module `src/contentClean.ts`, exported from `src/index.ts`:
- Iterates the content dir, and for each `.md`: `normalizeFrontmatter` → `cleanFrontmatter` → `matter.stringify`, then writes **only if `normalized !== raw`**.
- Returns a summary: `{ scanned, changed: string[], unchanged: number }` and logs each changed file.
- Reuses the existing `ContentProcessOptions` shape (or a focused subset: `contentDir`, `contentSection`, `logLevel`, plus the same filename parsing) so consumers can pass the same option object.
- Pure-local by default: no bisync, no remote sync — cleaning is a disk-only canonicalization. (The push to the remote happens afterward via the normal sync; see workflow below.)

The single `if (normalized !== raw)` guard is the crux — it makes re-running `contentClean` on already-clean content a true no-op, so it never churns mtimes either.

### Part C — consuming project wiring (`intersolaris`)
- Add a thin entry script `src/app/content/contentClean.ts` that imports `contentClean` and passes the same dir options the existing `contentProcess.ts` entry uses. Factor the shared option literal (contentDir, section, dirs) into a small shared module so the two entries don't drift.
- Add `package.json` scripts:
  - `"content:clean": "bun run ./src/app/content/contentClean.ts -- --content-section=ratgeber"` — canonicalize source frontmatter locally.
  - (optional) `"content:clean:sync": "bun run content:clean && bun run content:process:init"` — clean, then resync the cleaned files to gdrive once.
- `content:process` / `content:process:local` / `content:process:init` keep their current arg shape; they simply no longer rewrite source files.

### Secondary (related) cleanup — image-prompt write churn
`writeImagePromptFile` (≈ lines 29–41) also writes every prompt `.md` unconditionally each run. These live in `imagePromptsDir` (e.g. `src/app/content/image-prompts/`), which is **not** on the bisync path, so it does not cause the abort — but it does churn git (the prompts embed an absolute `Target file:` path, so they flip between machines). Apply the same `if (next !== existing) writeFileSync(...)` guard there to keep git quiet. Lower priority; can ship separately.

---

## 4. Concrete changes (file by file)

`@adaptive-ds/website-content-pipeline`:
1. `src/contentProcess.ts` — delete the `writeFileSync(filePath, normalized)` line; keep `normalized*` in memory for the entry; make the public `cpSync` copy raw + guard it; drop the now-unused write path. Keep `cleanFrontmatter`/`normalizeFrontmatter` imports (still used in memory).
2. `src/contentClean.ts` — **new**: the extracted, change-guarded normalizer described in Part B.
3. `src/index.ts` — `export * from "./contentClean.js"`.
4. `src/types.ts` — add `ContentCleanResult` (and `ContentCleanOptions` if a narrower shape than `ContentProcessOptions` is preferred).
5. (secondary) `src/contentProcess.ts` — guard `writeImagePromptFile`.
6. `test/` — see §6.
7. `changelogs/` + version bump.

`intersolaris`:
1. `src/app/content/contentClean.ts` — new entry.
2. extract shared option literal used by both content entries.
3. `package.json` — add `content:clean` (+ optional `content:clean:sync`); bump the dependency range (see §7).

---

## 5. New workflow / migration

One-time, to canonicalize what's already out there and re-baseline the mirror:
1. `bun run content:clean` — normalize all source `.md` locally (this is the *last* intended mass-rewrite).
2. `bun run content:process:init` — resync the cleaned files up to gdrive once, establishing a clean bisync baseline.

Steady state from then on:
- `bun run content:process` — builds `contentList.ts`, optimizes, syncs to Cloudflare, and bisyncs gdrive **without touching source mtimes**, so deletions/edits propagate normally. No more manual `rclone delete`.
- Run `content:clean` only when you deliberately want to re-canonicalize frontmatter (e.g. after bulk-importing messy drafts), followed by a normal `content:process` to push the (now real) changes.

---

## 6. Testing
- Unit: `contentClean` writes when frontmatter is messy/partial; is a **no-op** (no write, mtime preserved) when already canonical. Assert via mtime/`writeFileSync` spy.
- Unit: `contentProcess` does **not** write to `contentDir` for any input (spy on `fs.writeFileSync` filtered to the content dir → zero calls); still emits a correct `contentList.ts`.
- Integration: run `contentProcess` twice over a fixture dir; assert all source mtimes are unchanged between runs (the regression that reproduces the bisync abort).
- Integration: `contentClean` then `contentProcess` → entries reflect cleaned frontmatter; second `contentProcess` is mtime-stable.

## 7. Versioning / rollout
- This changes observable behavior (process no longer rewrites source) and adds API → bump to **`0.5.0`**.
- `intersolaris` currently depends on `^0.4.0`, which does **not** admit `0.5.0` (caret pins the minor on 0.x). Update intersolaris to `^0.5.0` and run `bun install` after publishing.
- The homepage/personal-site pipeline is R2-based and separate; verify whether it consumes this package before assuming impact.

## 8. Open questions
- `ContentCleanOptions`: reuse full `ContentProcessOptions` (simplest for consumers) vs. a narrow new type (cleaner API)? Leaning reuse.
- Should `content:clean` optionally take `--sync`/`--resync` to push in one step, or stay strictly local and rely on `content:process:init` for the push? Plan assumes strictly local; `content:clean:sync` script covers the combined case.
- Should there be a `--check` mode for `contentClean` (report files that *would* change, non-zero exit) for CI linting of frontmatter? Nice-to-have, out of scope for the first cut.
