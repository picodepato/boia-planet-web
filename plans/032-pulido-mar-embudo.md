# Plan 032 — Polish, a livelier sea and our own funnel

Status: done
Created: 2026-10-15
Base branch: main
Goal: After plan 031 (artists claim their profile), and leaving the security checklist (`plans/seguridad-pendiente.md`) for later (Álvaro, 2026-10-15): half polish, half new things. Polish: /mar and phones (lost 3D context, cut notices, map labels, 🪪 box on Windows), accounts and progress leftovers, code cleanup (loose strings to i18n with a lint rule, prettier, flaky test, stale «faro»), and the spec and docs brought up to date (REQs that are built but no test names, a rewritten `docs/TRASPASO.md`). New: a livelier sea (real waves that move the surface and rock the boat, a movable minimap, FPS measured), our own cookie-free funnel counters in Supabase with an «Embudo» panel in the Admin (replacing the PostHog sink), and a tested backup restore plus host parity that also checks the accounts mode. Ticketing (P2) stays out.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 027 (`plans/027-cloudflare-doble-despliegue.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded from vitest, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `.claude/scratch_*`, `e*.log`, `reunion/`, `output/` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`. Álvaro runs the project. Never run the full e2e suite (one spec only if strictly needed). Security hardening (`plans/seguridad-pendiente.md`) is out of scope: note findings in OUT OF SCOPE, do not fix them.
Accounts rules for every task: accounts mode is LIVE in production since 2026-10-14 (Supabase project ref kzxdywtysrcnqqjfhhnc): agents NEVER touch it. New migrations are applied to the dev project only (`boia-planet-dev`, credentials in the main checkout's `apps/web/.env.local`, read by absolute path) and listed in `docs/propuestas/2026-10-03-produccion-supabase.md`; the orchestrator applies them to production before the plan's push. Security model as plan 029 T278: admin-only actions through private SECURITY DEFINER functions with an INVOKER wrapper, empty search_path, role check inside, tests as anon/member/admin in `pnpm test:supabase`. Local/demo mode must keep working (no Supabase variables). Landing critical-path budget (`scripts/landing-budget.mjs`, 200 KB gzip, 199.3 used: keep new landing code lazy) and `pnpm cf:measure` must still pass: Admin and /mar code stays off the landing. All new UI text through `apps/web/lib/i18n/`, `muestra` until Álvaro approves it. Audit rule as plan 029 (sonnet/haiku tasks get an Opus audit before integration).

## Tasks

## T298 — A livelier sea
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: REQ-MUN-003 and REQ-MUN-021. The water shader already animates colour bands, wind foam, sparkles and shore foam, but the surface is flat. Add real gentle waves: vertex displacement of the water ring (low amplitude, a few summed directional waves, wind-aligned, calmer near islands and docks) and the boat bobbing/rolling on them (pitch/roll from the wave normal under the hull, visual only: navigation, collisions, the swell jump of T269 and the camera stay readable — no motion sickness, `prefers-reduced-motion` flattens it). Make the minimap movable again: today a long press opens the big map, so pick a gesture that does not clash (e.g. a drag handle or «Mover» in the settings menu, the position already persists through `packages/engine/src/ui/hud-layout.ts`) and update `apps/web/e2e/mar-hud.spec.ts` accordingly. Put the waves and the boat rocking behind one switch (a single constant/flag in the /mar engine config, on by default) so they can be turned off in one line without reverting the task if Álvaro's hand test finds a problem. Measure FPS before/after on the existing quality presets (low preset must not lose more than ~5% frame time; on low, waves may be off) and record it.
- Context: `apps/web/app/mar/engine/water.ts`, `packages/engine/src/swell/`, the boat/camera code in `apps/web/app/mar/engine/`, `apps/web/app/mar/minimap.tsx`, `packages/engine/src/ui/minimap.ts`, `packages/engine/src/ui/hud-layout.ts`, quality presets, REQ-MUN-003 / REQ-MUN-021 in `docs/spec/09-requisitos.md` and `docs/spec/estado.md:191`, `docs/spec/03-mundo-y-motor.md:11`.
- Scope: may touch the /mar engine, water, boat, minimap, HUD layout, settings menu, i18n, tests, `docs/spec/estado.md` / must not touch the landing bundle, accounts, the Admin.
- Done when:
  - unit tests: wave height/normal function (deterministic, zero amplitude with reduced motion and near docks), boat pitch/roll clamped, minimap move gesture does not open the big map → pass
  - `pnpm e2e apps/web/e2e/mar-hud.spec.ts` (single spec, free port) → pass
  - with the switch off, /mar behaves exactly as before (unit test on the flag);
  - a short hand-test checklist for Álvaro in the ESTADO section (sail around, docks, islands, swell jump, minigames, map, minimap move, phone and low preset);
  - FPS before/after per preset recorded in the ESTADO section; REQ-MUN-003 and REQ-MUN-021 updated in `docs/spec/estado.md` with their proof
  - Test command → exit 0
- Outcome: gentle waves + boat rocking behind `LIVELY_SEA` (waves.ts), off on low preset, minimap movable from Ajustes, no measurable FPS cost; REQ-MUN-021 HECHO, MUN-003 PARCIAL until Álvaro reviews → 005233d

## T299 — /mar and phones: lost 3D, cut notices, map labels, the 🪪 box
- Status: done
- Depends on: T298
- Model: sonnet
- Skills: none
- Goal: Phone and small-screen robustness. (1) /mar survives losing its WebGL context the way the landing does since T289 (`webglcontextlost`/`restored`: pause, a calm notice, restore or offer reload; app-switch and screen lock covered) and update `docs/spec/matriz-dispositivos.md` row 16. (2) Top notices (toasts/banners) are not cut off on phones: safe areas, wrapping, max width at 360 px. (3) Big map: the «Cerrar» button no longer covers a label, and the Puig Campana label no longer overlaps another island at 360 px. (4) The 🪪 emoji shows as an empty box on Windows 10 (still in ~8 files, e.g. `reward.tsx`, `sign-in-sheet.tsx`): replace it with an inline SVG/icon component used everywhere, same meaning. (5) Fix the chart part of the «(ni la carta)» test in `apps/web/e2e/mar-hud.spec.ts`, failing before T298 (same result with the waves off): find whether the app or the test is wrong. (6) Update the REQ-MUN-021 criterion in `docs/spec/09-requisitos.md` (500 ms press → «Mover el minimapa» in Ajustes, T298).
- Context: T289 (commit 5001cb3) for the landing pattern, `apps/web/app/mar/`, the big map component, toast/notice components, `docs/spec/matriz-dispositivos.md`, plan 029 Proposals.
- Scope: may touch /mar UI and engine bootstrap, map overlay, notices, the files using 🪪, i18n, tests, the device matrix / must not change T298's waves or minimap gesture.
- Done when:
  - `pnpm e2e apps/web/e2e/mar-hud.spec.ts --workers=1` (single spec, free port) → pass
  - unit/component tests: context lost → paused + notice, restored → resumes; no 🪪 left in `apps/web` and `packages` (grep in a test or check script); map label layout at 360 px has no overlap with «Cerrar» or between islands → pass
  - Test command → exit 0
- Outcome: /mar pauses on WebGL loss with a calm notice and «Recargar» fallback (`gl-watch.ts`), notices wrap, 🪪 → inline SVG `carnet-icon.tsx`, map labels guarded by a 360 px e2e, «(ni la carta)» test fixed (measures `--pin-tip`); Opus audit ok after one test fix → 64078b8

## T300 — Accounts and progress leftovers
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Three account bugs from plan 029's Proposals. (1) An expired session must not merge the old guest/local data into the next account that signs in on the device: decide the safe rule (e.g. local progress tied to the account it was synced with; guest data only merges into the first account that claims it, with the existing merge rules) and log it. (2) Server-side progress knows the new secret achievements and the «after» boat (plan 029), so they are not dropped or rejected on sync. (3) A trashed member whose member number was reused can be restored (gets a new number, the Admin sees it, audit row).
- Context: `apps/web/lib/repo-member.ts`, `apps/web/lib/mundo/carnet/use-carnet.ts`, `apps/web/lib/mundo/achievements.ts`, the sync/merge code, T284 (sign out resets the device), Supabase migrations for progress/achievements and the member trash (plan 020 T230), Admin «Socios» trash.
- Scope: may touch those files, a new migration (dev only) + switch-on doc, Admin trash UI, i18n, tests / must not touch /mar rendering, the funnel, the artist claim flows of plan 031.
- Done when:
  - unit tests: session expires → sign in as another account → no guest/local data from the first account merges; first claim still merges → pass
  - `pnpm test:supabase` (dev): new secret achievements and the after boat are accepted on sync; restoring a trashed member with a reused number gives a new number and an audit row; member/anon cannot restore → pass
  - Test command → exit 0
- Outcome: guest data merges only into the first account since the last reset; server accepts the after boat/secret prizes (migration 20261015100700, dev only); trashed members with a reused number restore with a new number → 65546bb

## T301 — Our own funnel counters and the «Embudo» panel
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: REQ-ARQ-019 without third parties (Álvaro, 2026-10-15): daily counters in Supabase, no cookies, no personal data, no per-visitor ids stored. Steps: landing_view → explore_start (enters /mar) → discount_found → tickets_panel_open → ticket_click_out (purchase_confirmed stays for the ticketing webhook, not built). Each step counts at most once per visit (dedupe client-side per tab session). Storage: a table of (day, event, count) incremented only through one anon-callable function that accepts the allowed event names only (no free text) — inflation by abuse is accepted, note it. The Admin switch (`site_settings.analytics_enabled`, off by default) still gates sending. Admin «Embudo» panel: last 7 and 30 days, count per step and % from the previous step, admin-only read. Remove the PostHog sink from `apps/web/lib/analytics/` (keep `track()` as the single entry point; /mar must now send `discount_found`). Local mode: counters in the local store so the panel works in demo. Update the privacy text only if it mentions PostHog (key, `muestra`).
- Context: `apps/web/lib/analytics/index.ts`, `apps/web/lib/analytics/switch.ts`, `packages/contracts/src/analytics.ts`, callers in `landing-client.tsx`, `live-event.tsx`, `mar3d.ts`, `vortex.ts`, `mar-client.tsx`, `intro/run.ts`, the /mar discount code, Admin sections, REQ-ARQ-019 in `docs/spec/08-arquitectura-y-datos.md:72`.
- Scope: may touch those files, a new migration (dev only) + switch-on doc, Admin UI, i18n, tests, `docs/spec/estado.md` / must not add any third-party script, cookie or stored identifier; the landing budget must still pass (the call must stay tiny).
- Done when:
  - unit tests: each step sent once per visit, nothing sent with the switch off, unknown event names rejected client-side; panel math (% per step, 7/30 days) → pass
  - `pnpm test:supabase` (dev): anon can increment allowed events only; anon/member cannot read counts; admin can → pass
  - `node scripts/landing-budget.mjs` → pass
  - Test command → exit 0
- Outcome: daily funnel counters (migration 20261015101100, dev only) via anon `funnel_hit` gated by `analytics_enabled`, once per visit (sessionStorage), «Embudo» Admin panel 7/30 days, PostHog removed (code, CSP, docs) → aee8ce0

## T302 — Tested backup restore, and host parity checks the accounts mode
- Status: done
- Depends on: none
- Model: sonnet
- Skills: none
- Goal: REQ-ARQ-013. The nightly encrypted backup already exists (`.github/workflows/supabase-backup.yml`, plan 019 T223 / 020 T230) but no restore was ever tested. Write a restore script and a step-by-step guide (decrypt with the passphrase, restore the database and the Storage files into a target project), and prove it on the DEV project only: dump dev, empty it, restore, check row counts and a few Storage files match, leave dev working (re-apply migrations if needed). Never touch production; restoring a real production backup is Álvaro's step with the guide. Also extend `apps/web/scripts/check-hosts.mjs` (and `hosts-parity.yml` if needed) to check both hosts run the same accounts mode (e.g. a field in `/version.json` or a marker on a page, no secrets exposed) and fail if they differ.
- Context: `.github/workflows/supabase-backup.yml`, `.github/scripts/storage-backup.py`, `docs/propuestas/2026-10-08-backups.md`, `apps/web/scripts/check-hosts.mjs`, `.github/workflows/hosts-parity.yml`, `/version.json` generation, `docs/DESPLIEGUE.md`.
- Scope: may touch those files, a new restore script under `tools/` or `.github/scripts/`, the guide, `/version.json` generation, tests, `docs/spec/estado.md` / must not touch production, must not change the backup schedule or secrets.
- Done when:
  - the dev restore ran: before/after row counts per table and Storage file counts recorded in the ESTADO section, equal
  - unit tests for check-hosts: same mode passes, different mode fails, missing field warns → pass
  - Test command → exit 0
- Outcome: Node restore tools in `tools/backup/` (refuse production, preflight before wipe, pg_dump 17.6 `\restrict` lines handled) + guide, dev restore along the guide equal (63 tables, 4276 rows, 3 files); `/version.json` carries `accounts`/`accountsRef`, check-hosts fails on mismatch; Opus audit found 2 blocking + 5 minor, all fixed → 7359a2d

## T303 — Code cleanup: loose strings to i18n, a lint rule, prettier, the flaky test, the stale «faro»
- Status: done
- Depends on: T299, T300, T301, T302
- Model: sonnet
- Skills: none
- Goal: Move the remaining loose UI strings to `apps/web/lib/i18n/` (known: `acuarela/skin.ts`, `behaviors.ts` `leaveReaction`, `MERCHANDISE_NOTICE`, shop product names; find the rest) and add a lint rule (or a check in `tools/spec/checks.sh`) that fails on new loose user-visible strings in components, with a small allowlist. Make prettier pass where it fails (README, CLAUDE.md, `*.supabase.ts` tests). Fix the flaky `admin-password.supabase.ts` (find the cause, no retries-as-fix). Remove the stale `faro` minigame from `mundos/arcilla/mapa.json` (~3240) if nothing uses it.
- Context: `apps/web/lib/i18n/`, eslint config, `tools/spec/checks.sh`, `.prettierrc`, `packages/db` or wherever `admin-password.supabase.ts` lives, `mundos/arcilla/mapa.json`, plan 027 and 029 Proposals.
- Scope: may touch any file for string moves and formatting only, eslint config, checks, the flaky test, `mapa.json` / must not change behaviour or visible text (same strings, now by key).
- Done when:
  - `pnpm lint` with the new rule → exit 0, and the rule fails on a fixture with a loose string (test)
  - `pnpm exec prettier --check .` (repo's configured scope) → exit 0
  - `pnpm test:supabase` (dev) → `admin-password` passes 5 runs in a row
  - Test command → exit 0
- Outcome: loose strings to keys (Acuarela, leaveReaction, store notices, ~20 admin), ESLint rule `no-loose-strings` (+ attribute expressions), prettier over the repo with ESTADO/CLAUDE.md/mundos ignored, admin-password test reports Auth status (cause unconfirmed, 6+ green runs); faro kept (still read); Opus audit ok after minor fixes → a9d0a6c

## T304 — Spec and docs up to date
- Status: done
- Depends on: T298, T299, T300, T301, T302, T303
- Model: haiku
- Skills: none
- Goal: The ~15 REQs in `docs/spec/estado.md` marked PARCIAL only because no test names them: find each, check it is really built, add or rename a test that names the REQ (or link the existing proof), and move it to HECHO; leave honest notes on the ones that are not. Then rewrite `docs/TRASPASO.md` to today (one screen): accounts mode live on both hosts since 2026-10-14, Cloudflare public + Vercel copy, plans 027–032 summary, current counts, what remains, what depends on Álvaro (P-questions still open, security checklist pending), and fix stale lines (the box-office rule is already editable in the Admin since plan 019 T215; P20 moot; P7 done). Also update REQ-ARQ-019 in `docs/spec/08-arquitectura-y-datos.md` and `09-requisitos.md`: PostHog was replaced by our own Supabase counters (T301, Álvaro 2026-10-15; D-04 in DECISIONES still says PostHog: do not edit it, flag it for Álvaro). Also correct the T303 section of ESTADO.md: it says `mundos/arcilla/mapa.json` was prettier-formatted, which was reverted (mundos/ is in .prettierignore).
- Context: `docs/spec/estado.md`, `docs/spec/09-requisitos.md`, `tools/spec/estado.py`, `docs/TRASPASO.md`, `docs/DECISIONES.md` (read only), top of `ESTADO.md`, `plans/027`–`032`, `CLAUDE.md`.
- Scope: may touch tests (names/REQ tags, small new tests), `docs/spec/estado.md`, `docs/TRASPASO.md`, `README.md` if stale / must not change app behaviour, must not edit `docs/DECISIONES.md`.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0, with the HECHO count up and every new HECHO linked to a test
  - Test command → exit 0
- Outcome: TRASPASO.md rewritten to one screen (with the pre-push items and the production rule), REQ-ARQ-018 HECHO (187 HECHO), REQ-ARQ-019 wording → own counters, CLAUDE.md plans 001–032 done; the other ~12 PARCIAL need phone/design/Álvaro; Opus audit fixes applied → ac71cfe

## T305 — Console errors in /mar after plan 032
- Status: done
- Depends on: T298, T299, T301
- Model: opus
- Skills: none
- Goal: Before Álvaro's hand test, the local demo (`pnpm demo`, port 3100) shows two console errors on /mar that production (af9ac37, before plan 032) does not seem to show: `THREE.BufferGeometry.computeBoundingSphere(): Computed radius is NaN` (a geometry with NaN positions) and a `Failed to load resource: 400`. Find out whether plan 032 introduced them (compare with af9ac37), find the cause, and fix it if it is ours; if it is pre-existing or harmless, say so with evidence.
- Context: T298 waves (`apps/web/app/mar/engine/waves.ts`, water, boat), T299 `gl-watch.ts`, T301 funnel sink (`apps/web/lib/analytics/`, `funnel_hit`), local demo mode without Supabase variables.
- Scope: may touch the files at fault and their tests / must not change visible behaviour beyond the fix.
- Done when:
  - /mar in the local demo loads with no NaN geometry warning and no 400 (or evidence that they predate plan 032 and are harmless)
  - a unit test guarding the fix, if there is one
  - Test command → exit 0
- Outcome: 400 = supabase-js refreshing a stale saved dev session on localhost (once, then clean; not from plan 032); NaN warning never reproduced in many probe runs, plan 032 adds no CPU geometry; guard test added in waves.test.ts → 7e7099b

## Decisions
- 2026-10-15: Plan 032 started after plan 031 ended (main af9ac37, pushed; notice from the session that ran 031, at Álvaro's request) (orchestrator)
- 2026-10-15: Half polish, half new; no security work, no ticketing until P2 is chosen; funnel with our own Supabase counters, not PostHog; restore tested on dev only (Álvaro)
- 2026-10-15: Minimap and living water mostly existed, so they become one «livelier sea» task with real waves and a movable minimap; backups and host parity existed, so the gap (tested restore, accounts-mode parity) is one task (orchestrator, Álvaro agreed)
- 2026-10-15: Models: opus for T298/T300/T301, sonnet for T299/T302/T303, haiku for T304, Opus audit for sonnet/haiku (Álvaro)
- 2026-10-15: T305 added: console errors seen on /mar in the local demo before the hand test (orchestrator)
- 2026-10-15: T299 after T298 (both touch /mar UI); T303 and T304 last because they sweep many files (orchestrator)
- 2026-10-15: Push when every task is done, after applying T300/T301 migrations to production, only on Álvaro's yes (Álvaro)
- 2026-10-15: No push until Álvaro has tried the new sea by hand (local dev server, T298's checklist) and confirmed it breaks nothing in the world; if something breaks, turn the waves switch off (or fix) before pushing (Álvaro)
- 2026-10-15 T300: guest data merges only into the first account that signs in since the last device reset (`boia.invitado.cuenta`); another account gets no merge and no nickname suggestion (agent)
- 2026-10-15 T300: migration 20261015100700 (dev only, listed for production): cosmetic `barco-after`, `private.achievement_prizes` (after = 150 points / 500 coins, once, outside the daily cap), `award_points` uses it (agent)
- 2026-10-15 T300: restored member with a taken number gets the next number; audit row has old/new; Admin trash warns `number_taken` (agent)
- 2026-10-15 T298: switch `LIVELY_SEA` in `apps/web/app/mar/engine/waves.ts`; waves not compiled on low preset, flat with reduced motion and in map view, up to +50% with wind; boat does not rock airborne; camera ignores waves; minimap moved via Ajustes → «Mover el minimapa» (drag/tap swaps sides, saved in `boia.mar.minimapa.zona`), back to the left in Cañón/Castillo (agent)
- 2026-10-15 T299 extended with the pre-existing failing chart part of `mar-hud.spec.ts` and the REQ-MUN-021 criterion text (orchestrator)
- 2026-10-15 T301: once-per-visit record in sessionStorage (`boia.embudo.visita`, step names only); plain fetch with the public key, no supabase-js, no session; server also checks `analytics_enabled`; days in Europe/Madrid; admin reads 1–90 days; demo counters in localStorage `boia.embudo`; PostHog removed from CSP, `.env.example`, README, DESPLIEGUE (agent)
- 2026-10-15 T304 extended: REQ-ARQ-019 spec text (PostHog → own counters) (orchestrator)
- 2026-10-15 T299: WebGL loss handled by `GlWatch` reusing the landing rules; map labels needed no code change (T279/T280 layout already fine), only a guard e2e; «(ni la carta)» test was wrong, not the app (agent; Opus audit ok)
- 2026-10-15 T302: no pg_dump/psql on the machine → Node tools (`restore.mjs`, `dump.mjs`, `counts.mjs`); tested route = new project with migrations, then `--skip-schema`; `--wipe --confirm-ref` only if the target has accounts/Storage (agent; Opus audit fixes)
- 2026-10-15 T303: `ESTADO.md`, `CLAUDE.md`, `mundos/`, `plans/`, glifos.json, next-env.d.ts in .prettierignore; products.json stays content data; faro kept in mapa.json (still read by map.ts and mundo_arcilla.py) (agent; Opus audit ok)
- 2026-10-15 T304: only REQ-ARQ-018 could honestly move to HECHO; the T303 ESTADO sentence about mapa.json did not exist (agent; Opus audit fixes)
- 2026-10-15 T305: no product code change; the 400 is supabase-js behaviour, the NaN could not be reproduced (agent)

## Proposals (new scope)
- 2026-10-15 T305: `pnpm demo` rewrites `apps/web/tsconfig.json` on every start (dirties main)
- 2026-10-15 T304: PostHog still named in checks (`security-headers.test.ts`, `despliegue.spec.ts`, `admin-papelera.spec.ts`), harmless, could be cleaned
- 2026-10-15 T303: retire `faro` from mapa.json after migrating `packages/world/src/worlds/arcilla/map.ts` and `tools/blender/mundo_arcilla.py` reads
- 2026-10-15 T303: a vitest test spawns Python without PYTHONUTF8=1 (cp1252 traceback printed, tests pass); `tools/` is outside eslint
- 2026-10-15 T302: try the restore once with a real nightly backup (pg_dump 17.6 `schema.sql` untried against Postgres); restoring production is Álvaro's step with the guide
- 2026-10-15 T302: dev dump and counts kept in `C:\Users\alvar\boia-backups-dev` (outside the repo, contains dev data)
- 2026-10-15 T299: lock-screen/app-switch on a real phone not tested (only emulated with WEBGL_lose_context): add to Álvaro's hand test
- 2026-10-15 T301: privacy text «Medición de visitas: apagada en esta versión» becomes wrong when Álvaro turns the switch on: new wording is Álvaro's call
- 2026-10-15 T301: unused `NEXT_PUBLIC_POSTHOG_*` variables on Vercel/Cloudflare can be removed (Álvaro); D-04 still says PostHog
- 2026-10-15 T298: Boia tip «mantenlo pulsado para moverlo» (es-zonas, es-mundo, es-juego, skins) was already wrong (long press opens the map); approved text, new wording is Álvaro's call
- 2026-10-15 T298: floating props on the open sea can dip ~0.4 units into a wave trough
- 2026-10-15 T300: security checklist: `private.award_points`, `merge_guest` and similar are granted to `authenticated` with a `p_user` parameter, safe only while `private` is not exposed
- 2026-10-15 T300: restoring a member reports any other unique clash (e.g. `artist_profile_id`) as `nickname_taken`
- 2026-10-15 T300: after prize amounts are `muestra` (Álvaro to confirm)

## Log
- 2026-10-15 T298 launched · attempt 1 · agent a77bbe2571cd5b3b3 (opus)
- 2026-10-15 T300 launched · attempt 1 · agent a51d8e80172ae1e65 (opus)
- 2026-10-15 T300 done · merged 65546bb
- 2026-10-15 T301 launched · attempt 1 · agent afec63d06fce2b83d (opus)
- 2026-10-15 T298 done · merged 005233d
- 2026-10-15 T299 launched · attempt 1 · agent a7876f109fdc35a73 (sonnet)
- 2026-10-15 T301 done · merged aee8ce0
- 2026-10-15 T299 agent done (ccbd8d1); Opus audit launched · agent a7f3547240d016578
- 2026-10-15 T302 launched · attempt 1 · agent a83a27b0615fc5c32 (sonnet)
- 2026-10-15 T299 done · merged 64078b8
- 2026-10-15 T302 Opus audit · agent acd8f8ae718f5b37b · fix-needed, fixed by the same agent (4065733)
- 2026-10-15 T302 done · merged 7359a2d
- 2026-10-15 T303 launched · attempt 1 · agent af5b685d1a7cb9b56 (sonnet)
- 2026-10-15 T303 Opus audit · agent af822fdad5908a010 · ok with minor fixes (0d4788f)
- 2026-10-15 T303 done · merged a9d0a6c
- 2026-10-15 T304 launched · attempt 1 · agent adc3c20208b4380e8 (haiku); may also edit one ESTADO.md sentence (T303) and the CLAUDE.md plan-status sentence
- 2026-10-15 T304 Opus audit · agent add1d286fc2c581ac · fix-needed, fixed (bfe0235)
- 2026-10-15 T304 done · merged ac71cfe
- 2026-10-15 plan done; push waits for Álvaro's hand test of the sea, then T300/T301 migrations to production
- 2026-10-15 T305 launched · attempt 1 · agent a1e5cf5c2d1b9e0c5 (opus)
- 2026-10-15 T305 done · merged 7e7099b; plan done again
