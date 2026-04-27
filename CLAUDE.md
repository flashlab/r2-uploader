# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is **bun** (see `bun.lockb`). `npm`/`yarn` work but the build script uses `bun run` directly.

- `bun install` — install deps
- `bun run dev` — Vite dev server on port 7896
- `bun run build` — runs `build:setup` then `vite build` into `dist/`
- `bun run build:setup` — renders all `.md` in `public/setup-guide/` to `.html` via `public/setup-guide/gen_markdown.js`, then compiles `setup-guide-src/main.css` → `public/setup-guide/css/main.css` via `tailwindcss` CLI using `tailwind.setup-guide.config.cjs`. `index.md` is hand-maintained (no longer auto-copied from `README.md`). **`vite build` will not produce a working `/setup-guide/` without this step.**
- `bun run preview` — preview built site
- `bun run clean` — `rm -rf dist`
- `bun run deploy` — `build` then `bunx wrangler pages deploy ./dist --project-name=r2-zzbd`. Mirror of the GH Actions workflow, for local pushes. Recommended auth: run `bunx wrangler login` once (OAuth, cached in `~/.wrangler/config/default.toml`); env-var fallback is `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.

ESLint is configured (`eslint.config.js`, flat config, vue/recommended + prettier) but no `lint` script is wired in `package.json`; run `bunx eslint .` if needed. No test suite exists.

## Deploy

Single target: **Cloudflare Pages**. `.github/workflows/deploy.yml` runs `bun run build` on push to `main` and publishes `./dist` to the `r2-zzbd` Pages project. There is no backend in this repo — the only backend is the user-deployed Cloudflare Worker (see "Worker contract" below).

## Architecture

### Frontend (`src/`, Vue 3 + Vite + Tailwind + Pinia)

`App.vue` mounts three siblings: `EndPointManage`, `CustomUploader`, `FileList`. There is no router — single page.

State flow is unconventional and worth understanding before editing any component:

- **Source of truth is `localStorage`**, not Pinia. The keys `endPoint`, `apiKey`, `customDomain`, `endPointList`, `defaultCompressOptions`, `seeFolderStructure`, `sort`, `panelOpen`, `mpuPending` are all read/written directly. Components read on mount and on a signal.
- **`src/store/status.js` (Pinia) is a signal bus, not a store.** It holds a counter `endPointUpdated` that components `watch()` to re-read localStorage. `EndPointManage` increments it after writing; `CustomUploader` and `FileList` watch it and reload their local refs. When changing endpoint logic, you must keep this counter pattern intact or sibling components will silently desync.
- `uploading` and `uploadedFiles` on the same store are real shared state.

### Worker contract (the backend)

The R2-facing backend is a **Cloudflare Worker** the user deploys themselves. Two compatible flavours coexist:

1. **Inline single-shot worker** — minimal source historically embedded in upstream `README.md`; only supports single PUT (≤ 95 MB).
2. **`flashlab/r2-uploader-worker`** sibling repo (Hono + TS, MPU-capable). The frontend probes `/support_mpu` to decide whether MPU is available; if not, it falls back to a single PUT (and warns the user for files > 95 MB).

The frontend talks to the worker via:

- `PUT  {endPoint}{key}?[force|rename]` — single-shot upload, `Authorization: <apiKey>`. Worker should return `201` + `Content-Location: <urlencoded key>` on success, `409 'File already exists!'` on conflict (when neither `force` nor `rename` is set).
- `GET  {endPoint}{key}` — fetch (public unless `PRIVATE_BUCKET` env on the worker).
- `DELETE {endPoint}{key}` — delete, `Authorization: <apiKey>`.
- `PATCH {endPoint}?cursor=...` — list, returns `{objects, truncated, cursor}`, `Authorization: <apiKey>`.
- MPU group (auth via `x-api-key` header):
  - `GET  {endPoint}support_mpu` — capability probe; any 200 means yes.
  - `POST {endPoint}mpu/create/{key}` → `{uploadId}`
  - `PUT  {endPoint}mpu/{key}?uploadId=&partNumber=` body=Blob → `R2UploadedPart` JSON (frontend reads `res.data.etag`)
  - `POST {endPoint}mpu/complete/{key}?uploadId=` body=`{parts: [{partNumber, etag}, ...]}` (must be sorted ascending by `partNumber` — R2 requires it)
  - `DELETE {endPoint}mpu/{key}?uploadId=` — abort

When changing request shapes here, remember **both** worker flavours must keep matching, otherwise users on the inline single-shot worker break silently.

### Upload paths in `CustomUploader.vue`

- **Single-shot PUT** (file ≤ 95 MB): `attemptSinglePut` with up to 5 retries on transient errors (network failure or 5xx). Backoff schedule 0.5s → 2.5s. Aborted (user-clicked-remove) requests do **not** retry.
- **MPU** (file > 95 MB): 10 MB parts, 5 concurrent threads, 5 retries per part. Each successful part is persisted to `localStorage[mpuPending]` via `src/utils/mpuStore.js`.

### Resumable MPU (`src/utils/mpuStore.js`)

- After `mpu/create` succeeds, `recordCreate` stamps `{uploadId, key, id_key, fileName, fileSize, fileSig, partSize, endPoint, completedParts: [], createdAt}` into `localStorage.mpuPending` keyed by `uploadId`.
- Each part success calls `recordPart(uploadId, partNumber, etag)`.
- `mpu/complete` success or user-discard calls `recordRemove(uploadId)`.
- On `CustomUploader` mount: `pruneStale()` drops entries older than 7 days, then `refreshPending()` populates the in-page banner listing pending uploads for the current `endPoint`.
- **Resume happens at file re-pick.** The browser cannot rehydrate a `File` object across sessions (security), so `handleFiles` looks up each freshly added file by `fileSig = name|size|lastModified` against `mpuPending`. On match, it overrides the file's `key`/`id_key` with the saved values and stamps `file.resumeFrom = entry`. `mpuUploadFile` then skips `mpu/create`, hydrates `completedParts` from the entry, seeds `totalLoaded`, and the launch loop `continue`s past parts whose `partNumber` is already done. The "↻ Resuming" tag in the queued-file row is bound to `item.resumeFrom`.
- The "Discard all" button in the banner fires `DELETE mpu/{key}?uploadId=` against R2 (best-effort, ignores network errors) and clears the local entries.

### Setup guide pipeline

`README.md` covers project summary / architecture / deployment; `public/setup-guide/index.md` is the user-facing frontend usage guide and is maintained independently (no longer auto-copied from README).

`bun run build:setup` does two things:

1. Runs `gen_markdown.js` to render every `.md` in `public/setup-guide/` to a sibling `.html` using a fixed template that links three local stylesheets under `./css/`.
2. Runs `tailwindcss` CLI with `tailwind.setup-guide.config.cjs` to compile `setup-guide-src/main.css` (the Tailwind source — uses `@tailwind utilities;` + `@apply`) into `public/setup-guide/css/main.css` (the served, minified file). The other two stylesheets — `pico.min.css` and `custom.css` — are committed verbatim under `public/setup-guide/css/`.

Generated `.html` files **and** the compiled `public/setup-guide/css/main.css` are gitignored. The `<a href="/setup-guide/">` link in `App.vue` depends on these outputs existing in `dist/`.
