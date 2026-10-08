# Plan 019 — Meeting changes: carnet required, video-game look, new landing, events, Galería, world and Admin

Status: active
Created: 2026-10-08
Base branch: main
Goal: Apply the changes agreed in the 2026-10-08 meeting with Álvaro (`docs/propuestas/2026-10-08-reunion-cambios.md`): the Carnet BOIA becomes required to buy tickets (its own discount goes; the world's discounts stay), three video-game fonts and square corners everywhere, a landing redesigned after noartmusic.com, richer event pages edited from Admin, the Galería collage with video, artists with their music links, the door QR scanner, the world's popups, island names, a new boia, Puig Campana in Blender, the comments island Las Calitas, and Admin limits, 30-day trash, analytics switch and daily backups.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done only in T224. Update the e2e specs your change breaks. UI strings only by key in `apps/web/lib/i18n/`, never loose strings in components. Content (names, texts, numbers, images, clips) stays `muestra` unless a decision below says otherwise. Never commit `apps/web/public/atlas/`, `.claude/launch.json`, `e*.log`, `reunion/`, `.github/workflows/supabase-keepalive.yml` or any `.env*` file other than `.env.example`. Never push or deploy. Supabase migrations: when a task needs one it writes it with the timestamp reserved for it below, plus its `test:supabase` tests, and lists in its ESTADO section what Hernán must apply on `boia-planet-dev`; the task never applies it to a real project. Supabase stays on the free plan of `boia-planet-dev` (no Pro). Never edit `docs/DECISIONES.md`. Local mode (D-20, no Supabase env vars) must keep working; Supabase mode must not break. Work only on the main world **Arcilla**; **Acuarela** stays hidden and is not kept in parity. **The Cañón's and the Castillo's game and balance do not change** (`SURVIVORS_CONFIG_VERSION` stays). The landing keeps its 200 kB gzip critical-path cap (D-26). Screenshots for the final message go under `/tmp/orchestrator-attach/boia-planet-hernan-<task id>/` (mobile 390×844 first; desktop where it adds something). Model: each task's `Model:` line says which agent runs it. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other.

Reserved migration timestamps: T215 `20261008100100`, T217 `20261008100200`, T218 `20261008100300`, T216 `20261008100400`, T222 `20261008100500`, T223 `20261008100600` (use only yours; add `…101`, `…102` suffix steps if you need several).

Decisions of 2026-10-08 that every task follows (meeting with Álvaro + Hernán's answers):
1. **Carnet required to buy.** Making the Carnet BOIA is required to buy tickets. The discount for having the carnet goes (`SAMPLE_CARNET_DISCOUNT`, the -2 € door rule text). Every discount earned by exploring the world stays: the landing's «Consigue descuentos», the «Consigue un descuento» button at purchase, the editable codes and the boia rescue mission.
2. **Fonts.** Three fonts that combine, video-game style (reference: https://www.1001freefonts.com/es/video-game-fonts.php), with a licence that allows web use: one for titles, one for buttons (landing, inside the world, top menu: Artistas, Contacto…), one for body text. T213 proposes 3 combinations and Hernán picks one.
3. **Square corners everywhere.** No rounded corners anywhere: buttons, popups, cards, panels, inputs (circular avatars/QR dots are not corners; keep shapes that are intrinsically round, like the boia).
4. **Landing.** Redesigned whole: below the globe hero, the page follows the style of https://www.noartmusic.com/ from top to bottom, with our sections. No mid-task review: the agent builds and integrates. Hero: «Consigue descuentos» in **yellow**; the «Entradas» button goes, only «Zarpar» stays. The fallback still stays for now; it will be replaced by a video/GIF Roke provides (leave a slot that accepts a video or GIF file).
5. **Events.** List: each event shows **the date in a square** with the name beside or below. Event page shows what exists and says clearly what is missing: artists («Aún no están anunciados»), poster («El cartel todavía no está anunciado»), location (announced or not). Buying may say «Solo en puerta» and that the carnet is needed. Price and all these fields are edited from Admin. With a poster, the page background is the poster itself, enlarged and blurred. Event photos show as a collage like the Galería. Next to buying, a **«Consigue un descuento»** button takes you into the world from the start (like «Zarpar»). Ticketing for the next events is to be chosen: Admin has a field for the ticketing provider and the page shows whichever is set.
6. **Halloween:** no online sale. The event page says «Solo en puerta · 5 € con carnet» (`muestra`) and leads to making the carnet.
7. **Discount codes.** Admin gets an optional **common ticketing code**: when set, it replaces the code of every discount at once; when empty, each discount uses its own.
8. **Galería** (formerly «Fotos»): a collage with no texts, photos and short video clips, slightly overlapping. Opening a piece: an opening animation over a dark background. Closing: it flies back to its place and nudges the others a little so other photos show. Clips (mp4, muted, size cap) are uploaded from Admin; the agent also adds 2–3 sample clips (`muestra`) made from existing project art.
9. **Store:** only the 3 products, with name and price, in the noartmusic.com format. «Comprar» explains each case: **party-only sale**, or **reservation without stock**: a link to DM us on Instagram (https://www.instagram.com/boia.planet/) and we bring it to the next event.
10. **Artists:** each artist with their image beside; pressing the name opens their carnet; in the list, two buttons: «Ver carnet» and a link to their music (Spotify, SoundCloud, Bandcamp or, failing those, Instagram). Artists set their own links when they create their carnet.
11. **Carnet:** with Supabase, creating the carnet starts with email → 6-digit code → carnet; local mode asks no email. **Sign-up QR:** a QR that opens «Crear carnet» directly, to show at the party door (Admin shows/prints it). **Carnet QR + door scanner:** each carnet has its QR; at each party a staff scanner page (camera, entered from Admin) scans carnets, records attendance and stamps the party's stamp on the carnet. Today's flow (member scans the party QR) stays as an alternative. Admin can also stamp any carnet by hand.
12. **World:** the loading screen before entering is **light orange**; the boia is redesigned to look like our logo/mascot (`art/marca/boia-mascota.svg`). Popups: square edges, **no orange band at the top**; they keep title and description in blue, their buttons and the expand option.
13. **Island names:** Sonido / Isla del Sonido → **ALL DAY BOIA**; BOIA Nochevieja stays; BOIA Halloween → **HALLOWEEN IN THE CLUB**; Ibiza → **Botiga Ibiza**; Isla dels Banyets → **Puig Campana**. Party islands' popups show only name, date and place. Botiga Ibiza's popup says «Sección de merchandising oficial». The Nochevieja island and event stay.
14. **Rescue mission:** its discount works for **ALL DAY BOIA and Nochevieja** (the conditions text says so).
15. **Puig Campana** is modelled in Blender and replaces Els Banyets in every related island and place.
16. **Las Calitas:** a new comments island. People write comments, reply and vote; insult filter; moderated from Admin. Local mode: sample comments, and your own comments are only seen by you. Supabase mode: real, shared.
17. **Admin:** at most **3 people with full access** (admin or owner; the owner, Carnet 000, is one of them; editors do not exist as a separate tier for this limit), enforced by the database and explained in Admin. Admin moderates everything (Las Calitas included). **30-day trash** of whatever is changed or deleted, to go back. **Visit analytics** switched on/off from Admin. **Automatic daily backups**: a GitHub Actions workflow runs `pg_dump` daily and keeps it as a workflow artifact for 30 days; it needs a repository secret Hernán loads; the task only writes the workflow and its guide.

## Tasks

## T213 — Three video-game fonts, square corners and new buttons across the site
- Status: running (attempt 1)
- Depends on: none
- Model: opus
- Skills: frontend-design
- Goal: Pick and apply three combining video-game fonts (titles, buttons, body) and remove every rounded corner from the web and the world's HUD/popups, with a redesigned button style (decisions 2 and 3).
- Context: `apps/web/lib/fonts.ts` (next/font/local, today Archivo Expanded + Inter), `apps/web/app/globals.css` (`--font-title`, `--font-body`), `tools/fonts/subset.py`, `apps/web/public/fonts/`; ~290 `border-radius` lines, biggest in `app/mar/mar.css`, `app/mar/canon-hud.css`, `app/(landing)/landing.css`, `lib/mundo/hud.css`, `castillo-hud.css`, `lib/mundo/carnet/id-card.css`, `lib/account/account.css`, `admin.css`; `docs/propuestas/2026-10-08-reunion-cambios.md` §1.
- Scope: may touch fonts, global CSS tokens, every CSS file's radii and button styles, `tools/fonts/`, a temporary font sample page or script / must not touch layouts or section structure (T214 redesigns the landing), game logic.
- Steps: (1) Choose 3 candidate combinations (title / button / body) of free-licence fonts (OFL or similar, web embedding allowed; record the licence and source of each), render a sample of each combination on the landing hero, a button row, a world popup and a text paragraph, mobile 390×844, and stop with `blocked`: QUESTION asks Hernán to choose 1, 2 or 3, with one `ATTACH:` line per sample image. (2) After the answer, apply the chosen fonts (subset, `--font-title`, a new `--font-button`, `--font-body`), add a radius token set to 0 and remove every rounded corner, and restyle buttons to match.
- Done when:
  - `grep -rn "border-radius" apps/web --include=*.css | grep -v "50%\|var(--radius" ` → only intrinsically round shapes (list them in the final message)
  - screenshots (landing, /mar with a popup open, carnet, admin) → saved under the attach folder
  - landing critical path stays ≤ 200 kB gzip (the existing size check) → pass
  - Test command → exit 0
- Outcome:

## T214 — Landing redesigned after noartmusic.com, hero changes and the store
- Status: done
- Depends on: T213
- Model: opus
- Skills: frontend-design
- Goal: Redesign the whole landing below the globe hero in the style of https://www.noartmusic.com/ (study it with WebFetch or the browser), keeping our sections; hero changes; event list with the date in a square; the store in the same format (decisions 4, 5 list part, 9).
- Context: `apps/web/app/(landing)/components/blocks.tsx` (hero, priority_event, upcoming_events, artists, philosophy, photos, store, contact, footer), hero buttons ~l.170–190 (`.cta-explore`, `.hero__discount-hint`, `.button--tickets`), `components/hero-stills.tsx`, `components/event-card.tsx`, `tickets-panel.tsx`, `live-event.tsx`, `lib/merchandise/` (`products.json` with 3 products, `catalog-view.tsx`, `product-gallery.tsx`), `app/(landing)/tienda/page.tsx`, `lib/i18n/es-web.ts`, `es-zonas-web.ts`; D-26; meeting notes §1.3, §2, §3.1, §5.
- Scope: may touch the landing page, its blocks and CSS, the event list/card, the store page and its components, the hero still slot (accept a video or GIF file later), i18n / must not touch the event detail page and purchase (T215), the artists page (T217), the photos page (T216), the world.
- Done when:
  - hero shows only «Zarpar» with «Consigue descuentos» in yellow; no «Entradas» button → e2e or unit check
  - event list shows the date in a square with the name; store shows 3 products with name and price and the two «Comprar» cases (party-only / reserve via Instagram DM) → screenshots mobile + desktop under the attach folder
  - `E2E_PORT=<free> pnpm e2e` on the landing, store and record specs it affects `--workers=1` → exit 0
  - landing critical path ≤ 200 kB gzip → pass
  - Test command → exit 0
- Outcome: landing below the hero is one white sheet rising from the sea (noartmusic style), only «Zarpar» + yellow «Consigue descuentos», events with date square, store 3 products with price and party-only / reserve-by-DM; 193.9 kB · b435384

## T216 — Galería: collage of photos and clips with open/close animations
- Status: done
- Depends on: T213
- Model: opus
- Skills: frontend-design
- Goal: Rename «Fotos» to «Galería» everywhere visible and build the collage (photos + short muted clips, slightly overlapping, no texts) with the open and close animations; reusable collage component for event photos (T215); clip upload in Admin (decision 8).
- Context: `apps/web/app/(landing)/fotos/page.tsx`, `photo-galleries.tsx`, `photo-tile.tsx`, `packages/contracts/src/content.ts` (`photoSchema`, `albumSchema`, images only), `lib/lazy-video.tsx`, Admin photos upload from plan 017 (T189, `20261007100100_event_photos.sql`, Storage bucket), meeting notes §4.
- Scope: may touch the photos route (add `/galeria`, redirect `/fotos`), its components, the content schema (media type image|video), the Admin photo section (clip upload with type/size cap), migration `20261008100400` if storage/tables need it, 2–3 sample clips under `art/` built from existing project art, i18n / must not touch the landing blocks layout (T214) beyond the section's name key, event pages (T215).
- Done when:
  - `/galeria` shows the collage with photos and clips; opening animates over a dark background; closing returns the piece and nudges the others → e2e spec + screenshots/short frames under the attach folder
  - Admin uploads a clip in local mode and it appears in the collage → e2e
  - Test command → exit 0
- Outcome: /galeria collage of photos + muted clips (reusable `MediaCollage`), open/close animations, /fotos → 307, Admin clip upload (mp4 ≤20 MB/30 s, bucket event-clips), 3 sample clips; migration 20261008100400 to apply · 1eba877

## T215 — Event page, purchase with required carnet, discounts and Admin event fields
- Status: done
- Depends on: T214, T216
- Model: opus
- Goal: Event page with clear missing-state texts, blurred poster background, photo collage, «Solo en puerta»/carnet notices, Halloween door-only info, «Consigue un descuento» button, ticketing provider; buying requires a carnet and the carnet discount goes; Admin edits every field and the common discount code (decisions 1, 5, 6, 7).
- Context: `apps/web/app/(landing)/eventos/[slug]/page.tsx`, `components/event-page.tsx`, `buy-button.tsx`, `purchase-invite.tsx`, `lib/ticketing/pricing.ts` (`carnetDiscountFor` l.69–117), `lib/ticketing/box-office.tsx`, `packages/store/src/sample/content.ts` (`SAMPLE_CARNET_DISCOUNT` l.378, FIESTERA20 l.356), `packages/contracts/src/events.ts:42` (`posterUrl`, `artistIds`, `placeLabel`, `priceCents`, `boxOfficeOnly`, `ticketUrl`), `app/admin/sections/events.tsx`, `app/admin/sections/discounts.tsx`, `discountSchema` (`content.ts:97`), Supabase `20261003100100_economy.sql:204-240`, T216's collage component, meeting notes §0, §3.
- Scope: may touch the event page and purchase flow, ticketing/pricing, the events/discounts contracts, sample content, Admin events and discounts sections, migration `20261008100100` (fields: location announced, ticketing provider, door-only + door price, common discount code), i18n / must not touch the landing list layout (T214), the carnet editor itself (T218).
- Done when:
  - without a carnet, «Comprar» leads to creating the carnet; with one, the purchase proceeds; no carnet discount anywhere (`grep -rn "SAMPLE_CARNET_DISCOUNT\|carnetDiscountFor" apps packages` → none or dead-code-free) → unit + e2e
  - event without artists/poster/location shows the three missing texts; with poster, blurred poster background → screenshots under the attach folder
  - Halloween shows «Solo en puerta · 5 € con carnet» and no checkout → e2e
  - Admin common code set → every discount shows that code; empty → own codes → unit test
  - Test command → exit 0
- Outcome: event page with missing-state texts, blurred poster bg, MediaCollage photos, «Consigue un descuento», ticketing provider; buying requires a carnet, carnet discount removed; Halloween door-only 5 €; Admin common ticket code; migration 20261008100100 to apply · 5f134d3

## T217 — Artists with image, carnet and music links set by the artists
- Status: done
- Depends on: T214
- Model: opus
- Goal: Artists list with image beside each artist, name opens the carnet, «Ver carnet» and a music link button (Spotify, SoundCloud, Bandcamp or Instagram); artists enter their links when creating their carnet (decision 10).
- Context: `apps/web/app/(landing)/artistas/page.tsx`, `artists-list.tsx`, `artist-card.tsx`, `artist-rotator.tsx`, `live-artists.tsx`, artist claim `app/artista/[code]/`, `lib/account/artist-link.ts`, artist schema `content.ts:6` (`photoUrl`, `spotifyUrl` only), carnet in `lib/mundo/carnet/`, Admin artists section, meeting notes §6.
- Scope: may touch the artists page and components, the landing artists block's content (not its layout style from T214), artist schema and links (one preferred music link with its type), the artist carnet creation step, Admin artists, migration `20261008100200`, i18n / must not touch the member carnet flow (T218).
- Done when:
  - list shows image, name→carnet, «Ver carnet» and a music button with the right platform icon/label → e2e + screenshots
  - an artist enters a SoundCloud link while creating the carnet and the list shows it → e2e (local mode)
  - Test command → exit 0
- Outcome: /artistas with image, name→carnet, «Ver carnet», music button (Spotify/SoundCloud/Bandcamp/Instagram from the domain); artists set the link when creating their carnet; migration 20261008100200 to apply · df0c55b

## T218 — Carnet: email first with Supabase, sign-up QR, door scanner and manual stamps
- Status: done
- Depends on: T215
- Model: opus
- Goal: With Supabase the carnet creation starts with email → code; a sign-up QR that opens «Crear carnet»; each carnet's QR is scanned by a staff door scanner that records attendance and stamps the party; Admin stamps any carnet by hand (decision 11).
- Context: `app/carnet/`, `lib/mundo/carnet/` (`carnet-editor.tsx`, `id-card.tsx` QR at l.124, `use-carnet.ts`, `qr-code.tsx` encodes the public carnet URL), `lib/account/sign-in-sheet.tsx`, stamps `lib/scanner/sello-url.ts`, `app/sello/`, RPC `claim_stamp`, Admin «Fiestas y QR» section, meeting notes §7.
- Scope: may touch carnet creation, carnet QR payload, a new staff scanner page (camera via a small QR-reading library or `BarcodeDetector` with fallback), Admin (sign-up QR printable, scanner entry, manual stamp), migration `20261008100300` (attendance + staff stamping RPC), i18n / must not remove today's member-scans-party-QR flow.
- Done when:
  - local mode: scanner page accepts a carnet QR (test via injected image/URL) and the carnet shows the party's stamp → e2e
  - Admin manual stamp works in local mode → e2e
  - Supabase: `test:supabase` tests for the new RPCs written (they run on boia-planet-dev after Hernán applies the migration)
  - Test command → exit 0
- Outcome: Supabase carnet creation starts with email sheet; Admin «Puerta y sellos» with sign-up QR (/carnet?crear=1), door scanner /admin/puerta (camera, photo, pasted link) that stamps the party, manual stamp with reason; migration 20261008100300 to apply · b605f04

## T219 — World: light-orange loading, popups without band, island names and popup contents
- Status: done
- Depends on: T213
- Model: codex (via wrapper agent; Opus if Codex is out of credits)
- Goal: Light-orange loading screen; popups with square edges and no orange top band (title and description in blue, buttons, expand option); island renames; party islands' popups show only name, date and place; Botiga Ibiza's text; rescue mission text for ALL DAY BOIA and Nochevieja (decisions 12 popups part, 13, 14).
- Context: `.mar-splash` `app/mar/mar.css:1682`, `mar-client.tsx:2092`, `.mar-sheet` (`mar.css:1372`) and `.mar-sheet__kicker` (`mar.css:1446`), `app/mar/sheet.tsx`, `.juego-panel` `lib/mundo/place-panels.tsx`, names in `lib/i18n/es-zonas.ts:25,34,182-184,404`, `es-mar.ts:268-270`, `packages/world/src/worlds/arcilla/map.ts` (`island(...)` from l.395, rescue mission l.486-492), `skin.ts:83`, `packages/store/src/sample/content.ts` (FIESTERA20 conditions), meeting notes §8.1–8.3.
- Scope: may touch world CSS, sheet/panel components, i18n names, user-visible names in map/skin, sample event names, the mission conditions text / must not touch internal ids, Banyets' 3D content (T221), game logic.
- Done when:
  - `grep -rn "Isla del Sonido\|BOIA Halloween\|dels Banyets" apps/web/lib/i18n packages` → none visible (Banyets may remain only where T221 replaces it; list leftovers)
  - screenshots: loading screen, a party island popup, Botiga Ibiza popup → attach folder
  - `E2E_PORT=<free> pnpm e2e mar-hud.spec.ts` and the island/popup specs it affects `--workers=1` → exit 0
  - Test command → exit 0
- Outcome: light-orange /mar loading and Zarpar cover, popups without band, islands ALL DAY BOIA / HALLOWEEN IN THE CLUB / Botiga Ibiza / Puig Campana (name), party popups name + date · place, Botiga «Sección de merchandising oficial», FIESTERA20 text for ALL DAY + Nochevieja (done by Opus, Codex unavailable) · 8f162fc

## T220 — The boia redesigned after the BOIA mascot
- Status: done
- Depends on: T219
- Model: opus
- Skills: blender-modeling-workflow, blender-asset-validation
- Goal: The boia (Boia Fiestera) that appears in the world and the intro looks like our logo/mascot (decision 12).
- Context: `art/marca/boia-mascota.svg|.jpg`, `art/marca/logo/`, world references in `packages/engine/src/world/visual.ts`, `runtime.ts`, sprite frames `art/boia-tutorial/`; find where the boia's model/sprite is built first; Blender 4.0 is installed (`blender -b -P …`), pipeline in `tools/blender/` (README l.150–170).
- Scope: may touch the boia's model/sprites and their build scripts, the art manifest / must not touch islands, popups, game logic.
- Done when:
  - side-by-side screenshot of the mascot and the new boia in the world (and the tutorial frames if they change) → attach folder
  - `python3 tools/blender/check.py` → pass
  - Test command → exit 0
- Outcome: Blender boias with the logo's black outline, hand-made mascot (captain, Fiestera, placeholder) redrawn after the logo, Fiestera now orange, boias face the port, logo SVG on loading screens · e888dc1

## T221 — Puig Campana modelled in Blender, replacing Els Banyets
- Status: running (attempt 1)
- Depends on: T219
- Model: fable
- Skills: blender-art-direction-intake, blender-modeling-workflow, blender-asset-validation, blender-iterative-refinement
- Goal: Model Puig Campana (the mountain near Benidorm/Finestrat, recognisable silhouette with its notch) as a Blender island in the project's style and make it replace Els Banyets in every related island and place (decision 15).
- Context: `tools/blender/islas/{allday,faro,halloween,ultima,comun}.py`, `tools/blender/export_islas_glb.py`, `art/islas/3d/*.glb`, `isla3d.schema.json`, `tools/blender/check.py`, README l.150–170; Banyets is the Cañón's island (canon), `packages/world/src/worlds/arcilla/map.ts:529`, `es-zonas.ts:404`; Blender 4.0 is installed.
- Scope: may touch a new `tools/blender/islas/puigcampana.py`, its GLB, the island manifest, map placement/visuals of the Banyets island, names left by T219 / must not touch the Cañón's gameplay or balance, other islands' models.
- Done when:
  - `blender -b -P tools/blender/export_islas_glb.py -- --only puigcampana` → writes the GLB; `python3 tools/blender/check.py` → pass
  - multiview renders of the model and a /mar screenshot of the island in place → attach folder
  - `E2E_PORT=<free> pnpm e2e mar-canon.spec.ts --workers=1` → exit 0
  - Test command → exit 0
- Outcome:

## T222 — Las Calitas: comments island with replies, votes, insult filter and moderation
- Status: pending
- Depends on: T221
- Model: opus
- Goal: New island Las Calitas where people write comments, reply and vote, with an insult filter; Admin moderates them; local mode shows sample comments plus your own (decision 16).
- Context: `packages/world/src/worlds/arcilla/map.ts` (islands), island visuals/GLB pipeline (a simple island built like the others), popups after T219, Admin moderation `app/admin/sections/moderation.tsx`, `lib/admin/moderation.ts`, accounts and RLS patterns in `supabase/migrations/`, meeting notes §8.3.
- Scope: may touch map/island placement, a comments panel, a comments store (local + Supabase), an insult filter (Spanish word list + normalisation, server-side check in Supabase), Admin moderation, migration `20261008100500` with RLS and `test:supabase` tests, i18n / must not touch other islands' content.
- Done when:
  - local mode: open Las Calitas, post a comment, reply, vote; an insult is rejected → e2e
  - Admin hides a comment and it disappears → e2e (local)
  - Test command → exit 0
- Outcome:

## T223 — Admin: 3 full-access admins, 30-day trash, analytics switch, daily backups
- Status: pending
- Depends on: T222, T218, T217
- Model: opus
- Goal: Limit full access to 3 people; a 30-day trash that covers every change or deletion made from Admin and can restore it; an Admin switch for visit analytics; a GitHub Actions workflow for daily `pg_dump` backups kept 30 days, with a guide for Hernán (decision 17).
- Context: `staff_roles` (`20260928100000_base.sql:57`), `20261007100400_admin_access_export.sql`, `TrashSection` `app/admin/sections/misc.tsx:160`, `lib/analytics/index.ts` (PostHog, `NEXT_PUBLIC_POSTHOG_KEY`), `.github/workflows/supabase-keepalive.yml` exists on disk but is untracked: do not commit it; meeting notes §9, §11.3.
- Scope: may touch Admin roles/trash/settings, analytics init (consent rules unchanged), migration `20261008100600`, a new `.github/workflows/supabase-backup.yml` and a guide `docs/propuestas/2026-10-08-backups.md` (secret name, how to download and restore) / must not commit the keepalive workflow, create secrets or touch the real project.
- Also (T215 leftovers, added by the orchestrator): Supabase mode must read the common discount code from `ticketing_settings` (today only local mode uses it); remove the dead `/mar` after-purchase carnet invite (`inviteTrigger('purchase')`); world island popups must not show `placeLabel` when the event's location is not announced.
- Done when:
  - a 4th full-access admin is refused by the database → `test:supabase` test written; Admin explains the limit
  - local mode: edit and delete an event, restore both from the trash → e2e
  - analytics off in Admin → no analytics request sent → unit/e2e
  - the backup workflow passes `actionlint` if available, or a YAML parse check
  - Test command → exit 0
- Outcome:

## T224 — Close plan 019
- Status: pending
- Depends on: T213, T214, T215, T216, T217, T218, T219, T220, T221, T222, T223
- Model: opus
- Goal: Full e2e run green, spec status, handover and a test guide for Hernán.
- Context: all tasks' ESTADO sections, `docs/spec/estado.md`, `docs/TRASPASO.md`, `docs/propuestas/2026-10-07-plan-017-guia-prueba.md` (format to follow).
- Scope: may touch e2e fixes for flaky or outdated specs, `docs/spec/estado.md`, `docs/TRASPASO.md`, a new `docs/propuestas/2026-10-08-plan-019-guia-prueba.md` (what changed, what to try by hand, migrations Hernán must apply in order, material pending from Álvaro and Roke, open questions) / must not change features.
- Done when:
  - `E2E_PORT=<free> pnpm e2e --workers=2` → 0 failures
  - `python3 tools/spec/estado.py` → pass
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-08 T213: fonts from Google Fonts (all SIL OFL 1.1) instead of 1001freefonts, whose licences are unclear; proposed button style: square, 2px black border, hard offset shadow; popup title/text blue on cream (agent)

- 2026-10-08 T213: fonts = combination 4: Upheaval (titles) / Press Start 2P (buttons) / 8-bit Operator+ (body) (Hernán)
- 2026-10-08 T216: optional `kind` + `poster` on photo schema; clips play only on screen, never with reduced motion; /api/art serves mp4 with Range; database.types.ts edited by hand (agent)
- 2026-10-08 T214: store sample prices camisetas 20 € (reserve by DM), tote 12 €, pegatinas 5 € (party only), `priceCents` + `sale` on product contract; Instagram default https://www.instagram.com/boia.planet/; tests open Tickets from the header «Entradas» past the hero; REQ-ENT-002/027 → PARCIAL (agent)
- 2026-10-08 T219: Codex cannot run ("gpt-6.1-sol not supported with a ChatGPT account"); Opus did the task; later Codex tasks go to Opus (orchestrator)
- 2026-10-08 T219: party-island popups have no kicker (name, date · place, state tag); Castillo tower labels renamed too; FIESTERA20 only text changes (agent)
- 2026-10-08 T219: integration failed lint (merchandise.spec unused MERCHANDISE_NOTICE after T214) → reverted; agent fixing; scope extended to make landing `.intro-cover` light orange (orchestrator)
- 2026-10-08 T215: common code replaces only ticket discounts (store keeps its own); door-only = `boxOfficeOnly {doorPriceCents?}`; ALL DAY BOIA sold online again; Supabase: `ticketing_settings` table + `admin_set_common_discount_code`, `discount_code_for` returns it only to finders; purchase-invite.tsx removed; 11 e2e specs seed a carnet (agent)
- 2026-10-08 T217: one music link `{platform,url}` with platform from the domain, `spotifyUrl` kept as fallback; /artistas joins content artists with artist carnets; Supabase link saved by RPC `set_artist_music`; REQ-COM-027 HECHO (agent)
- 2026-10-08 T223: scope extended with T215 leftovers (Supabase common code, dead invite, placeLabel when not announced) (orchestrator)
- 2026-10-08 T220: outline as inverted hull only on 3D glTF boias; `FaceTextures.pink` → `party`; `BOIA_FACING = -π/2` (orientation only) (agent)
- 2026-10-08 T218: carnet QR keeps the public URL; scanning needs editor+, manual stamp needs admin + reason; one stamp per party per carnet; door scan points = party QR stamp (0 in local); door stamp replaces a test-purchase stamp (agent)

## Proposals (new scope)
- 2026-10-08 T213: dev server returned 500 on /api/art/landing/3d/manifest.json in the worktree (globe sometimes falls back to the wordmark); check if it also happens on main
- 2026-10-08 T216: the i18n-zonas generator is out of sync with textos-zonas.md (running it would drop keys like nav.ranking); generated files were edited by hand
- 2026-10-08 T216: home «Ver todas» (PHOTOS_PAGE in blocks.tsx) still points to /fotos (redirect works; T214 may fix)
- 2026-10-08 T214: decision 4 should go into DECISIONES.md so REQ-ENT-002/027 can be retired (Hernán); Roke's file goes in HERO_MEDIA_SRC (apps/web/lib/landing/hero-media.ts)
- 2026-10-08 T219: supabase/seeds/20261003100100_economy.sql keeps old event names; sea island labels `.mar-pin--accent` still orange
- 2026-10-08 T217: with Supabase, Admin cannot edit an artist carnet's music link (only content artists')
- 2026-10-08 T220: mascot boias inside island GLBs (allday, faro, ultima) and 2D sprites have no outline; art/boia-tutorial unchanged (render.py needs Blender ≥ 4.2)

## Log
- 2026-10-08 T213 launched · attempt 1 · agent a2810769cbecd91ff
- 2026-10-08 T213 blocked · asks which font combination (1 pixel / 2 arcade / 3 space) · branch worktree-agent-a2810769cbecd91ff · commit 999eb62
- 2026-10-08 T213 Hernán (session): new samples with 1001freefonts fonts (commercial/web licence only) → agent resumed
- 2026-10-08 T213 blocked again · combos 4/5/6 from 1001freefonts · commit a10c62a
- 2026-10-08 T213 Hernán chose combination 4 → agent resumed
- 2026-10-08 T214 launched · attempt 1 · agent a6c26a044e7b10876
- 2026-10-08 T216 launched · attempt 1 · agent abb6b9b5dbd06ffba
- 2026-10-08 T216 done · merged 1eba877
- 2026-10-08 T219 launched · attempt 1 · agent a63809805b469a6f9 (Codex wrapper)
- 2026-10-08 T214 done · merged b435384
- 2026-10-08 T219 tests_failed at integration (lint) · reverted a55683c · sent fix request to agent
- 2026-10-08 T215 launched · attempt 1 · agent a0d0efb4f016f8bd3
- 2026-10-08 T219 done · merged 8f162fc
- 2026-10-08 T215 agent stopped: session rate limit (429) · resumed by SendMessage
- 2026-10-08 T217 launched · attempt 1 · agent a58ed747487773150
- 2026-10-08 T215 done · merged 5f134d3
- 2026-10-08 T217 done · merged df0c55b
- 2026-10-08 T218 launched · attempt 1 · agent abaa28dc8065cb263
- 2026-10-08 T220 launched · attempt 1 · agent a4281a0437dfca569
- 2026-10-08 T220 done · merged e888dc1
- 2026-10-08 T221 launched · attempt 1 · agent ac7fce138eec8f194 (fable)
- 2026-10-08 T218 done · merged b605f04
