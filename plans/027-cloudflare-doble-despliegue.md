# Plan 027 — Cloudflare port with dual deploy (Cloudflare + Vercel backup) and PWA

Status: done
Created: 2026-10-12
Base branch: main
Goal: The public site moves to Cloudflare Workers (free plan, commercial use allowed, no traffic cap on static files) while Vercel keeps receiving the exact same build as an always-on backup (Álvaro, 2026-10-12: "todo en 2 webs a la vez"). Every push to `main` deploys to both; one codebase, no host-specific branches. Data stays in Supabase, shared by both. Also make the site an installable PWA. Budget rule: nothing paid beyond the domain. Measured 2026-10-09 with `@opennextjs/cloudflare` 1.20.9 + wrangler 4.148 on main 42edb09: Worker 10,264 KiB raw / **2,187 KiB gzip** (free limit 3 MB), admin included; on Windows the build only works with `nodeLinker: hoisted` (pnpm symlinks fail with EPERM), and pnpm 11 needs `allowBuilds` for `esbuild` and `workerd`.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 022 (`plans/022-pulido-deuda-spec.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`. **E2E policy: Álvaro runs the e2e himself** (against both hosts at the end). Álvaro runs the project since 2026-10-12 (Hernán, named in older plans, no longer directs it); every "Hernán" in referenced plans means Álvaro. Never run the full suite; run one spec only when strictly necessary. The landing keeps its 200 kB gzip critical-path cap (D-26). **Both hosts, always:** every change must keep `pnpm build` (Vercel) and the Cloudflare build working; no code path may exist for only one host unless it is config. Do not change the repo-wide `nodeLinker`; the Windows Cloudflare build runs from a temporary hoisted copy (T262). Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/`. Model: each task's `Model:` line. Skills: only those named in the task.

## Tasks

## T261 — Serve `art/` as static files and remove request-time disk reads
- Status: done
- Depends on: none
- Model: fable
- Skills: none
- Goal: Cloudflare Workers have no filesystem, so nothing may read the disk at request time. (1) `art/` (54 MB: manifests, sprites, `.glb` ships, `.mp4` gallery clips) stops being served by the `app/api/art/[...path]/route.ts` function and becomes static files copied at build time into a git-ignored folder under `apps/web/public/` (e.g. `public/art/`), with a prebuild script that both `pnpm build` and the Cloudflare build run. Keep the existing `/api/art/...` URLs working (a rewrite to the static path, or change `ART_BASE_URL` and every caller — 12 files reference `api/art`; pick one and log it). The `?optional=1` → 204 behaviour (used by `app/mar/engine/island-models.ts` and the ship loader) must be replaced by callers treating 404 as "missing" with a clean console (no red errors) — static hosts cannot return 204. Video byte ranges must keep working (static hosts serve ranges natively). Remove the `outputFileTracingIncludes` line from `next.config.ts`. (2) `lib/barco/load.ts` and `lib/intro/load.ts` use `readFileSync`; prove they only run at build time (the pages that call them — `app/(landing)/page.tsx`, `app/mar/page.tsx`, `intro-stage.tsx` — are statically prerendered; add `export const dynamic = 'force-static'` where needed) and add a unit test that fails if any route that is not statically prerendered imports `node:fs` (e.g. scan the build's route manifest or the import graph).
- Context: `apps/web/app/api/art/[...path]/route.ts`, `apps/web/lib/byte-range.ts`, `apps/web/lib/intro/load.ts` (`ART_BASE_URL`), `apps/web/lib/barco/load.ts`, `apps/web/next.config.ts`, D-16 in `docs/DECISIONES.md` (read only), `.gitignore`.
- Scope: may touch the art route (delete it if fully replaced), art URL callers, `next.config.ts`, `.gitignore`, a prebuild script under `apps/web/scripts/`, `package.json` scripts, tests / must not touch `art/` contents, the Blender pipeline, engine behaviour beyond the missing-file handling.
- Done when:
  - `pnpm build` → exit 0, and the built output serves `art/` files as static assets (ESTADO lists the size added to the static output)
  - unit tests: optional missing art is handled as missing without console errors; the no-`node:fs`-at-request-time test → pass
  - ESTADO section lists every changed caller and confirms `/mar` and the landing still load the ship, islands, title sheet and gallery clip (dev server check, screenshot in the attach folder)
  - Test command → exit 0
- Outcome: art/ is now served as static files from public/art (994 files, 43.6 MB), callers use /art, no request-time fs; 55cbc47

## T262 — Cloudflare build (OpenNext) and size budget
- Status: done
- Depends on: T261
- Model: fable
- Skills: none
- Goal: Add the Cloudflare build next to the Vercel one. Add `@opennextjs/cloudflare` and `wrangler` as devDependencies of `apps/web`; `allowBuilds: { esbuild: true, workerd: true }` in `pnpm-workspace.yaml`; `apps/web/open-next.config.ts`; `apps/web/wrangler.jsonc` (worker name `boia-planet`, `nodejs_compat`, assets binding, compatibility date of the day); scripts `cf:build` and `cf:preview`. `next/image` is used in `lib/mundo/carnet/avatar.tsx` and `id-card.tsx`: on Cloudflare the default optimizer is not available for free, so make images work on both hosts (e.g. `images.unoptimized` or a pass-through loader — pick the one that keeps Vercel behaviour acceptable, log it). The security headers from `next.config.ts` `headers()` and the `redirects()` must apply on Cloudflare too — verify. Add `pnpm cf:measure`: a Node script that copies the repo to a temp folder, installs with `nodeLinker: hoisted`, runs the OpenNext build and `wrangler deploy --dry-run --outdir`, prints raw and gzip size, and exits non-zero above a **2,800 KiB gzip budget** (free limit 3 MB). It must work on Windows and Linux. Run `wrangler dev`/`cf:preview` locally (from the hoisted temp copy if needed) and check the landing, `/mar`, `/carnet`, `/admin` (demo gate), `/sello`, an `art/` asset and a redirect.
- Context: plan header (measurement 2026-10-09), `apps/web/next.config.ts`, `apps/web/lib/security-headers.ts`, OpenNext Cloudflare docs (opennext.js.org/cloudflare), `.github/workflows/` for style. T261 note: on Cloudflare, Next `headers()` do not reach static assets served without the Worker, so `/art/*` caching (and the security headers on static files, if needed) may need a `public/_headers` file.
- Scope: may touch `apps/web/package.json`, lockfile, `pnpm-workspace.yaml` (only `allowBuilds`), new Cloudflare config files, `apps/web/scripts/`, image components' config, `.gitignore` (`.open-next/`, `.wrangler/`) / must not touch the repo-wide `nodeLinker`, Vercel project settings, anything outside the repo.
- Done when:
  - `pnpm cf:measure` → exit 0, prints gzip size ≤ 2,800 KiB (number in ESTADO)
  - `pnpm build` (Vercel path) → exit 0, unchanged behaviour
  - local Cloudflare preview: the pages listed in Goal answer 200 with the CSP header; screenshots of landing and `/mar` in the attach folder
  - Test command → exit 0
- Outcome: OpenNext Cloudflare build, `cf:build`/`cf:preview`/`cf:measure`; Worker 2,164 KiB gzip (budget 2,800); local wrangler preview serves all pages with CSP, art and redirects; ff03467

## T263 — Build version marker and two-host parity check
- Status: done
- Depends on: T262
- Model: opus
- Skills: none
- Goal: Make it possible to prove both hosts serve the same build. Expose the build's commit SHA and build time as a static `/version.json` (written at build time from `git rev-parse` or the host's env: `VERCEL_GIT_COMMIT_SHA`, `WORKERS_CI_COMMIT_SHA`/`CF_PAGES_COMMIT_SHA`, falling back to `git`). Add `pnpm check:hosts <url> [<url>…]`: for each URL fetch `/version.json`, `/`, `/mar`, one static `art/` manifest and `/.well-known/` if present; report status codes, CSP header present, and whether all SHAs match; exit non-zero on any mismatch or failure. Add a GitHub Actions workflow `hosts-parity.yml` (manual `workflow_dispatch` plus a schedule every 6 h) that runs it against URLs from repository variables `PUBLIC_URL` and `BACKUP_URL`, and is a no-op with a notice when the variables are not set.
- Context: `.github/workflows/supabase-backup.yml` for workflow style, `apps/web/scripts/`.
- Scope: may touch `apps/web/scripts/`, build scripts, `apps/web/public/` generation (git-ignored output), `.github/workflows/hosts-parity.yml`, tests / must not touch app pages or UI.
- Done when:
  - unit tests for the parity logic (match, mismatch, failure) → pass
  - `pnpm check:hosts https://boia-planet-roan.vercel.app` → runs and reports (may report missing `/version.json` until the next deploy; say so in ESTADO)
  - Test command → exit 0
- Outcome: `/version.json` written on both build paths, `pnpm check:hosts`, `hosts-parity.yml` (6 h + manual); live Vercel reports 404 for /version.json and /art until next deploy; e6612b5

## T264 — Installable PWA
- Status: done
- Depends on: T261
- Model: opus
- Skills: frontend-design
- Goal: Make the site installable on Android and iPhone with no store. Web app manifest (`app/manifest.ts`: name BOIA.PLANET, short name, colours from the existing brand tokens, `display: standalone`, start URL `/`), icons 192/512/maskable and Apple touch icon generated by a script from the existing `app/icon.svg` / `apple-icon.png` (no new artwork), `appleWebApp` metadata. A small service worker that never caches HTML, API or Supabase calls and never serves stale builds (network-first for navigations, no precache of the 3D assets; it exists for installability and must not break deploys on either host). A discreet "Instalar app" prompt (Android `beforeinstallprompt`; on iOS Safari a one-time hint "Compartir → Añadir a pantalla de inicio"), dismissible and remembered, text by i18n key. Must not push the landing over its 200 kB gzip critical-path cap: lazy-load the prompt.
- Context: `apps/web/app/layout.tsx`, `apps/web/app/icon.svg`, `apps/web/app/apple-icon.png`, `apps/web/lib/i18n/`, `apps/web/lib/security-headers.ts` (CSP must allow the worker: `worker-src 'self'`), D-26.
- Scope: may touch layout metadata, new manifest/SW/prompt files, icon generation script, i18n keys, CSP for the worker, tests / must not touch `/mar` scenes, the radio, the admin.
- Done when:
  - Lighthouse-style installability check passes locally (manifest valid, SW registered, icons present) — screenshot of Chrome DevTools "Application → Manifest" or equivalent in the attach folder
  - unit tests: SW routing never caches HTML/API; prompt dismiss is remembered → pass
  - landing critical-path budget check → still ≤ 200 kB gzip
  - `pnpm cf:measure` → still within budget
  - Test command → exit 0
- Outcome: installable PWA (manifest, icons, no-store SW with offline page, lazy install prompt on the landing only), landing 197.9 kB; cf:measure to be checked once T262 lands; 4cd3ff3

## T265 — Deploy runbook, failover and setup docs
- Status: done
- Depends on: T262, T263, T264
- Model: opus
- Skills: none
- Goal: Write `docs/DESPLIEGUE.md` (Spanish, for Álvaro): (1) the architecture — every push to `main` deploys to Cloudflare (public domain, via Cloudflare Workers Builds connected to the GitHub repo: build command, deploy command, root directory `apps/web`, env vars) and to Vercel (backup, unchanged Git integration); (2) env var parity table — every variable each host needs (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SUPABASE_SERVICE_ROLE_KEY` only if a server route needs it, `ADMIN_DEMO_PASSWORD`), where to set it, and the rule "change it in both"; (3) Supabase Auth: add both origins to Site URL / Redirect URLs; (4) domain: Porkbun purchase with a personal Gmail, nameservers to Cloudflare, custom domain on the Worker, optional redirect of the Vercel URL; (5) failover runbook: Cloudflare down → share the Vercel URL at once; long outage → nameservers back to Porkbun and point the domain to Vercel; (6) corporate email option B — Cloudflare Email Routing to Gmail + Gmail "Send as" through Brevo SMTP, with the DNS records to add and a single combined SPF record; (7) account rule: Porkbun and Cloudflare on a personal Gmail, everything else on the corporate address, migrate by inviting the corporate address as Owner; (8) "Cosas que caducan" — a table with what expires, when, what breaks and how to renew: the Brevo SMTP key used by Gmail "Send as" for `hola@boiaplanet.net` (created 2026-10-12, expires 2027-10-12, and also after 90 days without sending: send from `hola@` at least once a month; renewal = new key in Brevo → Gmail → Cuentas → Enviar como → editar), the free Supabase project pausing after ~7 days without activity (keepalive workflow `.github/workflows/supabase-keepalive.yml`, which must be committed to run), GitHub disabling scheduled workflows after 60 days without repo activity (keepalive, backup, hosts-parity: re-enable in the Actions tab), the domain `boiaplanet.net` (Porkbun, auto-renew on, expires 2027-10-12, 12.52 USD/yr), and a yearly calendar reminder for all of them. Link it from `README.md` and `docs/TRASPASO.md`; add one line to `CLAUDE.md` naming both hosts.
- Context: this plan's header, T262–T264 ESTADO sections, `README.md`, `docs/TRASPASO.md`, `CLAUDE.md`, Cloudflare Workers Builds docs (developers.cloudflare.com/workers/ci-cd/builds/).
- Scope: may touch `docs/DESPLIEGUE.md`, `README.md`, `docs/TRASPASO.md`, `CLAUDE.md` / must not touch code, `docs/DECISIONES.md`.
- Done when:
  - `docs/DESPLIEGUE.md` exists with the eight sections; every command and setting in it matches the repo (script names, paths, worker name)
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome: `docs/DESPLIEGUE.md` (8 sections) linked from README and TRASPASO, CLAUDE.md names both hosts; 16dc34e

## Decisions
- 2026-10-12: T261 and T262 run on Fable, the rest on Opus, to avoid failures in the port (Álvaro)
- 2026-10-12: Cloudflare is the public host, Vercel Hobby the always-identical backup; both deploy from `main` (Álvaro)
- 2026-10-12: Cloudflare builds via Workers Builds (free 3,000 build min/month), not GitHub Actions, so no Cloudflare token lives in GitHub (orchestrator; Álvaro may switch)
- 2026-10-12: Android Play Store app (TWA, `assetlinks.json`) and App Store are out of this plan (Álvaro: "después, opcional")
- 2026-10-12 T261: every art caller now uses `/art` via `lib/art-url.ts` (`ART_BASE_URL`), so Cloudflare serves assets without invoking the Worker; a `/api/art/:path*` → `/art/:path*` rewrite stays for legacy stored URLs
- 2026-10-12 T261: copy script copies only served extensions (.json/.png/.webp/.glb/.mp4), incremental, mirrors deletions; wired into `pnpm dev`, `pnpm build`, `e2e-server.mjs`, `demo.mjs`
- 2026-10-12 T261: `cache-control` rule for `/art/:path*` in `next.config.ts`; `byte-range.ts` and its test deleted (native ranges); `e2e/despliegue.spec.ts` rewritten and six `mar-*` specs moved to `/art` (Álvaro runs e2e)
- 2026-10-12: T262 Context gets T261's note about `_headers` for static assets on Cloudflare (orchestrator)
- 2026-10-12 T264: the service worker stores nothing; it only intercepts same-origin GET navigations (not /api), network-first, with a generated offline page when there is no network
- 2026-10-12 T264: install prompt and SW registration live only in the (landing) layout (not /mar, not admin); prompt lazy (after load + 2 s, shown after 15 s), hidden under `navigator.webdriver` and when already installed; iOS hint counts as dismissed once seen; Chrome mini-infobar suppressed in favour of the card
- 2026-10-12 T264: icons rendered with Playwright Chromium on white and committed; theme colour --boia-navy #12233f; `pwa.*` strings in es-pwa.ts are sample copy; CSP already had `worker-src 'self'`
- 2026-10-12 T262: OpenNext `incrementalCache` = static-assets read-only cache (no R2/KV, no accounts); `/eventos/[slug]` ISR (300 s) is frozen on Cloudflare until the next deploy (client `LiveEvent` recomputes; Vercel unchanged); unknown slugs log a harmless "read-only cache" error
- 2026-10-12 T262: `compatibility_date` 2026-10-06, the newest the bundled workerd accepts
- 2026-10-12 T262: `next/image` is not actually used, so no image config change
- 2026-10-12 T262: `scripts/cf-assets.mjs` writes `_headers` (security headers, immutable `_next/static`, art cache) and `_redirects` (`/api/art/* → /art/:splat 200`, the Next rewrite 404s on Cloudflare); `ART_CACHE_CONTROL` in `lib/art-url.ts`
- 2026-10-12 T262: `cf:build` runs `populateCache local` so a plain `wrangler deploy` ships prerendered pages; the hoisted temp copy appends `nodeLinker: hoisted` to its own `pnpm-workspace.yaml`
- 2026-10-12 T263: `scripts/version.mjs` runs in `build` and `dev` after the art copy (cf:build calls `pnpm build`), output git-ignored; no SHA → "unknown", which the check treats as failure
- 2026-10-12 T263: check uses `/art/barco/manifest.json` and an optional `/.well-known/assetlinks.json` (absent everywhere is fine, present on one host only fails); `/version.json` fetched with a timestamp query; SW never handles it (test added)
- 2026-10-12 T263: workflow with only one of PUBLIC_URL/BACKUP_URL checks that host alone with a notice; cron `17 */6 * * *`, Node 24, no install
- 2026-10-12 T265: Cloudflare build vars `PNPM_VERSION=11.27.1` and `NODE_VERSION=24` (build image ships pnpm 10); default watch paths so docs-only pushes also build and both hosts stay on the same commit
- 2026-10-12 T265: `SUPABASE_SERVICE_ROLE_KEY` and `ADMIN_DEMO_PASSWORD` documented as never set on the hosts (unused at runtime); no runtime vars in the Cloudflare panel (`wrangler deploy` replaces vars not in `wrangler.jsonc`, from wrangler knowledge, unverified in docs)
- 2026-10-12 T265: redirecting the Vercel URL marked not recommended (breaks the backup); failover adds a middle case (Worker down → switch DNS to Vercel inside Cloudflare) and DNSSEC/email notes; yearly reminder on 12 September; README `/api/art` mentions fixed and deploy check uses `pnpm check:hosts`

## Proposals (new scope)
- 2026-10-12: Android app in Play Store as a TWA (Bubblewrap config, `/.well-known/assetlinks.json` with a test on both hosts) once the domain is live — 25 USD one-off, Álvaro's account
- 2026-10-12: Commit `.github/workflows/supabase-keepalive.yml` (still untracked) so the free Supabase project never pauses — Álvaro's call

- 2026-10-12: Next 15 emits `mobile-web-app-capable` instead of `apple-mobile-web-app-capable` (iOS 16.4+ unaffected); real-device install test on Android and iPhone after deploy (T264)

- 2026-10-12: R2 incremental cache if real ISR on Cloudflare is ever wanted (T262)
- 2026-10-12: `cf:build` verified only on Windows from the hoisted copy; first Workers Builds run on Linux is the real check (T262)

- 2026-10-12: `README.md` and `CLAUDE.md` fail `prettier --check` (pre-existing, not covered by lint) (T265)

## Steps only Álvaro can do (outside the repo, after T262)
1. Create the Cloudflare account (personal Gmail), connect the GitHub repo in Workers Builds with the settings from `docs/DESPLIEGUE.md`, set the env vars.
2. Check the `*.workers.dev` URL and run the e2e against it and against the Vercel URL; `pnpm check:hosts` both.
3. Domain `boiaplanet.net` already bought (Porkbun) with DNS on Cloudflare (2026-10-12): attach it to the Worker; add both origins in Supabase Auth.
4. Done 2026-10-12: email option B (`hola@`, `admin@`), accounts moving to `admin@boiaplanet.net`.

## Log
- 2026-10-12 20:55 T261 launched (attempt 1, fable), agent a51d5f12c87f2006d
- 2026-10-12 21:12 T261 done, merged 55cbc47
- 2026-10-12 21:15 T262 launched (attempt 1, fable), agent aabe6eccf48621f68
- 2026-10-12 21:15 T264 launched (attempt 1, opus), agent a67678189fe2a1973
- 2026-10-12 21:32 T264 done, merged 4cd3ff3
- 2026-10-12 21:45 T262 done, merged ff03467; worktree dir left (locked), branch kept until removable
- 2026-10-12 21:48 T263 launched (attempt 1, opus), agent a8cccfbc817752c79
- 2026-10-12 21:55 cf:measure on main after T262+T264: Worker 2,186 KiB gzip (budget 2,800), 1,273 static files 52.1 MiB → T264's cf:measure Done-when satisfied
- 2026-10-12 21:56 T263 done, merged e6612b5
- 2026-10-12 21:58 T265 launched (attempt 1, opus), agent a3f97e00bad8c994a
- 2026-10-12 22:06 T265 done, merged 16dc34e; final test command on main passed in that integration; plan done
- 2026-10-12 22:30 pushed main 39081ab to origin (Álvaro, in session) for the first Cloudflare Workers Builds deploy
