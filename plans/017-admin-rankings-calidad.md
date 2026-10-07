# Plan 017 — Discounts hook, rankings in the menu, Admin photos and tools, account, quality

Status: active
Created: 2026-10-07
Base branch: main
Goal: Batch chosen by Hernán on 2026-10-07. (1) The landing invites to sail with a short «Consigue descuentos» line under «Zarpar». (2) The menu's ranking shows everything: four options (race, Cañón, Castillo, global), with a dropdown only for the Cañón (2 boards) and the Castillo (9 boards), and no visible «Arcilla» left. (3) Admin: upload real photos to an island and mark its event as past, plus object creation tools, Carnet moderation and editable store/contact/footer links. (4) Account: data export, Admin TOTP backup codes and the plan 008 ranking/stamp gaps. (5) Quality: world texts into i18n, automated tests up to date, lazy videos, and the castle's Ibiza card showing its real payout.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. Balance sims run with `pnpm test:slow`. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T198 (the last full green run was in plan 015). UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, sounds) stays `muestra` unless a decision below says otherwise. Never commit `apps/web/public/atlas/`, `.claude/launch.json`, `e*.log` or any `.env*` file other than `.env.example`. Never push or deploy. Supabase migrations: when a task needs one it writes it with the timestamp reserved for it below, plus its `test:supabase` tests, and lists in its ESTADO section what Hernán must apply on `boia-planet-dev`; the task never applies it to a real project. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **The Cañón's and the Castillo's game and balance do not change** (`SURVIVORS_CONFIG_VERSION` stays; the castle bot winning at 100 % is intended, Hernán 2026-10-06). Model: each task's `Model:` line says which agent runs it; never Fable. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

Reserved migration timestamps: T189 `20261007100100`, T191 `20261007100200`, T192 `20261007100300`, T193 `20261007100400`, T194 `20261007100500` (use only yours; add `…101`, `…102` suffix steps if you need several).

