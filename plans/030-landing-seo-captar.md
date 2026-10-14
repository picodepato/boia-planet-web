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
- Status: pending
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
- Outcome:

## T285 — Open to Google: index, titles, canonical, sitemap and robots
- Status: pending
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
- Outcome:

## T286 — Share images: planet + BOIA for the site, one per event
- Status: pending
- Depends on: T285
- Model: opus
- Skills: none
- Goal: When the home is shared on WhatsApp/Instagram/X it shows a 1200×630 image of the landing's 3D planet with the BOIA wordmark (Álvaro's choice); /mar and the other main pages may reuse it. Each event (event page if it exists, otherwise its anchor/share URL) gets its own 1200×630 image: the planet image composed with the event's name and date in the landing's fonts/colours (Upheaval, orange #e8542a-style palette as on the site). Produce them as static files at build time (no runtime image generation on the Workers: check `@opennextjs/cloudflare` limits; a Node script under `apps/web/scripts/` run in `prebuild` or committed PNG/WebP outputs, whichever keeps both hosts identical), capture the planet from the real scene (Playwright screenshot of the hero at a fixed seed/angle, or the existing hero stills) so it looks like the site. Wire `openGraph` and `twitter` (`summary_large_image`) metadata with absolute boiaplanet.net URLs, `og:locale es_ES`, `og:site_name BOIA.PLANET`. Each image ≤ 300 KB. Leave Álvaro a dev URL or a list of paths to look at the images.
- Context: T285's metadata, `app/(landing)/hero-stills.tsx`, `public/art/landing/`, `lib/intro/`, `lib/fonts.ts`, sample events in `packages/store/src/sample/content.ts`.
- Scope: may touch metadata, a new generation script + its outputs under `apps/web/public/og/`, package.json scripts, tests / must not change the landing's visible design or its critical path.
- Done when:
  - unit test: home, /mar and every sample event resolve an `og:image` with an absolute boiaplanet.net URL that exists in `public/` and is 1200×630 and ≤ 300 KB → pass
  - Test command → exit 0
- Outcome:

## T287 — Structured data for Google: organisation, site and events
- Status: pending
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
- Outcome:

## T288 — «Sácate el Carnet» block and a WhatsApp that is easy to find
- Status: pending
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
- Outcome:

## T289 — The landing planet survives losing its 3D
- Status: pending
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
- Status: pending
- Depends on: none
- Model: opus
- Skills: none
- Goal: Álvaro gave a real track on 2026-10-14: `C:\Users\alvar\Downloads\koko moreno, tonito montana - la sosia v2 - 2026_09_05 (1).mp3` (3.8 MB, read it by that absolute path; approved by Álvaro, it is real content, not `muestra`). Add it to the radio as title «La Sosia», artist «Koko Moreno, Tonito Montana», genre Reggaetón (`reggaeton`), and make it THE first song: the first song a visitor hears is always «La Sosia», both on the landing's radio and on the boat's radio in /mar (Álvaro: «es la primera canción en los dos casos, luego es aleatorio»); after it, the radio continues as today (shuffle by default). Copy it under `apps/web/public/radio/` with a clean filename (e.g. `radio/real/la-sosia.mp3`; keep the original bytes unless re-encoding to ~128–160 kbps MP3 keeps it clearly good and much lighter — log the choice), read its real duration, add it to the bundled catalog (`lib/radio/muestra.json` / `muestra.ts`, or a small real catalog merged in front of the sample one if that is cleaner) with `first: true` and order 0, and move `first` off `muestra-001`. Make sure the player really starts with the `first` song when there is no current song (today `nextSong` with shuffle picks at random when `current` is null: fix it so the first play honours `first`, then shuffle), on both the landing and /mar, and in local and accounts modes. Accounts mode: the shared `radio_songs` table overrides the bundled catalog when it has rows; if that is the case on dev, add the song there too (upload path/RPC used by the Admin, `radio_set_first`) or document in the switch-on doc (`docs/propuestas/2026-10-03-produccion-supabase.md`) that Álvaro uploads it from the Admin and marks it first. The song must not load on the landing's critical path (only when the radio starts) and must play on both hosts (check Cloudflare static asset limits: 25 MiB per file).
- Context: `apps/web/lib/radio/` (`catalog.ts`, `muestra.json`, `muestra.ts`, `player-model.ts`, `player.ts`, `shared-store.ts`, `song-files.ts` and tests), `app/(landing)/components/landing-client.tsx`, the /mar radio UI (`lib/radio/ui`), `packages/contracts` radio schema, `art/radio/generar.py` (generates the sample catalog: make sure regenerating it does not drop the real song).
- Scope: may touch `lib/radio/`, the catalog JSON, `public/radio/`, the contracts schema if a `muestra` flag per song is needed, tests, the switch-on doc / must not delete the sample songs, must not touch production.
- Done when:
  - unit test: with no current song, shuffle on or off, the first song played is the one with `first: true` («La Sosia»); the next ones follow the current shuffle rules → pass
  - unit test: the catalog parses, «La Sosia» is the only `first`, its `src` exists in `public/` → pass
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-14: Legal identity text approved (BOIA PLANET, CIF en trámite, Calle Hondón de las Nieves 7, 03005 Alicante, hola@boiaplanet.net); T291 runs before T285 so Google never indexes the placeholders (Álvaro)
- 2026-10-14: The 3 current events are official, not sample (Álvaro)
- 2026-10-14: Plan approved by Álvaro; T291 launched first; T286 waits for Álvaro to see a Codex example image before it runs
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
