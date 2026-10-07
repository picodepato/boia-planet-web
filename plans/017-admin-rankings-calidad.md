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

8. **Halloween and Sonido tickets** (Hernán, 2026-10-07). Pressing «Comprar entradas» on these two events shows, instead of the checkout: «Entradas sólo en taquilla, el mismo día. Enseña tu Carnet BOIA en la puerta y te descontamos 2 €.» and right below «¿Aún no tienes Carnet? Hazte el tuyo» with a button to the Carnet (texts `muestra`, by i18n key; the rule is per event, so other events keep their checkout).
9. **Admin sign-in with Carnet 000.** Carnet number **000** is the admin. Demo/local mode: sign in with Carnet 000 + a password (given to the task agent in its prompt; only a salted hash is committed, never the plain text). Supabase mode: Carnet 000 is the admin account and signs in with the password **plus the TOTP code**.
10. **Logout.** When signed in, a «Cerrar sesión» button at the top next to «Carnet», only on the landing page (never during a game or in /mar).
11. **Store.** Each landing store product rotates its images: the product alone, other angles, and worn by a model in a clean fashion-catalogue style; images invented by Codex, `muestra`, replaceable later from Admin. Pressing buy shows: «Sólo a la venta en la fiesta. Si quieres una, escríbenos por Instagram a @boia.planet» with a link to https://instagram.com/boia.planet.
12. **Sample posters.** Event posters invented by Codex for every event without one (`muestra`), so the page looks complete. No sample party photos: Hernán will provide the real event photos and upload them through T189's Admin (2026-10-07).

## Tasks

## T188 — Rankings menu: race, Cañón, Castillo and global, with the right dropdowns; no visible «Arcilla»
- Status: done
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
- Outcome: four tabs Carrera/Cañón/Castillo/Puntos in /mar menu and a new /ranking page linked from the landing header; Cañón dropdown Fantasma/Kraken, Castillo 9 boards; world shown as «Mundo principal», B05 «Botijo»; unit test guards against «Arcilla» returning · cbdf6aa

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
- Status: done
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
- Outcome: «Consigue descuentos» (`hero.explore.discountHint`) under Zarpar with a CSS-only glint every 8 s, off under reduced motion; landing 187.3 kB gzip; done by Codex + wrapper · 7635e98