Decisions of 2026-10-07 that every task follows (Hernán's answers):
1. **Landing hook.** Under the landing's «Zarpar» button, one short line: **«Consigue descuentos»** (`muestra`), with a subtle detail (a light shimmer or glint), never heavy animation; the landing stays under its 200 kB gzip critical-path cap (D-26).
2. **Ranking menu.** The menu's ranking has **four options: the race (Los Rápidos), the Cañón, the Castillo and the global points board**. Only the Cañón and the Castillo get a dropdown: the Cañón lists its **2 boards (Fantasma, Kraken)**; the Castillo lists its **9 boards (Tranquila, Normal, Tormenta × 5, 7, 10 min)**. The race has one circuit and no dropdown. Everything is viewable from the menu (web menu and /mar menu).
3. **No visible «Arcilla».** It is the main world, so every user-visible mention of the world name «Arcilla» goes (e.g. «Los Rápidos · Arcilla», «Botijo · Arcilla» → «Botijo», Admin texts). Internal ids (`arcilla`, `ARCILLA_WORLD_ID`, `world.arcilla.*` key prefixes, paths, file names) stay.
4. **Admin photos.** In Admin you pick an island and an event, **upload real image files** (resized to WebP) and the event becomes **past** (`finished`): the island shows it as a memory with its photo gallery (REQ-COM-005/006, D-23 point 7). Supabase mode: a new Storage bucket plus whatever tables photos/albums need, public read, staff write. Local mode: files kept in the browser. **No approval flag: what the Admin uploads is published** (Hernán); sample photos keep their `muestra` marking.
5. **Admin scope.** Object creation in 10 steps, templates and asset validation (REQ-ADM-010 to 012); moderation of Carnets and the other sections with real data (REQ-ADM-031); editing the store, contact and footer links without code (plan 007 proposal).
6. **Account scope.** Export/download of the account's data (REQ-IDE-050); TOTP backup codes for Admin; the plan 008 gaps: 0-point ties, the stamp's score and rank line, and the player's own bottle when it is not among the 10 most recent.
7. **Quality scope.** World texts out of `skin.ts` into i18n (dialogs, palette names, console messages); e2e for REQ-PRO-006 and REQ-MUN-009, the device matrix without the deleted 2D tests, `record.spec.ts`/`record-titulo.spec.ts` on the current «Zarpar», the flaky «guía: mover» e2e; lazy videos (REQ-COM-032); the castle «Construir» Ibiza card shows the next Ibiza's real payout (70/50 %).

## Tasks

## T188 — Rankings menu: race, Cañón, Castillo and global, with the right dropdowns; no visible «Arcilla»
- Status: running (attempt 1)
- Depends on: none
- Model: opus
- Goal: The menu's ranking panel offers four options (race, Cañón, Castillo, global points) and shows every board from the menu, with a dropdown only for the Cañón (Fantasma/Kraken) and the Castillo (9 boards) (decision 2); remove every user-visible «Arcilla» (decision 3).
- Context: `apps/web/lib/mundo/menu/sections/ranking.tsx` (`RankingPanel`, tabs `ranking-tab-circuito`/`ranking-tab-siempre`, `CircuitSelect` `ranking-circuito`, comment at ~l.626), `apps/web/app/mar/menu.tsx` (~l.175, `mar-ranking-abrir`), `apps/web/lib/mundo/ranking-global.ts` (l.100-129), `ranking-circuit.ts`, `ranking-canon.ts`, `ranking-castle.ts`, `apps/web/app/mar/canon-ranking.tsx` and `castillo-ranking.tsx` (reuse their board rendering), `packages/engine/src/defense/config.ts` (`DEFENSE_RUN_MINS`); world name: `packages/world/src/worlds/arcilla/skin.ts:123` (`name: 'Arcilla'`), `apps/web/lib/i18n/es-zonas.ts` (`world.arcilla.name`, `ship.b05.name`), `apps/web/lib/i18n/es-admin.ts` (~l.453); REQ-IDE-053, REQ-AVE-034, REQ-IDE-017, REQ-AVE-026–028; e2e `apps/web/e2e/ranking.spec.ts` and the specs that touch rankings (`mar-circuito`, `mar-canon`, `mar-castillo`, `mar-hud`, `comunidad`).
- Scope: may touch the ranking panel and its data readers (local and Supabase), i18n, the world's display name, the ranking e2e and unit tests, `docs/spec/estado.md` notes / must not touch the Cañón's or Castillo's game code, their in-game rankings' behaviour, Supabase migrations (none needed: RPCs `ranking_canon`/`ranking_castle` exist), internal `arcilla` ids.
- Done when:
  - screenshots of the menu ranking (desktop and mobile 390×844, web menu and /mar menu) showing the four options, the Cañón dropdown with 2 boards and the Castillo dropdown with 9, in local mode → saved under /tmp/orchestrator-attach/boia-planet-hernan-T188/
  - `grep -rn "Arcilla" apps/web/lib/i18n packages/world/src` → only comments or internal ids, no user-visible strings (list what remains in the final message)
  - `E2E_PORT=<free> pnpm e2e ranking.spec.ts mar-canon.spec.ts mar-castillo.spec.ts mar-circuito.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T189 — Admin: upload island photos and turn the event into a past one
- Status: done
- Depends on: none
- Model: opus
- Goal: From Admin, pick an island and an event, upload real image files (WebP, resized) and mark the event as past; the island then shows that event as a memory with its gallery, in local and Supabase modes (decision 4).
- Context: `packages/contracts/src/events.ts` (`eventSchema`, states, `EVENT_STATE_BEHAVIOR`), `packages/contracts/src/content.ts` (`photoSchema`, `albumSchema`), `apps/web/lib/admin/world.ts` (`eventIslands`, `islandEvent`, `islandMemories`), `apps/web/lib/mundo/place-panels.tsx` (`IslandPhotosLink`), `apps/web/app/admin/sections/photos.tsx` and `events.tsx`, `apps/web/app/admin/admin-app.tsx` (`ctx.repo.admin.upsert`), the existing Storage pattern `apps/web/app/api/admin/stamp-image/route.ts` + `apps/web/lib/admin/stamp-image.ts` + migration `20261003100600_admin_real.sql` (bucket `stamp-images`, 512×512 WebP, staff policies), `/fotos`; REQ-COM-005/006/031, REQ-AVE-014, REQ-AVE-022, REQ-ADM-019; D-23 points 6–7.
- Scope: may touch contracts (photos/albums: album ↔ event/island link), Admin photos/events sections, an upload API route, the island panel and `/fotos` gallery, a migration `20261007100100_*` (bucket + tables with RLS: public read, staff write) with its `test:supabase` tests, local-mode storage in the browser, i18n, tests, `docs/spec/estado.md` (new REQ notes if needed; never `DECISIONES.md`) / must not touch the 3D world geometry, ranking code, other Admin sections.
- Done when:
  - unit tests for the upload pipeline (resize/WebP, validation of type and size), the album/event link and `islandMemories` with photos → pass
  - `E2E_PORT=<free> pnpm e2e <new or updated admin-photos spec> <island memories spec> --workers=1` (local mode: upload a photo in Admin, mark the event past, open the island in /mar and see the memory with the photo) → exit 0
  - screenshots: Admin upload screen and the island's memory with its gallery → saved under /tmp/orchestrator-attach/boia-planet-hernan-T189/
  - Test command → exit 0
- Outcome: Admin uploads photos (WebP ≤1600 px, IndexedDB in local mode; bucket `event-photos` + tables `event_albums`/`event_photos` in migration 20261007100100) and marks the event finished; island memory shows 6 photos + «Ver las N fotos»; e2e admin-fotos + ciclo-evento green · 6a43553

## T187 — Landing: «Consigue descuentos» under «Zarpar»
- Status: pending
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Add the short line «Consigue descuentos» under the landing's «Zarpar» button with a subtle shimmer/glint, to invite people to sail (decision 1).
- Context: the landing hero (grep `hero.explore` in `apps/web/lib/i18n/es-web.ts` and `es-zonas-web.ts`, the hero component that renders it), D-26 (landing as scroll, 200 kB gzip cap; see `docs/TRASPASO.md`), the landing weight check (grep the 200 kB budget in `tools/` or tests), `prefers-reduced-motion` handling already in the landing.
- Scope: may touch the hero component, its CSS, i18n, landing tests and e2e / must not touch the landing's scroll/camera choreography, other landing blocks, `/mar`.
- Done when:
  - screenshots of the hero (desktop and mobile 390×844, plus reduced motion) → saved under /tmp/orchestrator-attach/boia-planet-hernan-T187/
  - the landing weight check → still under 200 kB gzip (report the new number)
  - `E2E_PORT=<free> pnpm e2e <landing specs that cover the hero> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T193 — Account: data export and Admin TOTP backup codes
- Status: pending
- Depends on: none
- Model: opus
- Goal: A signed-in user can download all their account data (REQ-IDE-050); Admin staff get one-time TOTP backup codes so losing the authenticator does not lock them out (decision 6).
- Context: plan 008 accounts and Admin TOTP (`docs/TRASPASO.md`, `ESTADO.md` T8x sections; grep `totp` and `carnet` in `apps/web` and `supabase/migrations`), the account/Carnet screens, REQ-IDE-050 in `docs/spec/05-identidad-y-comunidad.md`, Admin login flow (`/admin`, code + TOTP).
- Scope: may touch the account screen (export button, JSON download of the user's own data: Carnet, stamps, progress, bottles, rankings entries), Admin auth (generate, show once, store hashed, consume backup codes), a migration `20261007100400_*` with its `test:supabase` tests, i18n, tests / must not touch other users' data, RLS of unrelated tables, the local-mode guest flow beyond showing that export works there too (local data).
- Done when:
  - unit tests: export contents (own data only, no secrets), backup code generation/hash/single use → pass
  - `E2E_PORT=<free> pnpm e2e <account export spec> --workers=1` in local mode → exit 0
  - the ESTADO section lists the migration and the `test:supabase` / `E2E_SUPABASE=1` commands Hernán must run on `boia-planet-dev`
  - Test command → exit 0
- Outcome:

## T190 — Admin: new object in 10 steps, templates and asset validation
- Status: pending
- Depends on: none
- Model: opus
- Goal: Build REQ-ADM-010 (create a new world object in a guided 10-step flow), REQ-ADM-011 (templates) and REQ-ADM-012 (asset validation) in Admin (decision 5).
- Context: `docs/spec/07-admin.md` (REQ-ADM-010–012), `docs/spec/estado.md` rows, Admin world editor `apps/web/app/admin/sections/world.tsx`, `apps/web/lib/admin/world.ts`, world data in `packages/world`, contracts in `packages/contracts`.
- Scope: may touch Admin world sections, admin libs, contracts for templates, i18n, tests, `docs/spec/estado.md` / must not touch the 3D renderer's behaviour for existing objects, the minigames, Supabase migrations (local admin repository as today unless the REQ demands otherwise; if it does, stop and report as blocked).
- Done when:
  - unit tests for the step flow state, templates and each validation rule → pass
  - `E2E_PORT=<free> pnpm e2e <new admin-objeto spec> --workers=1` (create an object from a template through the 10 steps, see it in /mar) → exit 0
  - REQ-ADM-010–012 updated in `docs/spec/estado.md` with their test; `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## T191 — Admin: moderation of Carnets and the other sections with real data
- Status: pending
- Depends on: none
- Model: opus
- Goal: Admin can moderate Carnets (hide/restore a public Carnet, its name and avatar) and the other user-generated sections (bottles, ranking entries) with real Supabase data, per REQ-ADM-031 (decision 5).
- Context: `docs/spec/07-admin.md` (REQ-ADM-031), `apps/web/app/admin/real/` (`fiestas`, `botellas`, `socios`, `rankings.tsx`), plan 008 RLS migrations, `carnets` table, `docs/spec/estado.md`.
- Scope: may touch Admin real sections, moderation RPCs/policies in a migration `20261007100200_*` with `test:supabase` tests, public readers so hidden items disappear, i18n, tests / must not touch the minigames, ranking UI layout (T188 owns it), account export.
- Done when:
  - unit tests for moderation state and the public filters → pass
  - `E2E_PORT=<free> pnpm e2e admin-real.spec.ts <new moderation spec> --workers=1` (local/demo admin) → exit 0
  - the ESTADO section lists the migration and Supabase commands for Hernán
  - Test command → exit 0
- Outcome:

## T192 — Admin: editable store, contact and footer links
- Status: pending
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Admin edits the store, contact and footer links (labels and URLs) without code; the web reads them (plan 007 proposal, decision 5).
- Context: plan 007's proposal in `plans/007-*.md` Proposals and `docs/TRASPASO.md`; the footer and contact components (grep footer / `tienda` / `contacto` in `apps/web`), Admin sections, the local admin repository.
- Scope: may touch Admin (a new «Enlaces» section or inside an existing settings section), the footer/contact/store readers, contracts, a migration `20261007100300_*` only if Supabase mode needs a table, i18n, tests / must not touch the landing hero (T187), other Admin sections.
- Done when:
  - unit tests (URL validation, defaults when unset) → pass
  - `E2E_PORT=<free> pnpm e2e <new admin-enlaces spec> --workers=1` (edit a footer link in Admin, see it on the web) → exit 0
  - Test command → exit 0
- Outcome:

## T194 — Ranking and stamp gaps from plan 008
- Status: pending
- Depends on: T188
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Fix the plan 008 gaps: ties at 0 points, the stamp's score and rank line, and the player's own bottle shown even when it is not among the 10 most recent (decision 6).
- Context: plan 008's Proposals (`plans/008-*.md`), `apps/web/lib/mundo/ranking-global.ts`, the ranking panel as left by T188, stamps (grep `sello`), bottles (grep `botella`, e2e `mar-botellas.spec.ts`), RPCs in `supabase/migrations/20261003100200_rankings.sql`.
- Scope: may touch ranking readers/tie rules, stamp score line, bottles list, a migration `20261007100500_*` if an RPC changes, tests / must not touch the ranking panel's structure from T188, the minigames.
- Done when:
  - unit tests for each of the three gaps → pass
  - `E2E_PORT=<free> pnpm e2e ranking.spec.ts mar-botellas.spec.ts <stamp spec> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T195 — World texts into i18n
- Status: pending
- Depends on: T188
- Model: sonnet
- Goal: Move the user-visible texts still hard-coded in the world (`skin.ts` dialogs, palette names, console messages shown to users) into `apps/web/lib/i18n/` keys, with no visible change (decision 7).
- Context: `packages/world/src/worlds/arcilla/skin.ts` (after T188 removed the visible world name), the i18n files and the existing `world.arcilla.*` keys, the i18n check in `tools/spec/` if any.
- Scope: may touch `skin.ts` and the code that reads its texts, i18n files, tests / must not change any visible text (except typos, listed in the final message), Acuarela.
- Done when:
  - `grep` for string literals in `skin.ts` shows only ids and non-visible values (report the command and its count)
  - `E2E_PORT=<free> pnpm e2e <specs that check world dialogs> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T197 — Lazy videos and the castle Ibiza card's real payout
- Status: pending
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Two small user-visible fixes (decision 7): videos load lazily and never block the page (REQ-COM-032); the castle «Construir» Ibiza card shows the next Ibiza's real payout (70 % for the second, 50 % for the third), not the first one's.
- Context: REQ-COM-032 in `docs/spec/06-comercial.md` and `09-requisitos.md` (flagged provisional), video components (grep `<video` in `apps/web`); castle build UI (`apps/web/app/mar/castillo-hud.tsx`, grep `farmPayout` in `packages/engine/src/defense/`), plan 016 Proposals.
- Scope: may touch video components, the castle build card and its tests / must not touch castle balance or rules (`farmPayout` values stay), the landing hero (T187).
- Done when:
  - unit test: the card's payout for the 1st/2nd/3rd Ibiza equals `farmPayout` → pass
  - `E2E_PORT=<free> pnpm e2e mar-castillo.spec.ts <video page spec> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T196 — Automated tests up to date
- Status: pending
- Depends on: T187
- Model: sonnet
- Goal: Bring the e2e suite and its docs up to date (decision 7): e2e that name REQ-PRO-006 and REQ-MUN-009; the device matrix without rows citing deleted 2D tests; `record.spec.ts` and `record-titulo.spec.ts` on the current «Zarpar»; the flaky «guía: mover» e2e made stable.
- Context: `docs/spec/estado.md` (REQ-PRO-006, REQ-MUN-009 rows), the device matrix doc (grep `matriz` in `docs/`), `apps/web/e2e/record*.spec.ts`, the «guía: mover» spec (grep `guía: mover` / `guia` in `apps/web/e2e`), plan 016 Proposals.
- Scope: may touch e2e specs, test helpers, the matrix doc, `docs/spec/estado.md` / must not change app behaviour (if a test reveals a real bug, report it in OUT OF SCOPE instead of fixing it).
- Done when:
  - «guía: mover» spec passes 5 runs in a row: `E2E_PORT=<free> pnpm e2e <that spec> --repeat-each=5 --workers=1` → exit 0
  - `E2E_PORT=<free> pnpm e2e record.spec.ts record-titulo.spec.ts <new REQ specs> --workers=1` → exit 0
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## T198 — Close plan 017
- Status: pending
- Depends on: T187, T188, T189, T190, T191, T192, T193, T194, T195, T196, T197
- Model: opus
- Goal: Run the full e2e, fix what this plan broke (small fixes only; report anything bigger), update docs and write the try-it guide for Hernán.
- Context: every task's ESTADO section and Outcome in this plan; `docs/TRASPASO.md`, `docs/spec/estado.md`; previous guide `docs/propuestas/2026-10-06-castillo-v3-guia-prueba.md` as format.
- Scope: may touch docs, small fixes in code this plan changed, tests / must not add features.
- Done when:
  - `E2E_PORT=<free> pnpm e2e --workers=2` → exit 0 (or every failure explained as pre-existing flake with a passing rerun of that spec)
  - `docs/propuestas/2026-10-07-plan-017-guia-prueba.md` written (what changed, how to try it, the migrations Hernán must apply on `boia-planet-dev` and production, open questions)
  - `docs/TRASPASO.md` and `docs/spec/estado.md` updated; `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-07 T189: local files in IndexedDB as `local-photo:<id>` (new allowed `photoSchema.src` form); WebP q0.82, long side ≤1600 px, JPEG fallback; uploads ≤15 MB, short side ≥200 px; one album per event (`album-<eventId>`); upload links the event to the chosen island; «mark as past» on by default (finished, manual source); Supabase mode writes only to Supabase, the web overlays those rows on local content; DB types added by hand; REQ-AVE-014 and REQ-ADM-019 stay PARCIAL with new tests linked (agent)

## Proposals (new scope)
- 2026-10-07 T189: Hernán applies `20261007100100_event_photos.sql` on boia-planet-dev, runs `db:types:dev` and `test:supabase` (new `event-photos.supabase.ts`) and tries an upload with `E2E_SUPABASE=1` (no Supabase e2e exists for it)
- 2026-10-07 T189: IndexedDB image files are not deleted when a photo is binned or Admin resets to sample; photos uploaded in Supabase mode do not show in the Admin's local photo list

## Log
- 2026-10-07 T188 launched · attempt 1 · agent abffc664e10cc9ab0 · opus
- 2026-10-07 T189 launched · attempt 1 · agent ae1b8fe9c7638eab9 · opus
- 2026-10-07 15:17 T189 done · branch worktree-agent-ae1b8fe9c7638eab9 · worktree .claude/worktrees/agent-ae1b8fe9c7638eab9 (folder left: node_modules) → 6a43553
