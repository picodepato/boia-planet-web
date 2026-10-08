# Plan 020 — Hernán's review after plan 019 and the meeting leftovers

Status: active
Created: 2026-10-08
Base branch: main
Goal: Apply Hernán's 13-point review after plan 019 (`docs/propuestas/2026-10-08-revision-hernan.md`: landing intro order, world fonts and buttons, HUD details, artists and store) and finish what plan 019 left open from the 2026-10-08 meeting (`docs/propuestas/2026-10-08-reunion-cambios.md`, plan 019 Proposals, plan 018 review leftovers): small UI and Admin fixes, Admin moderation and 30-day trash with real Supabase data, backups with Storage, the pending art (Puig Campana 2D, boia outline everywhere) and Las Calitas modelled in Blender.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`; ports 3215 and 3216 are taken); the machine is slow under load. **E2E policy (Hernán, 2026-10-08): Hernán runs the e2e himself.** Do not run the full e2e suite, ever. Run an e2e spec only when it is strictly necessary to check something you cannot check otherwise (then only that spec, `--workers=1`); prefer unit tests, screenshots and the Test command. Still update the e2e specs your change obviously breaks, and list in your ESTADO section which specs Hernán should run. The desktop «Los Rápidos» case in `mar-circuito.spec.ts` is a known flaky test: a failure there alone does not block you. Update the e2e specs your change breaks. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, images) stays `muestra` unless a decision below says otherwise. Never commit `apps/web/public/atlas/`, `.claude/launch.json`, `e*.log`, `reunion/`, `.github/workflows/supabase-keepalive.yml` or any `.env*` file other than `.env.example`. Never push or deploy. Supabase migrations: when a task needs one it writes it with the timestamp reserved for it below, plus its `test:supabase` tests, and lists in its ESTADO section what Hernán must apply on `boia-planet-dev` (after the 8 pending migrations of plans 017–019); the task never applies it to a real project. Supabase stays on the free plan of `boia-planet-dev`. Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **The Cañón's and the Castillo's game and balance do not change** (`SURVIVORS_CONFIG_VERSION` stays). The landing keeps its 200 kB gzip critical-path cap (D-26; today 195.9 kB). Fonts (plan 019): Upheaval titles / Press Start 2P buttons / 8-bit Operator+ body; square corners everywhere except intrinsically round shapes and the exception in decision 3 below. Blender: use Blender 5.2.2 LTS at `C:/Users/alvar/Blender/blender-5.2.2-windows-x64/blender.exe` (not on PATH; the pipeline was built with it; 4.0 in Program Files is too old for `render.py`). Screenshots for the final message go under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first; desktop where it adds something). Model: each task's `Model:` line says which agent runs it. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

Reserved migration timestamps: T229 `20261008200100`, T230 `20261008200200` (add `…201`, `…202` suffix steps if you need several).

