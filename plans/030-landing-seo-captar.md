# Plan 030 — Landing: open to Google, good-looking shares and a Carnet invitation

Status: active
Created: 2026-10-14
Base branch: main
Goal: Make the landing findable and shareable, and push visitors toward the Carnet and the WhatsApp. Álvaro, 2026-10-14: remove the site-wide `noindex` now (sample content included: in a few days it will all be real); the site's name everywhere is «BOIA.PLANET» / boiaplanet, never «demo»; a link shared on WhatsApp/Instagram/X shows the planet with the BOIA wordmark, and each event its own image; Google gets structured event data (sample events included for now); a visible «Sácate el Carnet» block that says the Carnet is required to get into a party and that with it BOIA tells you about the next ones; the WhatsApp is no longer only in the footer. Not in this plan (Álvaro said no or later): moving tickets above the fold, changing the reel, mobile performance, accessibility pass, security checklist (own plan next).
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 027 (`plans/027-cloudflare-doble-despliegue.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`. Álvaro runs the project. Never run the full e2e suite (one spec only if strictly needed).
Audit rule: as in plan 029 (sonnet/haiku tasks get an Opus audit on the same branch before integration).
Landing rules for every task: all new UI text through `apps/web/lib/i18n/` and `muestra` until Álvaro approves it; the canonical public host is `https://boiaplanet.net` (Cloudflare); the Vercel copy (`boia-planet-roan.vercel.app`) serves the identical build, so every page's canonical URL points to boiaplanet.net to avoid duplicate content; both hosts get the same build, no host-specific branches. The landing's critical-path budget (`scripts/landing-budget.mjs`, 200 KB gzip) and `pnpm cf:measure` (≤ 2,800 KiB gzip) must still pass. No new external requests from the browser, no new accounts or paid services.

## Tasks

## T291 — Real legal identity in the legal pages and the privacy policy
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: The public legal pages show joke placeholders (es-zonas.ts ~602–641: «Bollería Fina del Mediterráneo», «C/ Rosa Melano», «Benito Camelas», «Paco Merlo», «Débora Melo», NIF B00000069, privacidad@boia.example). Replace them with the text Álvaro approved on 2026-10-14, exactly: aviso legal titular «Titular: BOIA PLANET (CIF en trámite), con domicilio en Calle Hondón de las Nieves, 7, 03005 Alicante.» and contact «Contacto: hola@boiaplanet.net.»; privacy controller «Responsable: BOIA PLANET (CIF en trámite), Calle Hondón de las Nieves, 7, 03005 Alicante. Para cualquier cosa sobre tus datos: hola@boiaplanet.net.» (no data protection officer line); `legal.privacy.account.where` «Dónde: en la base de datos de BOIA.PLANET, en los servidores de nuestro proveedor Supabase, en la Unión Europea, que la guarda por encargo nuestro. El correo con tu código de acceso lo envía nuestro proveedor de email, Brevo, también por encargo nuestro. En tu navegador quedan tu sesión y una copia de tu progreso.»; every `privacidad@boia.example` → `hola@boiaplanet.net` (both rights texts, aviso, anywhere else in i18n); `legal.privacy.account.updated` → «Última actualización: 14 de octubre de 2026.». These legal texts are no longer `muestra` (approved). Bump `PRIVACY_POLICY_VERSION` in `apps/web/lib/account/config.ts` to `2026-10-14`. Grep the whole repo (apps, packages, docs except history files like ESTADO/plans/informes) for the joke names and `boia.example` emails in user-visible text and replace them too; leave test fixtures that need a fake email alone unless they assert the legal text. Also update `docs/propuestas/2026-10-03-produccion-supabase.md`: §6 Rate Limits values chosen by Álvaro on 2026-10-14 (sending emails 250/h, token verifications 500, sign ups and sign ins 500, per IP for the last two; Brevo free = 300 emails/day is the real cap), §9 marked done with the new version, and a note that the production project `BOIAPLANETWEBOFICIAL` was created, migrated (40/40 + seeds), `admin@boiaplanet.net` granted owner, and SMTP verified with a real code email (2026-10-14).
- Context: `apps/web/lib/i18n/es-zonas.ts` (`legal.*`), `apps/web/lib/i18n/es-cuenta.ts` (`legal.privacy.account.*`), `apps/web/lib/legal/docs.ts`, `apps/web/lib/account/config.ts`, the legal pages tests, the switch-on doc.
- Scope: may touch legal i18n keys, the policy version, legal tests, the switch-on doc / must not change any other copy, must not edit `docs/DECISIONES.md`.
- Done when:
  - `grep -rn "Rosa Melano\|Benito Camelas\|Paco Merlo\|Débora Melo\|Bollería Fina\|B00000069\|privacidad@boia.example" apps packages` → no matches
  - unit test: /legal/aviso-legal and /legal/privacidad (both modes) render the approved controller text with hola@boiaplanet.net; `PRIVACY_POLICY_VERSION` is `2026-10-14` → pass
  - Test command → exit 0
- Outcome: legal pages carry the approved identity (BOIA PLANET, CIF en trámite, hola@boiaplanet.net), Brevo named, policy 2026-10-14, «muestra» banner removed from legal pages; sonnet + Opus audit — d1e82b2

## T285 — Open to Google: index, titles, canonical, sitemap and robots
- Status: done
- Depends on: T291
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: Remove the site-wide `robots: { index: false, follow: false }` from the root layout and replace the «boia-planet · demo» title with a title template based on «BOIA.PLANET» (home: «BOIA.PLANET — <positioning/description>», other pages: «<page> · BOIA.PLANET»). Set `metadataBase` to `https://boiaplanet.net` and a canonical URL on every public page (home, /mar, /galeria, /artistas, /tienda, /ranking, Carnet public pages, legal pages, event pages if they exist). Keep `noindex` ONLY on pages that must never be indexed: /admin and everything under it, private account/Carnet editing pages, checkout/sandbox pages, dev/test routes. Add `app/sitemap.ts` (public pages + one entry per event/artist page that exists) and `app/robots.ts` (allow all, disallow /admin and private routes, point to the sitemap at boiaplanet.net). Every page gets a real `description` (i18n, `muestra`). Also replace «demo» in the manifest/PWA name and any visible tab title with BOIA.PLANET. Both static export paths (Cloudflare and Vercel) must serve /sitemap.xml and /robots.txt.
- Context: `apps/web/app/layout.tsx`, `apps/web/app/(landing)/page.tsx`, every `page.tsx` with `metadata`, `lib/i18n` `site.*` keys, the manifest, `docs/DESPLIEGUE.md`, REQ-ARQ / SEO REQs in `docs/spec/09-requisitos.md`.
- Scope: may touch metadata in layouts/pages, new `sitemap.ts`/`robots.ts`, manifest, i18n, tests, `docs/spec/estado.md` / must not change page content or layout, must not touch /mar engine code.
- Done when:
  - unit test: the built metadata of the home has no `noindex`, has canonical `https://boiaplanet.net/`; /admin keeps `noindex` → pass
  - unit test: `sitemap()` lists the public routes with boiaplanet.net URLs and no /admin; `robots()` disallows /admin → pass
  - `pnpm build` output contains `sitemap.xml` and `robots.txt`; `grep -ri "· demo" apps/web/app` finds nothing → pass
  - Test command → exit 0
- Outcome: indexable site, BOIA.PLANET titles, canonical boiaplanet.net, sitemap/robots on both hosts; noindex on /admin, /carnet, /carnet/[id], /sello, /artista; sonnet + Opus audit — 5f53fff

## T286 — Share images: planet + BOIA for the site, one per event
- Status: done
- Depends on: T285
- Model: opus
- Skills: none
- Goal: When the home is shared on WhatsApp/Instagram/X it shows a 1200×630 image of the landing's 3D planet with the BOIA wordmark (Álvaro's choice); /mar and the other main pages may reuse it. Each event (event page if it exists, otherwise its anchor/share URL) gets its own 1200×630 image: the planet image composed with the event's name and date in the landing's fonts/colours (Upheaval, orange #e8542a-style palette as on the site). Produce them as static files at build time (no runtime image generation on the Workers: check `@opennextjs/cloudflare` limits; a Node script under `apps/web/scripts/` run in `prebuild` or committed PNG/WebP outputs, whichever keeps both hosts identical), capture the planet from the real scene (Playwright screenshot of the hero at a fixed seed/angle, or the existing hero stills) so it looks like the site. Wire `openGraph` and `twitter` (`summary_large_image`) metadata with absolute boiaplanet.net URLs, `og:locale es_ES`, `og:site_name BOIA.PLANET`. Each image ≤ 300 KB. Leave Álvaro a dev URL or a list of paths to look at the images.
- Context: T285's metadata, `app/(landing)/hero-stills.tsx`, `public/art/landing/`, `lib/intro/`, `lib/fonts.ts`, sample events in `packages/store/src/sample/content.ts`.
- Scope: may touch metadata, a new generation script + its outputs under `apps/web/public/og/`, package.json scripts, tests / must not change the landing's visible design or its critical path.
- Done when:
  - unit test: home, /mar and every sample event resolve an `og:image` with an absolute boiaplanet.net URL that exists in `public/` and is 1200×630 and ≤ 300 KB → pass
  - Test command → exit 0
- Outcome: build-time share images (public/og/planeta.png + one per event) from the real planet/boats/fonts, og/twitter on every public page; landing shop block lazy → critical path 197.7 kB; attempt 2 — 521ed4e

## T287 — Structured data for Google: organisation, site and events
- Status: done
- Depends on: T285
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: Add JSON-LD to the home: `Organization` (BOIA, Alicante, logo, sameAs Instagram/Spotify/WhatsApp from the existing links), `WebSite` (BOIA.PLANET, boiaplanet.net) and one `MusicEvent`/`Event` per upcoming event (name, startDate/endDate with Europe/Madrid offset, location Place + PostalAddress, image = T286's event image when present, offers with url = the event's ticket URL / share URL, price and currency if the content has them, availability, eventStatus, organizer BOIA). Álvaro, 2026-10-14: the 3 events in the content today are OFFICIAL, not sample; if the content or the landing still flags them as `muestra` (data-contenido, labels, `muestra` fields), mark those 3 as real; future sample events are included in the JSON-LD too. Data comes from the same content the landing renders (one pure builder function, tested), rendered server-side in the static HTML (not client-only). Event pages (if they exist) carry their own `Event`.
- Context: `app/(landing)/page.tsx`, `LiveLanding`, `packages/store/src/sample/content.ts`, `packages/contracts` event types, schema.org Event docs.
- Scope: may touch the landing page head/body for the script tag, a new builder in `apps/web/lib/landing/` or `lib/seo/`, tests / must not change visible content.
- Done when:
  - unit test: the builder turns the sample content into valid JSON-LD (types, ISO dates with offset, absolute URLs) and skips past events → pass
  - the built `index.html` contains one `application/ld+json` script with the Organization, WebSite and the upcoming events → pass
  - Test command → exit 0
- Outcome: JSON-LD @graph (Organization, WebSite, MusicEvents) on the home + Event on each /eventos/[slug]; sample prices omitted; Madrid offsets; offerAvailability hook for T292; landing 198.7 kB; sonnet + Opus audit — 970edc4

## T288 — «Sácate el Carnet» block and a WhatsApp that is easy to find
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: A new landing section, placed right after the upcoming events, that invites people to get the Carnet BOIA: it says the Carnet is required to get into a BOIA party (you need it before buying), that with it BOIA tells you about the next parties by email (the news opt-in already asked at sign-up; this line only shows when accounts mode is on — in local mode, with no email, the block invites to the WhatsApp for the news instead), and its perks (stamps, discounts from the sea). One clear button to create the Carnet (same `CARNET_CREATE_HREF` the checkout uses) and, next to it, «Entrar en el WhatsApp» with the existing WhatsApp link from the content (the one the footer uses). The WhatsApp link also appears in the landing header/scroll menu (and the mobile menu) as a small item, not only in the footer. In the ticket flow, before buying (the step that already sends people without a Carnet to create one), make the message say plainly that the Carnet is required to enter and that they will get the party news if they accept. Style it like the rest of the landing (`landing.css`, pixel fonts, existing palette), mobile first, reduced motion respected. All copy is `muestra` via i18n. Add the block to the content's block order (`packages/store/src/sample/content.ts`) and to the Admin's landing text overrides if the block system supports it.
- Context: `app/(landing)/blocks.tsx`, `site-header.tsx`, footer join column, `components/buy-button.tsx`, `lib/ticketing/checkout`, `lib/account` sign-up (news opt-in, `es-cuenta.ts`), `packages/store/src/sample/content.ts`, `es-lib-web.ts` (`landing.access.*`).
- Scope: may touch the landing components and CSS, the sample block order, the pre-buy Carnet message, i18n, tests / must not change the checkout logic, the Carnet sign-up flow itself, the hero or the reel.
- Done when:
  - component test: the block renders after upcoming events with the Carnet button (correct href) and the WhatsApp link from content; header/menu shows the WhatsApp item → pass
  - component test: the pre-buy step without a Carnet shows the «required to enter» text → pass
  - axe on the landing (existing unit/e2e helper, one spec only if needed) → 0 violations
  - Test command → exit 0
- Outcome: «Sácate el Carnet» block after upcoming events (Carnet button + WhatsApp, email-news line only with accounts), WhatsApp in header/menu, pre-buy «El Carnet es obligatorio para entrar»; migration 20261014100300 (home_block_type carnet) applied to dev and prod; landing 199.8/200 kB — 5a6def7

## T289 — The landing planet survives losing its 3D
- Status: running (attempt 1)
- Depends on: none
- Model: opus
- Skills: none
- Goal: On phones the browser can drop the landing's WebGL context (app switch, memory pressure, other WebGL tabs such as /mar, screen lock); today the hero planet then stays black or frozen until reload (REQ-ARQ-016 note). Listen for `webglcontextlost` (preventDefault so it can be restored) and `webglcontextrestored` on the landing's three.js canvas: on loss, stop the render loop and show the existing CSS planet + hero stills fallback (the same one painted before three.js loads) so there is never a black hole; on restore, rebuild renderer resources (textures, materials, geometries, render targets) and resume, hiding the fallback; if it is not restored within a few seconds, or it is lost repeatedly, stay on the fallback for the rest of the visit without errors in the console. Also handle a WebGL that fails to start at all. No visible change when everything works.
- Context: `lib/intro/lazy.ts` and the intro/hero scene code, `app/(landing)/intro-stage.tsx`, `hero-stills.tsx`, the CSS planet in `landing.css`, REQ-ARQ-016 in `docs/spec/09-requisitos.md` and `docs/spec/estado.md`. `/mar` may have context-loss handling to reuse (check `mar3d.ts`).
- Scope: may touch the landing intro/hero scene code and its fallback toggling, tests, `docs/spec/estado.md` / must not touch /mar, the reel, the landing's design or its critical-path budget.
- Done when:
  - unit test: a pure state helper (running → lost → fallback → restored → running; repeated loss → permanent fallback; timeout → fallback) → pass
  - Playwright check (one spec only, new or existing landing spec): force loss with `WEBGL_lose_context.loseContext()` → fallback visible, no console errors; `restoreContext()` → canvas visible and animating again → pass
  - Test command → exit 0
- Outcome:

## T290 — «La Sosia» is the radio's first song, everywhere
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: NOTE (2026-10-14, after the switch-on): production now runs in accounts mode and its shared `radio_songs` table already has a song Álvaro uploaded from the Admin as a test, so the bundled catalog is NOT what plays in production; there, «La Sosia» is uploaded from the Admin and marked first with the existing `radio_set_first` (Álvaro or the orchestrator does it, outside this task). This task must still (a) make the player start with the `first` song in both modes and on both pages, and (b) put «La Sosia» first in the bundled catalog for local mode. Original goal: Álvaro gave a real track on 2026-10-14: `C:\Users\alvar\Downloads\koko moreno, tonito montana - la sosia v2 - 2026_09_05 (1).mp3` (3.8 MB, read it by that absolute path; approved by Álvaro, it is real content, not `muestra`). Add it to the radio as title «La Sosia», artist «Koko Moreno, Tonito Montana», genre Reggaetón (`reggaeton`), and make it THE first song: the first song a visitor hears is always «La Sosia», both on the landing's radio and on the boat's radio in /mar (Álvaro: «es la primera canción en los dos casos, luego es aleatorio»); after it, the radio continues as today (shuffle by default). Copy it under `apps/web/public/radio/` with a clean filename (e.g. `radio/real/la-sosia.mp3`; keep the original bytes unless re-encoding to ~128–160 kbps MP3 keeps it clearly good and much lighter — log the choice), read its real duration, add it to the bundled catalog (`lib/radio/muestra.json` / `muestra.ts`, or a small real catalog merged in front of the sample one if that is cleaner) with `first: true` and order 0, and move `first` off `muestra-001`. Make sure the player really starts with the `first` song when there is no current song (today `nextSong` with shuffle picks at random when `current` is null: fix it so the first play honours `first`, then shuffle), on both the landing and /mar, and in local and accounts modes. Accounts mode: the shared `radio_songs` table overrides the bundled catalog when it has rows; if that is the case on dev, add the song there too (upload path/RPC used by the Admin, `radio_set_first`) or document in the switch-on doc (`docs/propuestas/2026-10-03-produccion-supabase.md`) that Álvaro uploads it from the Admin and marks it first. The song must not load on the landing's critical path (only when the radio starts) and must play on both hosts (check Cloudflare static asset limits: 25 MiB per file).
- Context: `apps/web/lib/radio/` (`catalog.ts`, `muestra.json`, `muestra.ts`, `player-model.ts`, `player.ts`, `shared-store.ts`, `song-files.ts` and tests), `app/(landing)/components/landing-client.tsx`, the /mar radio UI (`lib/radio/ui`), `packages/contracts` radio schema, `art/radio/generar.py` (generates the sample catalog: make sure regenerating it does not drop the real song).
- Scope: may touch `lib/radio/`, the catalog JSON, `public/radio/`, the contracts schema if a `muestra` flag per song is needed, tests, the switch-on doc / must not delete the sample songs, must not touch production.
- Done when:
  - unit test: with no current song, shuffle on or off, the first song played is the one with `first: true` («La Sosia»); the next ones follow the current shuffle rules → pass
  - unit test: the catalog parses, «La Sosia» is the only `first`, its `src` exists in `public/` → pass
  - Test command → exit 0
- Outcome: player starts with the `first` song in both modes/pages, then shuffle; «La Sosia» (original 192 kbps, 3.86 MB) first in a small real catalog in front of the sample; production upload + «Hacer primera» is Álvaro's Admin step (switch-on doc §13) — 3d950b3

## T293 — Bug: editing your own artist Carnet with a web link says the nickname is taken
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Álvaro, 2026-10-14, seen on the Vercel host (accounts mode, production Supabase, 2 users: admin + Álvaro's own account) — orchestrator check of production: the only unique indexes on member data are `carnets_nickname_key` (lower(nickname)) and `carnets_member_number_key` (member_number, touched by plan 029 T282 sequential numbers), so suspect a save path that re-sends or re-assigns member_number or nickname and hits one of them: editing your OWN artist Carnet and adding a link to a website fails with «Ese apodo ya lo lleva otro miembro de BOIA. Prueba con otro.» (`carnet.error.nicknameTaken`). `carnetErrorText` (`lib/mundo/carnet/carnet-editor.tsx` ~284) turns ANY store `conflict` whose message contains «apodo» into that text, so the real cause may be elsewhere: the update path not excluding the member's own row from the nickname uniqueness check, a unique violation (23505) on another column (link/music URL, artist code) mapped to a nickname conflict, or the artist Carnet's save path (`/artista/[code]`, artist fields) re-inserting instead of updating. Reproduce it in BOTH modes (local repository and accounts mode against the dev Supabase project `boia-planet-dev`, credentials in the main checkout's apps/web/.env.local read by absolute path), find the root cause, fix it, and make the error mapping precise (nickname conflict only for a real nickname clash with another member; other conflicts get their own correct message). If the fix needs a migration, write it, apply it to dev only, add it to the switch-on doc's migration list and say so in the final message (the orchestrator applies it to production). Keeping your own nickname and changing any other field must always save.
- Context: `apps/web/lib/mundo/carnet/carnet-editor.tsx`, `lib/mundo/carnet/*` (artist Carnet), `lib/repo-member.ts`, `lib/account/errors.ts`, `packages/store/src/local.ts`, the Supabase member/carnet repository in `packages/store` or `apps/web/lib/`, `supabase/migrations/20260928100100_identity.sql` and later ones (nickname unique index, artist fields), `pnpm test:supabase`.
- Scope: may touch those files, a new migration (dev only), tests, i18n for a precise error text / must not touch production, must not change who can have which nickname.
- Done when:
  - unit test (local) and `pnpm test:supabase` (dev): a member (artist and non-artist) edits their Carnet keeping their nickname and adding/changing a web link → saves; another member taking an existing nickname → nickname error → pass
  - Test command → exit 0
- Outcome: root cause = local copy's checkNickname flagged the member's own nickname (artist list / sample members) before the server save; fixed, precise error mapping; no migration — 5d4d988

## T294 — Carnet questions: artists keep the 5, the public gets a funny first question
- Status: done
- Depends on: T293
- Model: opus
- Skills: none
- Goal: Álvaro, 2026-10-14: the 5 current Carnet questions (plan 029 T281: `momento-quiero-estar`, `cancion-en-repeat`, `creando-tramando`, `disco-entero`, `buena-fiesta`) stay exactly as they are for ARTISTS — people who create their Carnet through the artist link (`/artista/[code]`, artist Carnet). Everyone else (a normal account / Carnet) gets the same set except question 1, which is replaced by «Completa la frase: al día siguiente de una fiesta yo…» (exact text, approved by Álvaro, not muestra; new id e.g. `dia-siguiente`, position 1 for the public). Questions 2–5 are shared by both audiences. Model it as data: each question gets an audience (`all` | `artist` | `public`) in the contract (`packages/contracts/src/carnet.ts` CARNET_QUESTIONS) and in Supabase (`carnet_questions`: new column or equivalent, via a NEW migration that adds the new question and sets the audiences; applied to dev only, added to the switch-on doc's migration list; the orchestrator applies it to production). The Carnet editor, the public Carnet, the Carnet in /mar, the sign-up flow and Admin moderation show each member the questions for their audience in order; RLS/answer rules accept answers only to active questions of the member's audience (extend `20261014100110_carnet_answers_active_only.sql`'s rule). Existing answers are never deleted: a normal member who already answered `momento-quiero-estar` keeps the answer stored (shown only in Admin moderation, like retired questions); an artist keeps everything. If a member becomes an artist later (artist link), they see the artist set from then on. Local/demo mode too (`packages/store/src/local.ts`, sample answers), and i18n keys for the new question.
- Context: plan 029 T281's diff (`git log --grep T281`), `packages/contracts/src/carnet.ts`, `apps/web/lib/i18n/es-zonas.ts` (`carnet.q*`), `apps/web/lib/mundo/carnet/*` (editor, public Carnet, artist Carnet), how an artist Carnet is identified (artist link / code / flag), `packages/store/src/local.ts`, `supabase/migrations/2026101410*` (T281), `*.supabase.ts` tests.
- Scope: may touch those files, a new migration (dev only), the switch-on doc, docs/spec where REQ-IDE-014 quotes the questions, tests / must not delete any stored answer, must not touch production, never edit docs/DECISIONES.md.
- Done when:
  - unit tests: an artist Carnet shows the 5 current questions in order; a normal Carnet shows «Completa la frase: al día siguiente de una fiesta yo…» first and then questions 2–5; a normal member's old `momento-quiero-estar` answer is kept but not shown publicly → pass
  - `pnpm test:supabase` against dev: answers accepted only for the member's audience; existing answers survive the migration → pass
  - Test command → exit 0
- Outcome: questions carry an audience (all/artist/public); artists keep the 5, public gets «dia-siguiente» first; RLS by audience; no answer deleted; migration 20261015100100 (dev; prod at end of plan) — b2cf36a

## T292 — «Tickets todavía no disponibles» for All Day BOIA and Nochevieja
- Status: done
- Depends on: T288
- Model: opus
- Skills: none
- Goal: Álvaro, 2026-10-14: when someone presses «Comprar entradas» on ALL DAY BOIA (`SONIDO_EVENT_ID`, 5 Dec) or BOIA Nochevieja (`NOCHEVIEJA_EVENT_ID`, 31 Dec), they must see «Tickets todavía no disponibles» instead of the (sandbox) checkout. Halloween (box office only) stays as it is. Model it as data, not as a hard-coded id check: a per-event sales state such as `ticketsAvailableFrom` (optional date) or a `ticketsStatus: 'not_yet'` flag in the event contract (`packages/contracts/src/events.ts`), honoured by `canBuy`/`BuyButton`/the tickets panel (`#tickets`) everywhere an event can be bought (landing cards, priority event, tickets panel, /mar island panels, event pages). The button keeps its place and look; tapping it shows a small accessible message (dialog or inline status, `role="status"`) with the text «Tickets todavía no disponibles» (i18n, approved by Álvaro, not muestra), and never opens the checkout or the external ticket URL (also without JS: the no-JS `<a>` fallback must not lead to the sandbox). The Admin's event editor gets a simple switch to open sales later (sets the field back), in local mode and in accounts mode (Supabase `events` table: a new column via a NEW migration applied to the dev project only and added to the switch-on doc's migration list; production migration is applied by the orchestrator later with Álvaro's OK). Set the flag on those two events in the sample/real content (`packages/store/src/sample/content.ts`) and in the seeds. JSON-LD (T287) should map this to `offers.availability` = `https://schema.org/PreOrder` or omit offers — note it in OUT OF SCOPE for T287 if T287 is not merged yet.
- Context: `packages/contracts/src/events.ts` (`canBuy`, `EVENT_STATE_BEHAVIOR`), `apps/web/components/buy-button.tsx`, `app/(landing)/tickets-panel.tsx`, `lib/ticketing/`, the /mar event island panel, Admin events section (`apps/web/app/admin/`), `supabase/migrations/` (events table), `packages/store/src/local.ts`, seeds.
- Scope: may touch those files, a new migration (dev only), i18n, tests, the switch-on doc / must not change the checkout itself, Halloween's box-office flow, or production.
- Done when:
  - unit test: `canBuy` is false and the buy button shows «Tickets todavía no disponibles» for an event with the not-yet state; Halloween unchanged → pass
  - component test: tapping «Comprar entradas» on ALL DAY BOIA shows the message and does not open the checkout; the Admin switch flips it → pass
  - `pnpm test:supabase` against dev for the new column/RLS → pass
  - Test command → exit 0
- Outcome: per-event `ticketsNotYet` (events.tickets_not_yet), message instead of checkout everywhere (also no-JS), Admin switch in both modes, JSON-LD PreOrder, e2e open sales via openSales(); migration 20261014100400 (dev; prod at end of plan) — 3712d3e

## Decisions
- 2026-10-15 T287: prices flagged as sample are not published in JSON-LD; event pages get their own Event (orchestrator)
- 2026-10-15 T294: public question 1 = «Completa la frase: al día siguiente de una fiesta yo…» (Álvaro); artists keep the 5 current ones; question 3 «¿Qué estás creando o tramando estos días?» stays shared — asked twice, no answer, kept as is (orchestrator, reversible)
- 2026-10-14: Álvaro: when every task is done, push (git push origin main deploys both hosts). Before that push, apply the plan's new migrations to production (additive only) so the new build finds them (orchestrator)
- 2026-10-14 T293: live bug, launched before T287/T289/T290 at the next free slot (orchestrator)
- 2026-10-14 T292: «Tickets todavía no disponibles» text approved by Álvaro; tapping the buy button shows it instead of the checkout; modelled as per-event data with an Admin switch (orchestrator)
- 2026-10-14: Legal identity text approved (BOIA PLANET, CIF en trámite, Calle Hondón de las Nieves 7, 03005 Alicante, hola@boiaplanet.net); T291 runs before T285 so Google never indexes the placeholders (Álvaro)
- 2026-10-14: The 3 current events are official, not sample (Álvaro)
- 2026-10-14: Plan approved by Álvaro; T291 launched first; T286 waits for Álvaro to see a Codex example image before it runs
- 2026-10-14 T291: audit also removes the «Datos de muestra» banner from legal pages, since the legal texts are approved (orchestrator)
- 2026-10-14 T286: Álvaro said «lanza el nuevo plan» after seeing the Codex example images (output/og-ejemplo/); taken as approval of that style (orchestrator)
- 2026-10-14 T285: public member Carnets /carnet/[id] get noindex and stay out of the sitemap (real people now that accounts are on) (orchestrator, privacy)
- 2026-10-14: Google sign-in stays out for now (Álvaro)
- 2026-10-14: «La Sosia» (Koko Moreno, Tonito Montana) is real radio content, genre Reggaetón, first song on landing and /mar, then shuffle (Álvaro)
- 2026-10-14: WebGL recovery added to this plan (Álvaro)
- 2026-10-14: Remove site-wide noindex now; sample events included in structured data until real content arrives (Álvaro)
- 2026-10-14: Share image = landing planet + BOIA wordmark; reel stays as it is; tickets-above-the-fold not in this plan (Álvaro)
- 2026-10-14: Name is BOIA.PLANET / boiaplanet everywhere, no «demo» (Álvaro)
- 2026-10-14: Canonical host boiaplanet.net on both hosts to avoid duplicate content with the Vercel copy (orchestrator)
- 2026-10-14: The Carnet block goes right after upcoming events (orchestrator, reversible)

## Proposals (new scope)

## Log
- 2026-10-14 21:55 T291 launched · attempt 1 · agent ad65597d1d623fa72 (sonnet)
- 2026-10-14 21:55 Codex example share images requested for T286 (output/og-ejemplo/) · agent a87db94c446b6bdef
- 2026-10-14 22:05 T291 sonnet done · branch worktree-agent-ad65597d1d623fa72 · 13c25c3; Opus audit launched · agent a7baeb48d69c0726a (also removes the now-false «Datos de muestra» banner on legal pages)
- 2026-10-14 22:20 T291 done · merged d1e82b2
- 2026-10-14 22:30 pushed ae86acd (accounts switch-on build, T279–T284 + T291) on Álvaro's word
- 2026-10-14 22:30 T285 launched · attempt 1 · agent af20cbf8ca09e7f4e (sonnet)
- 2026-10-14 22:30 T288 launched · attempt 1 · agent af05c91beda95c745 (opus)
- 2026-10-14 22:45 accounts live on Vercel; Cloudflare build missed the two build variables (CSP without Supabase) — Álvaro to move them to Build vars and retry
- 2026-10-14 22:50 T285 sonnet done · branch worktree-agent-af20cbf8ca09e7f4e · 50c6db9; Opus audit launched · agent aa460eafa118f071a
- 2026-10-14 23:00 T285 done · merged 5f53fff
- 2026-10-14 23:02 T286 launched · attempt 1 · agent a61220d05bcec5c93 (opus)
- 2026-10-14 23:40 T288 done (opus) · 29206eb; integration conflict in apps/web/lib/i18n/es.ts with T285 → sent back to agent af05c91beda95c745
- 2026-10-14 23:40 T293 launched · attempt 1 · agent ad6aed5b944a67086 (opus); 3 agents briefly (T288 resolving a conflict)
- 2026-10-14 23:50 Cloudflare rebuilt with the build variables: boiaplanet.net now on production Supabase (CSP checked); accounts live on both hosts
- 2026-10-15 00:10 T288 done · merged 5a6def7; migration 20261014100300 applied to dev and production (additive enum value; the web does not read home_blocks from Supabase, so no row needed)
- 2026-10-15 00:30 T286 done (opus) · 3ca4931; integrating
- 2026-10-15 00:35 T286 integration tests_failed (landing budget just over 200 kB after T288 + og meta); reverted 73bc40f; attempt 2 launched · agent abe81a058f38e207b (target ≤ 198.5 kB, no budget raise)
- 2026-10-15 01:00 T286 done · merged 521ed4e
- 2026-10-15 01:02 T287 launched · attempt 1 · agent a8d8b2f6257464b03 (sonnet)
- 2026-10-15 01:30 T293 done · merged 5d4d988
- 2026-10-15 01:32 T294 launched · attempt 1 · agent a1f36399650e584b5 (opus); T293 worktree still locked by its agent, branch kept for now
- 2026-10-15 01:45 T287 sonnet done · f52ae1f; Opus audit launched · agent a40702293c162deea (adds Event JSON-LD on /eventos/[slug]; omits sample prices)
- 2026-10-15 02:00 T287 done · merged 970edc4
- 2026-10-15 02:02 T292 launched · attempt 1 · agent af5af5190f556ada7 (opus)
- 2026-10-15 02:40 T294 done · merged b2cf36a
- 2026-10-15 02:45 T292 integration conflict (es-admin.ts, switch-on doc) with T294 → sent back to agent af5af5190f556ada7
- 2026-10-15 02:45 T289 launched · attempt 1 · agent ae960f277bf3887e0 (opus); T290 waits for a slot
- 2026-10-15 03:00 T292 conflict resolved by agent (383592a); integrating
- 2026-10-15 03:00 T290 launched · attempt 1 · agent ac42bea2dbd102b3b (opus)
- 2026-10-15 03:10 T292 done · merged 3712d3e
- 2026-10-15 03:25 T290 done · merged 3d950b3
