# Plan 023 — Radio genres, mobile polish, shop products, gallery, carnet discovery, the Explanada island, Supabase migrations

Status: active
Created: 2026-10-09
Base branch: main
Goal: Hernán's list of 2026-10-09 (relaying Álvaro). (1) Radio: create and rename genres from the admin, add songs to them, and a genre bar that scrolls sideways when there are many. (2) Mobile landing polish: the hero «Música» button becomes icon-only and sits further into the right corner; the header's menu / entradas / sound buttons shrink next to the BOIA wordmark; the shop carousel rotates every 2 s. (3) Find why desktop shows «All Day BOIA» as the next event while mobile shows Halloween, and fix it. (4) Shop: the handmade tote bag by Manu Ropero (30 €, 4 photos) and the real T-shirt (18 €, cotton 220 g, 3 photos). (5) Four gallery photos to see how they look. (6) «Descubre» buttons under the carnet answers (own carnet and artist profile). (7) The unnamed island on the right is remodelled in Blender as Alicante's Explanada promenade (stays unnamed). (8) Apply every pending Supabase migration to `boia-planet-dev`. (9) Test guide.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 022 (`plans/022-pulido-deuda-spec.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/`, `.github/workflows/supabase-keepalive.yml` or `.env*` (except `.env.example`), never push or deploy, never edit `docs/DECISIONES.md`, local mode (D-20) keeps working, UI strings by key in `apps/web/lib/i18n/`. **Supabase migrations are never applied to any remote project except by T253**, which applies them to `boia-planet-dev` only (Hernán, 2026-10-09). **E2E policy (Hernán): Hernán runs the e2e himself.** Never run the full suite; run one spec only when strictly necessary; update the specs your change obviously breaks and list in your ESTADO section which ones Hernán should run. The landing keeps its 200 kB gzip critical-path cap (D-26): nothing new enters the landing's critical path. Screenshots under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first, then desktop). Input images from Hernán are staged (untracked) in `C:\Users\alvar\Documents\CODIGOS\boia-planet-hernan\output\plan023-input\`: read them from that absolute path, convert/resize into the repo, never commit `output/`. Model: each task's `Model:` line. Skills: only those named in the task.

Content given by Hernán/Álvaro in this plan (prices, maker, photos) is real and may replace `muestra` values where the task says so; everything else stays `muestra`.

## Tasks

## T246 — Radio: create and rename genres from the admin, sideways-scrolling genre bar
- Status: done
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: From the admin radio section, staff can (a) create a new genre, (b) rename an existing genre, and (c) upload/assign songs to any genre, new ones included. In the player, when the genres do not fit, the genre bar scrolls horizontally (touch swipe, trackpad/shift-wheel, and visible affordance such as edge fade or arrows; the active genre scrolls into view). Works in local mode (D-20, browser storage) and Supabase mode.
- Context: `apps/web/app/admin/sections/radio.tsx`, `apps/web/lib/radio/catalog.ts`, `muestra.json`/`muestra.ts`, `apps/web/lib/radio/ui/radio-window.tsx:265-281` (`.radio-genres`) and `radio-window.css`, `supabase/migrations/20261009100100_radio.sql` (`radio_genres`, `radio_songs`). If RLS/policies or columns (slug, sort order) are missing for insert/update of genres, add a **new** migration (do not edit the old one) with a pgTAP/`test:supabase`-style test like its siblings. Renaming keeps the genre id so its songs stay attached. Genre names validated (non-empty, unique, length cap); delete is out of scope.
- Scope: may touch the admin radio section, radio catalog/store code, radio window UI/CSS, i18n keys, a new migration + its test, unit tests / must not touch the landing outside the radio, `/mar` scene.
- Done when:
  - unit tests: create genre, rename genre (songs keep their genre), add a song to a new genre, in local mode → pass
  - screenshots: admin with a new genre created and one renamed; mobile player with 8+ genres scrolled sideways → saved in the attach folder
  - new migration (if any) listed in the ESTADO section for T253
  - Test command → exit 0
- Log: 2026-10-09 launched attempt 1, agent a1d255d246699de32
- Outcome: create/rename already worked (plan 022); added preselect of new genre, clear name errors, sideways genre bar with edge fades/arrows; no new migration · d1554c2

## T247 — Mobile landing polish: icon-only music button, smaller header buttons, 2 s shop carousel
- Status: running (attempt 1)
- Depends on: none
- Model: haiku
- Skills: none
- Goal: (a) The hero radio button (`variant="hero"`, label «Música») shows only the icon on mobile, same look as the header copy, and sits further into the bottom-right corner (respect safe-area insets, never cover the tickets CTA). (b) On mobile, the header's menu, «Entradas», sound and radio buttons shrink so they look proportionate to the BOIA wordmark (30 px): reduce height/padding/font but keep touch targets ≥ 40×40 via hit area. Desktop unchanged. (c) The shop product gallery rotates every 2000 ms instead of 3500 (`PRODUCT_ROTATION_MS`).
- Context: `apps/web/lib/radio/ui/radio-button.tsx`, `radio-mount.tsx:127`, `radio.css` (~14, 106-139), `apps/web/app/(landing)/components/site-header.tsx`, `landing.css` (~100, 201, 292, 333, 1625), `apps/web/lib/merchandise/rotation.ts:2`.
- Scope: may touch those files, their tests and related e2e specs / must not touch the radio window, `/mar`, products data.
- Done when:
  - unit test asserts `PRODUCT_ROTATION_MS === 2000`
  - screenshots mobile 390×844: landing top with the icon-only music button in the corner, header with the smaller buttons; desktop header unchanged → attach folder
  - the hero button keeps an accessible name (aria-label from i18n)
  - Test command → exit 0
- Log: 2026-10-09 launched attempt 1, agent a68c40a408317c897
- Outcome:

## T248 — «Próximo evento»: desktop shows All Day, mobile shows Halloween
- Status: pending
- Depends on: none
- Model: opus
- Skills: none
- Goal: Find the real cause and fix it so desktop and mobile always show the same next event (with today's sample data: «HALLOWEEN IN THE CLUB», 2026-10-31, pinned). Likely cause from the survey: `live-landing.tsx` + `lib/landing/use-live-home.ts` render the sample first and then swap in the repository data; in local mode (D-20) each browser keeps its own stored home/events, so an older stored copy without the Halloween pin (or with an invalid pin) falls back to the first purchasable event (All Day). Confirm by reproducing (fresh profile vs a profile with older stored data, desktop vs mobile viewport). Fix at the root: e.g. stored local data from an older sample version is upgraded/re-seeded, or a stale pin no longer wins, without wiping data a user created in admin. Explain the cause in one paragraph in the ESTADO section, in plain words for Hernán.
- Context: `apps/web/lib/landing/resolve.ts` (`shownPriorityEvent`, `resolveTicketsPanel`), `packages/contracts/src/events.ts:237` (`resolvePriorityEvent`), `packages/store/src/sample/content.ts:74,133-164`, `apps/web/app/(landing)/components/blocks.tsx:232-241`, `event-card.tsx`, `live-landing.tsx`, `use-live-home.ts`, the local-mode store and its versioning.
- Scope: may touch landing data resolution, local store seeding/versioning, their tests / must not touch Supabase migrations, the sample event dates.
- Done when:
  - a unit test reproduces the stale-local-data case and now resolves Halloween
  - screenshots desktop and mobile both showing Halloween as next event → attach folder
  - Test command → exit 0
- Log: 2026-10-09 launched attempt 1, agent addce0faf3cab6fc7
- Log: 2026-10-09 pushed to Vercel on Hernán's yes (98465cf)
- Outcome: cause = desktop browser kept pre-2-Oct admin edits of the sample (pin on All Day Primavera); new SAMPLE_CONTENT_REVISION reseeds sample events/homeBlocks once on load, keeping admin-created items · 78fac36

## T249 — Shop: Manu Ropero's tote bag and the real T-shirt
- Status: done
- Depends on: none
- Model: haiku
- Skills: none
- Goal: (a) New product **Tote bag BOIA**: 30 €, handmade by **Manu Ropero**, images in this order: `tote-1-bolsa` (bag alone, first/cover), `tote-2-modelo-ella`, `tote-3-modelo-el` (models), `tote-4-llena` (full bag). Show the maker («Hecha a mano por Manu Ropero») — add an optional `maker` field to the product contract and render it under the name (i18n key for the prefix). (b) The existing `camiseta` product becomes the real T-shirt: 18 €, «Algodón 220 g», images `camiseta-1-plano`, `camiseta-2-arena`, `camiseta-3-negra`; description mentions white, sand or black; sale mode stays as now (reserve). Remove the old sample T-shirt image if nothing else uses it. Convert images to webp sized like the existing shop images (max ~1200 px, reasonable quality) into `apps/web/public/contenido/tienda/`, with good Spanish alt texts. Product copy may be short and plain; prices and maker are real.
- Context: `apps/web/lib/merchandise/products.json`, `packages/contracts/src/merchandise.ts`, `apps/web/lib/merchandise/product-gallery.tsx`, the home «store» block (lists product ids — add the tote there and wherever the /mar shop island lists products), inputs in `output/plan023-input/`.
- Scope: may touch merchandise data/contract/rendering, shop images, i18n, tests / must not touch `rotation.ts` (T247), the 3D shop island model.
- Done when:
  - contract test: `maker` optional, tote parses with 4 images and `priceCents: 3000`, camiseta `priceCents: 1800`
  - screenshots mobile + desktop of the shop showing both products → attach folder
  - Test command → exit 0
- Log: 2026-10-09 launched attempt 1, agent a327df7913e6d2e98
- Outcome: new product `tote-boia` (30 €, maker Manu Ropero, 4 photos, sale `party`), camiseta real 18 € with 3 photos, optional `maker` field + `store.maker.prefix`; old sample T-shirt images removed · 7ccc130

## T250 — Gallery: Hernán's 4 photos
- Status: done
- Depends on: none
- Model: haiku
- Skills: none
- Goal: Add the 4 photos (`galeria-1..4` in `output/plan023-input/`) to the sample gallery so Hernán can see how they look. `galeria-3` (France shirt) has a round Google Lens icon in the bottom-left corner: crop it out cleanly. Keep them marked `muestra` (rights pending Álvaro's OK, especially `galeria-4`, an album cover). Process them like the existing gallery photos (`tools/galeria/fotos.mjs`, `art/galeria/<id>.webp`, `SAMPLE_PHOTOS` in `packages/store`), with Spanish alt texts.
- Context: `apps/web/app/(landing)/galeria/page.tsx`, `lib/landing/eventos.ts` (`photoGalleries`), `components/photo-galleries.tsx`, `packages/store` sample photos.
- Scope: may touch sample gallery data, `art/galeria/`, gallery tooling, tests / must not touch `event_photos` migrations.
- Done when:
  - the 4 photos appear in /galeria (screenshots mobile + desktop, plus the cropped galeria-3 alone) → attach folder
  - Test command → exit 0
- Log: 2026-10-09 launched attempt 1, agent a1791bdcbfddf0848
- Outcome:

## T251 — Carnet: «Descubre» buttons under the answers
- Status: pending
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: (a) On «Mi carnet», right under the answers, a button «Descubre otro miembro BOIA» opens a random carnet (any artist or member with a public carnet, never your own). (b) On an artist's profile, under their answers, two buttons: «Descubre un artista» (random artist, not this one) and «Descubre otro miembro BOIA» (random member/artist carnet). Reuse the random pick already behind the ranking's «🔎 Descubrir a un BOIERO» (`lib.ranking.descubrir*` keys) — extract a shared helper if needed, no behaviour change there. Same look as those buttons. Empty case: show the existing «Aún no hay Carnets que descubrir.» message. Works in local mode and Supabase mode.
- Context: `apps/web/app/carnet/page.tsx`, `carnet-page.tsx`, `apps/web/app/carnet/[id]/page.tsx`, `apps/web/lib/mundo/carnet/carnet-card.tsx:144-154`, `apps/web/app/artista/[code]/page.tsx`, `lib/artists/registered.ts`, `lib/mundo/carnet/public-carnet.ts`, the ranking component using `lib.ranking.descubrir` (search `es-lib.ts:10-13` keys).
- Scope: may touch carnet and artist pages, the shared random helper, ranking (only to extract the helper), i18n, tests / must not touch migrations unless strictly needed (then a new one, listed for T253).
- Done when:
  - unit tests for the random pick: excludes self / current artist, artist-only filter, empty pool
  - screenshots mobile + desktop: own carnet with the button, artist profile with the two buttons → attach folder
  - Test command → exit 0
- Outcome:

## T252 — /mar: the unnamed right-hand island becomes the Explanada de Alicante
- Status: pending
- Depends on: none
- Model: fable
- Skills: blender-modeling-workflow, blender-asset-validation
- Goal: Remodel the unnamed island on the right of the Arcilla map, in Blender, as Alicante's **Explanada de España** promenade: the wavy red/cream/black marble mosaic paving (the signature wave pattern), a double row of palm trees, benches and lamp posts, the sea wall/balustrade along the water, optionally the pergola/bandstand. Keep the low-poly clay style of the other islands, the same footprint/position and collision radius, and the island stays **unnamed** (no label). Same pipeline as the others: a module in `tools/blender/islas/`, exported with `tools/blender/export_islas_glb.py` to `art/islas/3d/*.glb` + `manifest.json`, plus the hand-built far/fallback version in `apps/web/app/mar/engine/islands.ts` updated to match the silhouette. Respect the existing GLB size/triangle budget of comparable islands.
- Context: island: the one in Hernán's mobile screenshot `output/plan023-input/isla-explanada-captura.png` (absolute path under the main checkout): the island right in front of the boat, below the «Puerto de Alicante» label, today with white houses, palms, lamp posts and a small red/cream/black wave strip on the sand. Identify its id in `mundos/arcilla/mapa.json` / `islands.ts` first and write it in the ESTADO section; if it has a name label anywhere, remove it. `apps/web/app/mar/engine/island-models.ts`, `islands.ts`, `tools/blender/islas/*`, `tools/blender/export_islas_glb.py`, `mundos/arcilla/mapa.json`, `/api/art/islas/3d`.
- Scope: may touch that island's Blender module, its GLB/manifest entry, its fallback composition, tests / must not touch other islands, map layout, the Cañón/tower-defense games.
- Done when:
  - blender export runs and the asset validation (multiview renders, tri count, materials) passes → renders in the attach folder
  - in-game screenshots from the boat, near (GLB) and far (fallback), mobile + desktop → attach folder
  - Test command → exit 0
- Outcome:

## T253 — Supabase: apply every pending migration to boia-planet-dev
- Status: pending
- Depends on: T246, T251, T255
- Model: opus
- Skills: none
- Goal: Apply, in order, the 11 pending migrations listed in `docs/propuestas/2026-10-09-plan-022-guia-prueba.md` §Migraciones plus any new ones from T246/T251, to the **dev** project `boia-planet-dev` only, using `pnpm db:migrate:dev`, then `pnpm db:types:dev` and `pnpm test:supabase`. Before migration 8 (`20261008100600_admin_limits_analytics`) check `staff_roles` has at most 2 admin/owner rows; if not, stop and report (do not delete rows). First check which ones are already applied (migration history table) and skip those. If one fails: stop there, do not hand-edit remote state, report the error and the exact list applied / not applied — the rest is left for the next plan. Commit regenerated types if they changed. Update the guide's migration list with the new state. Never print secrets; read `SUPABASE_DB_URL` etc. from `apps/web/.env.local` (copied by `.worktreeinclude`).
- Context: root `package.json` scripts (`db:migrate:dev`, `db:types:dev`, `test:supabase`, via `@boia/db`), `supabase/migrations/`, the guide above.
- Scope: may touch generated DB types, the guide's migration section, ESTADO / must not touch production, existing migration files, app code.
- Done when:
  - per-migration result table (applied / skipped already / failed + error) in the ESTADO section
  - `pnpm test:supabase` → exit 0 (or the failure reported verbatim if a migration stopped the run)
  - Test command → exit 0
- Outcome:

## T254 — Test guide for Hernán
- Status: pending
- Depends on: T246, T247, T248, T249, T250, T251, T252, T253, T255
- Model: haiku
- Skills: none
- Goal: Write `docs/propuestas/2026-10-<dd>-plan-023-guia-prueba.md` in Spanish: what changed per task, how to try each one on mobile and desktop (with the screenshots' paths), the next-event explanation from T248, the migration table from T253, the e2e specs Hernán should run, and open questions for Álvaro (gallery photo rights, tote/T-shirt copy). Update `docs/spec/estado.md` for any REQ these tasks raise.
- Context: ESTADO sections T246–T253, previous guide `docs/propuestas/2026-10-09-plan-022-guia-prueba.md` as format model.
- Scope: docs only.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## T255 — Radio: change a song's genre, delete genres, songs without genre
- Status: running (attempt 1)
- Depends on: T246
- Model: opus
- Skills: none
- Goal: Hernán (2026-10-09, after T246): in Admin › Radio, (a) every song can be (re)assigned to any genre from its row, or left **without genre**; (b) a genre can be **deleted** (confirm dialog saying how many songs it has; its songs become genre-less, never deleted); (c) songs without genre show only under «Todos» in the player (and in an admin filter «Sin género»). Works in local mode and Supabase mode.
- Context: T246 (d1554c2) — `apps/web/app/admin/sections/radio.tsx`, `apps/web/lib/radio/catalog.ts`, radio store code, `radio-window.tsx`, `@boia/contracts` radio schema; `supabase/migrations/20261009100100_radio.sql` has `radio_songs.genre_id text not null references radio_genres on delete restrict` and grants `update (title, artist, genre_id)` and no genre delete: add a **new** migration making `genre_id` nullable with `on delete set null`, granting/policying genre delete to staff, plus its test like its siblings; list it in the ESTADO section for T253.
- Scope: may touch radio admin, radio catalog/store/contracts, radio window, i18n, new migration + test, unit tests / must not touch other admin sections, the landing outside the radio.
- Done when:
  - unit tests (local mode + fake Supabase client): reassign a song's genre, set it to none, delete a genre → its songs remain with no genre and appear under «Todos» only
  - screenshots: admin song row genre selector, delete-genre confirm, player «Todos» with a genre-less song → attach folder
  - Test command → exit 0
- Outcome:

## T256 — Shop follow-up: drop the sample tote, make stored browsers see the new shop
- Status: pending
- Depends on: T249, T250
- Model: haiku
- Skills: none
- Goal: (a) Remove the sample «Tote bags» product (12 €, `muestra` images) now that the real «Tote bag BOIA» (`tote-boia`, T249) replaces it: from `products.json`, the home store block, the /mar shop island lists and any test/e2e spec that names it; delete its images if nothing else uses them. «Packs de pegatinas» stays. (b) Browsers with stored local data (D-20) must see the new store block: T248 added `SAMPLE_CONTENT_REVISION` (reseeds sample events + homeBlocks once); T249 changed the sample home store block after that revision shipped. If the latest revision (after T250) does not already cover this, bump it so the reseed runs once more, and add a unit test that old stored data with the previous revision ends with `tote-boia` in the store block and no sample tote.
- Context: `apps/web/lib/merchandise/products.json`, `packages/store/src/sample/content.ts`, `packages/store/src/sample-reseed.ts`, `local.ts`, ESTADO sections of T248, T249, T250.
- Scope: merchandise data, sample content/reseed, related tests and e2e specs / must not touch rotation, product contract, gallery.
- Done when:
  - unit test for the reseed case → pass
  - Test command → exit 0
- Outcome:

## Decisions

- T246: player genre bar shows only genres with songs; bad genre names give `genre_name` error (small @boia/contracts change); arrows mouse-only.

- T248: separate `SAMPLE_CONTENT_REVISION` (not SCHEMA_VERSION); revision 1 resets sample events + homeBlocks edits, keeps admin-created items; sample items in trash come back.

- Added T255 (Hernán, 2026-10-09, on screen): reassign song genre, delete genre, genre-less songs under «Todos»; T253 and T254 now also depend on it.

- T249: tote added as `tote-boia` with sale `party`; T-shirt keeps name «Camisetas», reserve; placeholder-marking test skips real photos.
- Added T256 (orchestrator): the sample 12 € «Tote bags» duplicates the real tote → removed; T249 changed the home store block after T248's reseed revision shipped, so stored browsers need a revision bump.

## Proposals
- T246: worktree `.env.local` makes `pnpm demo` start in Supabase mode, not local mode.