Decisions of 2026-10-08 that every task follows (Hernán):
1. **Long names in the world** keep their text: lower the font size and let labels and buttons wrap to two lines. No short names.
2. **Island labels at sea** stay orange (BOIA orange is the accent). The «!» under the menu becomes BOIA orange too.
3. **Toggles** in the menu options (game sound, guide on/off…) are the only rounded thing: a pill track with a round knob. Exception to «no corners».
4. **Artists in the landing rotation** show the image of their Carnet BOIA (the one they chose when creating it); the rotation's «Pausar rotación» becomes «Ver todos los artistas» (link to /artistas).
5. **Store:** each product's photos are browsed by swiping sideways (touch and mouse/arrows). Products sold in hand (party-only) also point to Instagram (https://www.instagram.com/boia.planet/) to reserve.
6. **30-day trash with real data:** deleting a member or a party in Supabase mode is a soft delete; Admin's trash lists it and restores it; a purge removes it after 30 days.
7. **Las Calitas** gets a Blender model like the other islands, its 2D art for the map and its REQ in `docs/spec`.
8. **Galería collage** (Hernán's review, 2026-10-08): pieces of clearly different sizes, overlapping; hover and drag one aside to reveal the one under it; click opens it big. Same collage on /galeria, the landing photos block and the world's photo sheet.

## Tasks

## T226 — World UI: fonts, labels, buttons and HUD details
- Status: done
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: Fix every world (`/mar`) point of Hernán's review (2–9) plus the plan 018 leftover where «Menú» and «!» cover the race cards on mobile, so the world reads well at 390×844 and on desktop with the plan 019 fonts.
- Context: `docs/propuestas/2026-10-08-revision-hernan.md` §Mundo; decisions 1–3; `apps/web/app/mar/mar.css`, `app/mar/canon-hud.css`, `lib/mundo/hud.css`, `castillo-hud.css`, the world's labels/pins (`.mar-pin*`), the achievements counter, the Turbo control, the «!» guide button, the menu options panel (toggles, «Controles» button), Los Rápidos timer/boias HUD; plan 018 Proposals (`plans/018-presentacion-socios.md`, mobile race cards).
- Scope: may touch the world's CSS, HUD components and their i18n keys, world e2e specs / must not touch game logic or balance, the landing, Admin, art files.
- Done when:
  - at 390×844 no world label, popup title or button overflows the screen or its box (e.g. «Castillo de Santa Bárbara», «HALLOWEEN IN THE CLUB», «Puerto de Alicante»): long ones wrap to two lines → screenshots under the attach folder
  - achievements counter smaller; «Turbo» text centered; «!» in BOIA orange; Los Rápidos timer/boias sign back to a moderate size; menu toggles are pill + round knob; «Controles» centered inside its box; «Menú» and «!» no longer cover the race cards on mobile → screenshots mobile + desktop
  - ESTADO lists the world e2e specs Hernán should run
  - Test command → exit 0
- Outcome: world labels/buttons 10–11 px wrapping to 2 lines, pins kept on screen, smaller counter, centred Turbo, orange «!», smaller race timer, pill toggles, Controles centred, race cards beside Menú/! · 67295fe

## T227 — Landing intro, artists rotation and store
- Status: done
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: Make the landing intro always run in Hernán's order, apply the artists and store points (10–13) and fix the landing leftovers: «Ver todas» → /galeria and the dev 500 on `/api/art/landing/3d/manifest.json`.
- Context: review §Portada, §Artistas, §Tienda; decisions 4–5; `apps/web/app/(landing)/components/blocks.tsx` (hero, artists rotation, `PHOTOS_PAGE`), `components/hero-stills.tsx`, the globe/wordmark intro and its fallback, `lib/landing/hero-media.ts`, `lib/merchandise/` (`products.json`, `catalog-view.tsx`, `product-gallery.tsx`), `app/(landing)/tienda/page.tsx`, the artist carnet image (plan 019 T217: /artistas joins content artists with artist carnets), `/api/art` route; plan 019 Proposals (manifest 500, «Ver todas»).
- Scope: may touch the landing, its intro, the artists block, the store and its gallery, the `/api/art` route if the 500 comes from it, i18n, related e2e / must not touch the world, Admin, the event pages.
- Done when:
  - intro order on every load: globe first, then the 3D BOIA letters, then with a fade «Zarpar», «Consigue descuentos» and «Desliza»; no jump; same order on mobile and with the fallback → screenshots of the sequence (mobile + desktop + fallback)
  - landing artists rotation shows each artist's carnet image; the button reads «Ver todos los artistas» and opens /artistas → unit test or screenshot
  - store: product photos change by swiping sideways (touch, mouse drag, arrows); party-only products also show the Instagram reservation link → screenshots mobile
  - home «Ver todas» goes to /galeria; the manifest 500 is explained and fixed (or shown not to happen on main, with the cause written in ESTADO)
  - landing critical path ≤ 200 kB gzip → pass
  - Test command → exit 0
- Outcome: intro gated globe→3D letters→fade of buttons (also mobile/fallback), artists rotation with carnet images + «Ver todos los artistas», store swipe + Instagram for party-only, «Ver todas»→/galeria, manifest 500 = build over running dev · bd24b19

## T228 — Admin and content leftovers
- Status: done
- Depends on: T227
- Model: sonnet
- Skills: none
- Goal: Close the small leftovers from plans 018–019 outside the world UI: Admin banner, Admin nav at 1440 px, Filosofía editable from Admin, the Acuarela boat in the world's boat shop, `secretHint`, old event names in the seed, and the i18n-zonas generator.
- Context: `plans/018-presentacion-socios.md` Proposals and `plans/019-reunion-cambios.md` Proposals; `apps/web/lib/i18n/es-lib.ts:137` («demo sin login»), Admin nav CSS (`admin.css`), the Filosofía landing block and Admin content editor, the boat shop catalog (hide boats whose world is hidden), `secretHint` (find where it is defined; show it where it was meant or remove it), `supabase/seeds/20261003100100_economy.sql` («BOIA Halloween», «SONIDO» → «HALLOWEEN IN THE CLUB», «ALL DAY BOIA»), the i18n-zonas generator vs `docs/propuestas/textos-zonas.md`.
- Scope: may touch Admin pages/CSS/i18n, the landing Filosofía block only to read its text from content, the boat shop list, the seed, the generator and its generated files / must not touch the world HUD CSS (T226), the store/artists/intro (T227), migrations.
- Done when:
  - Admin banner no longer says «demo sin login» (text that matches today's Admin: local mode vs accounts); at 1440 px «Usuarios de administración» does not touch its column edge → screenshot
  - Filosofía is edited from Admin and shows on the landing → unit test or screenshot
  - the boat shop shows no Acuarela boat; `secretHint` used or removed; seed names updated
  - running the i18n-zonas generator leaves the generated files unchanged (`git diff --exit-code` after running it) → exit 0
  - Test command → exit 0
- Outcome: Admin banner explains local vs accounts, nav 250 px, Filosofía editable in Admin, hidden-world boats out of the shop, secretHint removed, seed names, i18n-zonas generator in sync · 2693302

## T229 — Admin moderation with accounts
- Status: running (attempt 1)
- Depends on: T228
- Model: opus
- Skills: none
- Goal: Close the moderation gaps with Supabase accounts: Admin can remove a single Carnet answer and an artist's music link without hiding the whole Carnet, and can edit an artist carnet's music link.
- Context: plan 019 Proposals (T217, T223); `docs/propuestas/2026-10-08-reunion-cambios.md` §9; Carnet answers and `set_artist_music` RPC (plan 019 T217), Admin moderation pages, the trash of changes built from the local audit log (T223); `docs/spec/` REQs on Admin moderation.
- Scope: may touch Admin moderation UI, carnet data access, a migration `20261008200100` (RLS-safe admin RPCs) with its `test:supabase` tests, local mode equivalents, i18n, specs / must not touch the trash for members/parties and backups (T230), landing, world.
- Done when:
  - local mode: Admin removes one Carnet answer and edits/removes an artist's music link; the change goes to the 30-day trash and can be undone → unit tests + screenshot
  - Supabase mode: the same through admin-only RPCs; non-admins are refused → `test:supabase` tests written (they run when Hernán applies the migration)
  - REQ in `docs/spec/estado.md` updated with its test; `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## T230 — 30-day trash for real data and backups with Storage
- Status: pending
- Depends on: T229
- Model: opus
- Skills: none
- Goal: With Supabase, deleting a member or a party becomes a soft delete restorable from Admin's trash and purged after 30 days (decision 6); the daily backup also saves the Storage files (photos, clips).
- Context: plan 019 T223 (trash of changes, `site_settings`, backup workflow GPG-encrypted with `SUPABASE_DB_URL` + `BACKUP_PASSPHRASE`, `docs/propuestas/2026-10-08-backups.md`), Admin members and parties pages, the Storage bucket from plan 017 (T189); free plan limits (no pg_cron guarantee: choose a purge that works on free, e.g. the daily workflow calls a purge RPC, and say so).
- Scope: may touch migration `20261008200200` (soft-delete columns, views/RLS hiding deleted rows, restore and purge RPCs) with `test:supabase` tests, Admin trash/members/parties, the backup workflow and its guide / must not touch Carnet moderation (T229), landing, world.
- Done when:
  - Supabase mode: deleting a member/party hides it everywhere, the trash lists and restores it, purge removes rows older than 30 days → `test:supabase` tests written
  - local mode keeps working (its trash unchanged) → unit tests pass; Admin specs listed for Hernán
  - the backup workflow also archives Storage objects (encrypted like the dump) and the guide says what Hernán must set → `actionlint` unavailable: YAML parses (`python3 -c "import yaml,sys;yaml.safe_load(open(sys.argv[1]))" <file>`) → exit 0
  - Test command → exit 0
- Outcome:

## T231 — Pending art: Puig Campana 2D and the boia outline everywhere
- Status: done
- Depends on: none
- Model: opus
- Skills: blender-modeling-workflow, blender-rendering-workflow, blender-asset-validation
- Goal: Finish the art plan 019 left half done: the 2D art of place `canon` shows Puig Campana instead of the Banyets fort, and the new boia (logo/mascot outline, `art/marca/boia-mascota.svg`) reaches the mascot boias inside the island GLBs (allday, faro, ultima), the 2D sprites and `art/boia-tutorial`.
- Context: plan 019 T220 (outline as inverted hull on 3D glTF boias) and T221 (`puigcampana.py`, `ID = "canon"`); `tools/blender/` (render.py, export scripts, check.py), `art/mundos/arcilla/canon/`, island GLBs and manifests; Blender 5.2.2 path in the notes.
- Scope: may touch `tools/blender/`, `art/` assets of these places/boias and their manifests / must not touch islands' gameplay, web code beyond asset references, Acuarela (leave its canon art as is or regenerate only if free).
- Done when:
  - `python3 tools/blender/check.py` → exit 0 with the updated GLBs
  - Arcilla `canon` 2D art shows Puig Campana; island boias and 2D sprites have the outline → contact sheet image under the attach folder
  - Test command → exit 0
- Outcome: Puig Campana 2D (Arcilla canon), ink outline on every island boia, 2D sprites and boia-tutorial; island tri cap 30k→36k · 110c7ce

## T232 — Las Calitas: island model, 2D art and REQ
- Status: running (attempt 1)
- Depends on: T231
- Model: opus
- Skills: blender-art-direction-intake, blender-modeling-workflow, blender-asset-validation, blender-iterative-refinement
- Goal: Model the comments island Las Calitas in Blender like the other islands, export its GLB, make its 2D map art, wire them in place of whatever placeholder it uses today, and add its REQ (decision 7).
- Context: plan 019 T222 (Las Calitas comments island, its place id and current placeholder), `tools/blender/` island modules (e.g. `puigcampana.py`), exporter and `check.py` budgets, `docs/spec/09-requisitos.md` + `docs/spec/estado.md`; Las Calitas is a real cove in Alicante (small beach between rocks): `muestra` look.
- Scope: may touch a new Blender module, its GLB/manifest/2D art, the world's island asset mapping for Las Calitas, `docs/spec/` (new REQ + estado row with its test) / must not touch comments logic, other islands, DECISIONES.
- Done when:
  - `python3 tools/blender/check.py` → exit 0 including Las Calitas within budget
  - `/mar` shows the new island model and its 2D art → screenshots + contact sheet under the attach folder
  - `python3 tools/spec/estado.py` → exit 0 with the new REQ HECHO and its test
  - Test command → exit 0
- Outcome:

## T234 — Galería: a real collage, also on the landing and in the world sheet
- Status: pending
- Depends on: T227
- Model: opus
- Skills: frontend-design
- Goal: Make the Galería read as a real collage (decision 8): clearly different sizes (some big, some small), pieces overlapping, slight tilt; hovering a piece and dragging it moves it aside and reveals the one underneath; clicking opens it big with the existing open/close animation. The landing photos block and the world's photo sheet use the same collage instead of the square grid.
- Context: plan 019 T216; `apps/web/app/(landing)/galeria/page.tsx`, `components/photo-galleries.tsx`, `components/media-collage.tsx` (open/close at ~l.349–403, `draggable={false}` at ~l.255), `lib/landing/collage-layout.ts` (spans 2–5 cols, ±9% offset, ±3.5° tilt, neighbour nudge), `collage.css`; landing block `components/blocks.tsx` `case 'photos'` (~l.324–364, plain `.photo-grid`), unused `PhotoGrid` in `photo-tile.tsx`; world sheet `app/mar/sheet.tsx` (~l.349, `mar.css` ~l.1652 square grid); sample photos in `packages/store/src/sample/content.ts` (~l.313–351, mostly square, no images: give the samples varied aspect ratios and real `muestra` images from existing project art so the collage is visible).
- Scope: may touch the collage component, layout and CSS, the Galería page, the landing photos block, the world sheet's photo grid, sample content, i18n, unit tests / must not touch Admin uploads, event pages beyond reusing the component, the world HUD (T226).
- Done when:
  - /galeria, the landing photos block and the world sheet show a collage with visibly mixed sizes and overlap (no uniform square grid) → screenshots mobile 390×844 + desktop under the attach folder
  - drag a piece aside (mouse and touch) reveals the one underneath; it stays inside the collage; click (without drag) opens it big; reduced motion respected → unit tests for the layout/drag logic + a short screenshot sequence
  - landing critical path ≤ 200 kB gzip → pass
  - Test command → exit 0
- Outcome:

## T233 — Close plan 020: test guide and status
- Status: pending
- Depends on: T226, T227, T228, T229, T230, T231, T232, T234
- Model: opus
- Skills: none
- Goal: Check the batch builds together, fix what the integration broke, and leave the test guide for Hernán, who runs the e2e himself.
- Context: this plan, ESTADO.md sections of T226–T232, `docs/propuestas/2026-10-08-plan-019-guia-prueba.md` as the model for the guide.
- Scope: may touch fixes for breakages between tasks, e2e specs, `docs/propuestas/2026-10-08-plan-020-guia-prueba.md`, `docs/spec/estado.md` / must not add features.
- Done when:
  - no full e2e run; the guide lists the e2e command and the specs touched by T226–T232 and T234 for Hernán to run
  - the guide lists what to try by hand per review point and the migrations (8 pending + T229/T230) in order for `boia-planet-dev`
  - Test command → exit 0
- Outcome:

## Decisions

- 2026-10-08 T226: labels/buttons in button font 10 px mobile, 11 px desktop/map; `layoutPins` takes screen width and keeps labels on screen; top cards right of Menú/! on mobile; open «!» panel turns the button cream with orange «!» (agent)
- 2026-10-08 T227: Zarpar hidden while the scene loads; 3D letters wait up to 1.2 s then flat title; reduced motion shows everything at once; avatars in colour on the landing; artists with a Carnet join the rotation (lazy); store auto-rotation stops after a swipe (agent)

- 2026-10-08 T228: Filosofía edited in Admin's home Filosofía block; nav column 220→250 px; hidden-boat filter derived from hidden worlds in the registry; unused `island.secretHint` removed (agent)

- 2026-10-08 T231: outline as own `<ink>_contorno` material with backface culling; island MAX_TRIS 30 000 → 36 000; 2D outline only for Arcilla; boia-tutorial = outlined mascot, 12 frames, `luz` anchor/`lamp_on` dropped (agent)

## Proposals (new scope)
- 2026-10-08 T231: `mundos/arcilla/mapa.json` still names the place «Isla del Cañón»; stale `sources_sha256` in other Arcilla place manifests; if ship boia GLBs are regenerated, check mascot-look.test.ts (`ink_gltf` prefix)
- 2026-10-08 T226: «Entradas» sub-line during a trip («Rumbo a Ca…») cut by the bottom bar's fixed height; music/effects in Ajustes still checkboxes, not toggles; 🪙 shows as a box in headless Chromium
- 2026-10-08 T227: give `next dev` its own distDir (`.next-dev`) so a build doesn't cause dev 500s; unused i18n keys artists.pause/resume; `prettier --check` reports 98 files (likely CRLF)

## Log
- 2026-10-08 T226 launched · attempt 1 · agent a1af4cc0049b2e952
- 2026-10-08 T227 launched · attempt 1 · agent aacd0a6b3f2b14530
- 2026-10-08 T226 done · merged 67295fe
- 2026-10-08 T227 done · merged bd24b19
- 2026-10-08 T228 launched · attempt 1 · agent afa5367486c5dba8d (sonnet)
- 2026-10-08 T231 launched · attempt 1 · agent aaa4a8350036c88cf
- 2026-10-08 T228 done · merged 2693302
- 2026-10-08 T229 launched · attempt 1 · agent a3711cff21d500e5e
- 2026-10-08 T231 done · merged 110c7ce