## T193 — Account and Admin access: Carnet 000 sign-in, TOTP backup codes, data export
- Status: done
- Depends on: none
- Model: opus
- Goal: Admin sign-in through Carnet 000 (decision 9); one-time TOTP backup codes for the Supabase admin; a signed-in user can download all their account data (REQ-IDE-050) (decision 6).
- Context: plan 008 accounts and Admin TOTP (`docs/TRASPASO.md`, `ESTADO.md` T8x sections; grep `totp` and `carnet` in `apps/web` and `supabase/migrations`), the demo admin (`apps/web/app/admin/admin-app.tsx`), carnet member numbers from plan 016 (gap-free counter; Carnet 000 must stay reserved and never be handed to a member), the account/Carnet screens, REQ-IDE-050 in `docs/spec/05-identidad-y-comunidad.md`.
- Scope: may touch Admin sign-in (demo: Carnet 000 + password checked against a committed salted hash; Supabase: Carnet 000 is the admin account, password + TOTP), backup codes (generate, show once, store hashed, single use), the account export (JSON download of the user's own data), a migration `20261007100400_*` with its `test:supabase` tests, i18n, tests / must not touch other users' data, unrelated RLS, the logout button (T199).
- Done when:
  - unit tests: demo password check against the hash (right/wrong), Carnet 000 reserved from the member counter, backup codes single use, export contains only the user's own data and no secrets → pass
  - grep for the plain password in the worktree → no match
  - `E2E_PORT=<free> pnpm e2e <admin sign-in spec> <account export spec> --workers=1` in local mode → exit 0
  - the ESTADO section lists the migration and the commands Hernán runs on `boia-planet-dev`
  - Test command → exit 0
- Outcome: Admin sign-in with Carnet 000 (demo: PBKDF2 hash, 12 h session; Supabase: password + TOTP), 10 server-side backup codes in a new «Seguridad» section, account JSON export in both modes; Carnet 000 reserved by constraint + trigger; migration 20261007100400_admin_access_export; REQ-IDE-050 HECHO; no plain password in the repo (checked) · 0876bfa

## T190 — Admin: new object in 10 steps, templates and asset validation
- Status: done
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
- Outcome: new Admin «Objetos» section: 10-step flow, saved templates, asset validation (incl. land/water check against the /mar sea); objects and templates in local repo areas `worldObjects`/`objectTemplates`, drawn with their category model; REQ-ADM-010–012 HECHO · 140a366

## T191 — Admin: moderation of Carnets and the other sections with real data
- Status: done
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
- Outcome: Admin hides/restores Carnets (whole, nickname, avatar) and voids/restores ranking scores (race, Cañón, Castillo) with a reason; originals kept in `private.carnet_moderation`; migration 20261007100200_moderation; REQ-ADM-031 FALTA → PARCIAL · 2ead693

## T192 — Admin: editable store, contact and footer links
- Status: pending
- Depends on: T201
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
- Status: done
- Depends on: T188
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Fix the plan 008 gaps: ties at 0 points, the stamp's score and rank line, and the player's own bottle shown even when it is not among the 10 most recent (decision 6).
- Context: plan 008's Proposals (`plans/008-*.md`), `apps/web/lib/mundo/ranking-global.ts`, the ranking panel as left by T188, stamps (grep `sello`), bottles (grep `botella`, e2e `mar-botellas.spec.ts`), RPCs in `supabase/migrations/20261003100200_rankings.sql`.
- Scope: may touch ranking readers/tie rules, stamp score line, bottles list, a migration `20261007100500_*` if an RPC changes, tests / must not touch the ranking panel's structure from T188, the minigames.
- Done when:
  - unit tests for each of the three gaps → pass
  - `E2E_PORT=<free> pnpm e2e ranking.spec.ts mar-botellas.spec.ts <stamp spec> --workers=1` → exit 0
  - Test command → exit 0
- Outcome: 0-point members show «sin puntos» with no position (positive ties kept); both stamp flows show «Puntos a → b» and «Ahora eres …»; own active bottle listed even outside the 10 most recent; no RPC change, no migration; done by Codex + wrapper · 6ff41cf

## T195 — World texts into i18n
- Status: done
- Depends on: T188
- Model: sonnet
- Goal: Move the user-visible texts still hard-coded in the world (`skin.ts` dialogs, palette names, console messages shown to users) into `apps/web/lib/i18n/` keys, with no visible change (decision 7).
- Context: `packages/world/src/worlds/arcilla/skin.ts` (after T188 removed the visible world name), the i18n files and the existing `world.arcilla.*` keys, the i18n check in `tools/spec/` if any.
- Scope: may touch `skin.ts` and the code that reads its texts, i18n files, tests / must not change any visible text (except typos, listed in the final message), Acuarela.
- Done when:
  - `grep` for string literals in `skin.ts` shows only ids and non-visible values (report the command and its count)
  - `E2E_PORT=<free> pnpm e2e <specs that check world dialogs> --workers=1` → exit 0
  - Test command → exit 0
- Outcome: `skin.ts` holds i18n keys (new `world.arcilla.skin.*` in `es-mundo.ts`), resolved by `resolveSkinTexts`/`WorldRegistry.mapSkins`; web `worlds` = registry with keys resolved; resolved skin identical to the old dump · 7f634fe

## T197 — Lazy videos and the castle Ibiza card's real payout
- Status: done
- Depends on: none
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Two small user-visible fixes (decision 7): videos load lazily and never block the page (REQ-COM-032); the castle «Construir» Ibiza card shows the next Ibiza's real payout (70 % for the second, 50 % for the third), not the first one's.
- Context: REQ-COM-032 in `docs/spec/06-comercial.md` and `09-requisitos.md` (flagged provisional), video components (grep `<video` in `apps/web`); castle build UI (`apps/web/app/mar/castillo-hud.tsx`, grep `farmPayout` in `packages/engine/src/defense/`), plan 016 Proposals.
- Scope: may touch video components, the castle build card and its tests / must not touch castle balance or rules (`farmPayout` values stay), the landing hero (T187).
- Done when:
  - unit test: the card's payout for the 1st/2nd/3rd Ibiza equals `farmPayout` → pass
  - `E2E_PORT=<free> pnpm e2e mar-castillo.spec.ts <video page spec> --workers=1` → exit 0
  - Test command → exit 0
- Outcome: reusable `LazyVideo` (no content videos exist yet; e2e checks home and /fotos download no video; REQ-COM-032 → PARCIAL); Ibiza card shows 100/70/50 % via `defenseFarmPayout` on the Ibizas standing; done by Codex + wrapper · 6d89fd4

## T196 — Automated tests up to date
- Status: running (attempt 1)
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

## T199 — Halloween/Sonido box-office tickets and landing logout
- Status: running (attempt 1)
- Depends on: T187
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Halloween and Sonido «Comprar entradas» show the box-office message with the 2 € Carnet discount and the «Hazte el tuyo» link below (decision 8); a «Cerrar sesión» button next to «Carnet» at the top of the landing when signed in (decision 10).
- Context: the event buy flow (grep `Comprar entradas` / `buy` in `apps/web/lib/i18n/` and the event sheet/island purchase components, `packages/contracts/src/events.ts`), sample events Halloween and Sonido (grep `halloween`, `sonido` in the sample content), the landing header (grep the «Carnet» header link), sign-out in the account store (local and Supabase modes).
- Scope: may touch event contracts (a per-event «box office only» flag with the Carnet discount), the buy button/sheet in the landing and /mar, the landing header, i18n, tests / must not touch other events' checkout, the store (T201), Admin sign-in (T193).
- Done when:
  - unit tests: the flag only on Halloween and Sonido; logout visible only when signed in and only on the landing → pass
  - screenshots: Halloween buy message (mobile and desktop), landing header signed in → /tmp/orchestrator-attach/boia-planet-hernan-T199/
  - `E2E_PORT=<free> pnpm e2e <buy/event specs touched> <new logout spec> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T201 — Store: rotating product images and buy-at-the-party message
- Status: pending
- Depends on: T187
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Each landing store product rotates its images (alone, other angles, worn by a model, fashion-catalogue style), invented by Codex as `muestra`; pressing buy shows the Instagram message (decision 11).
- Context: the landing store block and product data (grep `tienda`, `store`, `product` in `apps/web/lib/landing`, `apps/web/lib/i18n/`, `packages/contracts/src/content.ts`), the 200 kB landing cap (images must load lazily, outside the critical path), `prefers-reduced-motion`.
- Scope: may touch product contracts (several images per product), the store block and its CSS, new image files under `apps/web/public/` (WebP, small), i18n, tests / must not touch the hero, other landing blocks, events' checkout.
- Done when:
  - each sample product has at least 3 images (alone, another angle, on a model) as WebP files; list them with sizes
  - landing weight check → still under 200 kB gzip
  - screenshots of the store (rotation, buy message) → /tmp/orchestrator-attach/boia-planet-hernan-T201/
  - `E2E_PORT=<free> pnpm e2e <store/landing specs> --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T202 — Sample event posters
- Status: pending
- Depends on: T189
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Every event without a poster gets one invented by Codex (`muestra`), so the page looks complete (decision 12). No party photos.
- Context: events' `posterUrl` and sample content (grep `posterUrl`, sample events), `docs/contenido-real.md` (real content goes under `apps/web/public/contenido/`; samples must stay marked `muestra`; the real Halloween poster is P19, Álvaro's).
- Scope: may touch sample content data, new poster files under `apps/web/public/` (WebP, sized for the web), tests / must not touch real content, Admin code, photos/albums, the landing hero.
- Done when:
  - every sample event has a poster; list the files and their total size
  - screenshots: posters on the landing and in an island's event sheet → /tmp/orchestrator-attach/boia-planet-hernan-T202/
  - `E2E_PORT=<free> pnpm e2e landing.spec.ts ciclo-evento.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T198 — Close plan 017
- Status: pending
- Depends on: T187, T188, T189, T190, T191, T192, T193, T194, T195, T196, T197, T199, T201, T202
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
- 2026-10-07 T195: keys resolved in `packages/world` (`resolveSkinTexts`) since it cannot import the web catalog; non-key values stay as written (Acuarela, Admin-edited texts); console calls are developer warnings, left alone; `arcilla.test.ts` name checks now assert keys (agent)
- 2026-10-07 T193: demo check PBKDF2-SHA-256 310k iterations, 16-byte salt, session mark `boia.admin.demo` 12 h with «Salir del Admin»; Playwright storageState pre-sets the demo session so existing /admin specs keep working; Supabase: `admin_sign_in_email(0)` returns the Carnet 000 account email (no service key on Vercel) → anyone typing 000 learns that email, agent recommends a dedicated admin account; email-code sign-in kept for other staff; backup codes ~50 bits each, salt + SHA-256, using one at aal1 deletes the lost TOTP factor; the admin's previous member number becomes a gap; conflicts with T190 resolved keeping both (agent)
- 2026-10-07 T194: «sin puntos» without position for 0-point members; stamp feedback «Puntos a → b» / «Ahora eres …» in `/sello` and the Carnet scanner; own bottle floats without duplicates; wrapper reverted Codex's edits to ESTADO.md and plans (agent)
- 2026-10-07 T190: objects/templates in new local repository areas with audit and trash, schemas in `packages/contracts`, no migration (Admin world still local, D-20); a published object goes at the end of the live map in every world, drafts never reach /mar; category only proposes defaults; links (ticket, achievement, reward, teleport) only in step 8; save checks land/water against the /mar sea (an island near the port otherwise broke `?ir=`); `.glb` kept as original, images get WebP 512/128 in T189's IndexedDB store; conflict with main in `admin-app.tsx` was imports only (agent)
- 2026-10-07 T191: hidden nickname/avatar replaced in the row («Miembro de BOIA <nº>», no avatar), original in `private.carnet_moderation`, trigger blocks re-saving removed content; a hidden Carnet is unreadable to the public via RLS; removing needs a reason, restoring does not and never resolves reports; one RPC pair `admin_void_score`/`admin_restore_score` for all boards (Castillo gets void columns, its ranking function skips voided rows); real Moderación screen shows real Carnets (demo list removed); T186's `member-numbers-sql.test.ts` narrowed to member-number/`save_profile` changes (agent)
- 2026-10-07 plan: T202 keeps only the sample posters; the techno sample photos are dropped, Hernán will upload the real event photos (Hernán)
- 2026-10-07 plan: Hernán added decisions 8–12 mid-plan; T193 now also does Carnet 000 Admin sign-in; new T199, T201, T202 (Codex); T192 after T201 (same store area); T198 depends on all (orchestrator)
- 2026-10-07 T188: the landing header had no ranking and lib/mundo/menu is never mounted → added «Ranking» to the header, opening a new `/ranking` page with the same panel; tabs «Carrera / Cañón / Castillo / Puntos» («De siempre» renamed to fit 390 px); race shows the circuit name, no dropdown; world display name «Mundo principal», /mar menu title omits the world when only one is playable; B05 «Botijo» (i18n, barcos.json, sample cosmetics, Supabase seed); Admin text «El puerto de salida (El Varadero).»; guest box on Cañón/Castillo boards shows the browser's own score and invites to sign in (agent)
- 2026-10-07 T187: line is a `<p>` after the Zarpar link (out of its accessible name); also listed in `docs/propuestas/textos-zonas.md`; wrapper restored the hero unit test title Codex had renamed (REQ-ENT-028 link check) (agent)
- 2026-10-07 T189: local files in IndexedDB as `local-photo:<id>` (new allowed `photoSchema.src` form); WebP q0.82, long side ≤1600 px, JPEG fallback; uploads ≤15 MB, short side ≥200 px; one album per event (`album-<eventId>`); upload links the event to the chosen island; «mark as past» on by default (finished, manual source); Supabase mode writes only to Supabase, the web overlays those rows on local content; DB types added by hand; REQ-AVE-014 and REQ-ADM-019 stay PARCIAL with new tests linked (agent)

## Proposals (new scope)
- 2026-10-07 T197: once real videos exist, use `LazyVideo` there and raise REQ-COM-032 to HECHO
- 2026-10-07 orchestrator: the repo `picodepato/boia-planet-web` is public and holds the demo Admin password's PBKDF2 hash; «boiaplanetadmin» is guessable offline → consider a longer password (new hash, never the plain text) or moving the hash to a Vercel env var
- 2026-10-07 T195: `packages/world/src/worlds/arcilla/map.ts` still has Spanish prose (object names, default dialogues)
- 2026-10-07 T193: apply `20261007100400_admin_access_export.sql` on boia-planet-dev and run `admin-access.supabase.ts`; use a dedicated email for the Carnet 000 account; `/admin/vista-previa` is not behind the Carnet 000 sign-in
- 2026-10-07 T190: uploaded assets are not drawn in the 3D sea (waits for the visual editor, REQ-ADM-009); in Supabase mode new objects still live in the browser like the rest of the Admin world
- 2026-10-07 T191: apply `20261007100200_moderation.sql` on boia-planet-dev, then `test:supabase` and `E2E_SUPABASE=1 … admin-real.spec.ts`; no per-answer moderation in Supabase; a voided Castillo score only comes back with a better score (`submit_castle_score` unchanged)
- 2026-10-07 T188: on boia-planet-dev the seeded cosmetics keep «Arcilla, maqueta / · Noche / · Fiesta» (seed only inserts) → needs a manual UPDATE; sample achievement «Entre dos mundos» still says «Navega en Arcilla y en Acuarela»; `art/barco/*manifest.json` labels still «Arcilla, maqueta» (overridden on screen); Supabase ranking e2e not run
- 2026-10-07 T189: Hernán applies `20261007100100_event_photos.sql` on boia-planet-dev, runs `db:types:dev` and `test:supabase` (new `event-photos.supabase.ts`) and tries an upload with `E2E_SUPABASE=1` (no Supabase e2e exists for it)
- 2026-10-07 T189: IndexedDB image files are not deleted when a photo is binned or Admin resets to sample; photos uploaded in Supabase mode do not show in the Admin's local photo list

## Log
- 2026-10-07 T188 launched · attempt 1 · agent abffc664e10cc9ab0 · opus
- 2026-10-07 T189 launched · attempt 1 · agent ae1b8fe9c7638eab9 · opus
- 2026-10-07 15:17 T189 done · branch worktree-agent-ae1b8fe9c7638eab9 · worktree .claude/worktrees/agent-ae1b8fe9c7638eab9 (folder left: node_modules) → 6a43553
- 2026-10-07 15:20 T187 launched · attempt 1 · Codex via wrapper agent a451969b9e40306b2 (sonnet)
- 2026-10-07 15:26 Hernán (Telegram, push offer T189): «Aplica subir en supabase» → `pnpm db:migrate:dev` applied 20261007100100 on boia-planet-dev; `db:types:dev` no diff; `test:supabase` 12 files / 98 tests pass; no Vercel push (not asked)
- 2026-10-07 Hernán (session): push → `git push origin main` 2e6576d..bdcaa11 (T189 deployed)
- 2026-10-07 15:46 T188 done · worktree-agent-abffc664e10cc9ab0 → cbdf6aa
- 2026-10-07 15:48 T187 done · worktree-agent-a451969b9e40306b2 → 7635e98
- 2026-10-07 15:52 T190 launched · attempt 1 · agent ac5abf7c0d1d9c934 · opus
- 2026-10-07 15:52 T191 launched · attempt 1 · agent a63e2c276f934cb44 · opus
- 2026-10-07 15:52 T193 and T192 held: Hernán asked for new Admin sign-in (Carnet 000 + password) and store changes; waiting for his answers
- 2026-10-07 16:17 T191 done · worktree-agent-a63e2c276f934cb44 → 2ead693
- 2026-10-07 16:18 T193 launched · attempt 1 · agent a2b88cd80a528a105 · opus (password only in the prompt)
- 2026-10-07 16:50 T190 done by agent; integration conflict in apps/web/app/admin/admin-app.tsx (with T191/T189) → sent back to the same agent
- 2026-10-07 16:27 T190 done · worktree-agent-ac5abf7c0d1d9c934 → 140a366
- 2026-10-07 16:28 T194 launched · attempt 1 · Codex via wrapper agent a27474a3113dfee95 (sonnet)
- 2026-10-07 T193 done by agent (no plain password in branch, checked); integration conflict in admin.css, i18n/es.ts (with T190) → sent back to the same agent
- 2026-10-07 16:50 T194 done · worktree-agent-a27474a3113dfee95 → 6ff41cf
- 2026-10-07 16:51 T195 launched · attempt 1 · agent a2c42b79cdbec13e7 · sonnet
- 2026-10-07 16:53 T193 done · worktree-agent-a2b88cd80a528a105 → 0876bfa
- 2026-10-07 16:54 T197 launched · attempt 1 · Codex via wrapper agent af6968fcadaace994 (sonnet)
- 2026-10-07 17:04 T195 done · worktree-agent-a2c42b79cdbec13e7 → 7f634fe
- 2026-10-07 17:05 T196 launched · attempt 1 · agent a466b0a4c1f831e79 · sonnet
- 2026-10-07 17:11 Hernán (session): push → `git push origin main` rejected 3 times by GitHub «Internal Server Error» (githubstatus: all operational; no large files in the 14 commits)
- 2026-10-07 17:21 T197 done · worktree-agent-af6968fcadaace994 → 6d89fd4
- 2026-10-07 17:23 T199 launched · attempt 1 · Codex via wrapper agent ac79cb33ef51d3d91 (sonnet)
