# Plan 029 — A world with jokes: weather, big waves, characters with lines and the after island

Status: active
Created: 2026-10-13
Base branch: main
Goal: Make `/mar` funnier and more surprising without touching the sales flow: short weather episodes, big waves that work as ramps (backflip achievement), a thieving seagull, a dancing crab, a lost tourist on an inflatable flamingo, a horn and a napping boat, characters with lines that depend on the mood, a daily "horóscopo boiero", a proper welcome at the port, and a night-only "after" island (03:00–07:00 Alicante time) that pays a lot of coins and unlocks a battered after-party boat. Every new secret gives an achievement (never a Carnet stamp: stamps are only for tickets), and the `boia-secretos` buoy hints at the missing ones. Plus fixes from Álvaro: a gallery that opens photos and videos full screen (also in /mar) with longer clips, at least 7 photos on the home with the 4 real ones, the Puig Campana label on the map, the map hint that never goes away, and getting the Carnet's email + code sign-up ready to switch on in production. Day/night stays as it is today (three moods chosen in the menu); no shooting stars; no new sea traffic; no Alicante landmarks in this plan.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 027 (`plans/027-cloudflare-doble-despliegue.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`. Álvaro runs the project. Never run the full e2e suite (one spec only if strictly needed).
Audit rule: a task whose Model is sonnet or haiku is audited before integration. When it reports done, the orchestrator launches an Opus audit agent on the same branch (continuation worktree) that reviews the diff against the task Goal, Scope and Done when, runs the Done-when commands, fixes what it finds and commits (`Txxx: audit fixes`), or reports failed if the work is not salvageable; only then is the branch integrated. Opus and Fable tasks are integrated as usual.
World rules for every task: all new UI text goes through `apps/web/lib/i18n/` (mostly `es-mar.ts` / `es-mundo.ts`) and is `muestra` until Álvaro approves it; jokes stay friendly to the brand (no drugs, no insults to real people or places). New 3D things are procedural low-poly in code (style of `engine/decor.ts`, `engine/wildlife.ts`, `engine/tortuga.ts`) unless the task says Blender; Blender models follow the existing island pipeline (`art/`, `tools/blender/`, `public/art/islas/3d/`), keep the `.blend`/script source in the repo, weigh ≤ 300 KB each as served `.glb`, and load lazily only when needed (never on the landing's critical path); new sounds are synthesized (style of `lib/mundo/sound.ts`); no new heavy assets, no external requests. Every random/time-based behaviour lives in a pure function in `packages/engine` or `apps/web/lib/mundo/` with unit tests and an injectable clock/RNG. Every feature gets a dev URL override so Álvaro can see it on demand (listed per task) and appends its line to a "Probar a mano" list in its ESTADO section. Respect `prefers-reduced-motion` and the existing low-power/quality settings (fewer particles, no flashes). Hosting is always both Cloudflare Workers (public) and Vercel (copy): anything that touches build, variables or deploy docs covers both. Mobile first: no new frame-time spikes; `pnpm cf:measure` must stay ≤ 2,800 KiB gzip. Coin amounts and prizes are `muestra` values in one config place, flagged for Álvaro (P24).

## Tasks

## T275 — Map fixes: Puig Campana label and the hint that never leaves
- Status: done
- Depends on: none
- Model: haiku
- Audit: opus
- Skills: none
- Goal: (1) In the big map view (opened from the minimap), Puig Campana's name only shows when zooming in, so it is hard to find. Move the island (`canon`, `mapa.puig-campana`, `packages/world/src/worlds/arcilla/map.ts` ~540) to a free spot of the map where its label is laid out at the map view's zoom without colliding with nearer islands/labels or the HUD (`labels.ts` `layoutPins`, `mar3d.ts` `placePins` ~4223), keeping it reachable by boat and away from races and other islands. Do not make it `always` unless moving it is not enough (log the decision). (2) The hint `mar.client.tocaUnaIslaPara` (`mar-client.tsx` ~2447) stays on screen while the map is open, and its «Cerrar» leaves the map. Turn it into a small popup that appears when the map opens and closes by itself after 2.5 s (tap also dismisses it), shown at most once per map opening; the map keeps its own close control, clearly separate from the hint.
- Context: the files above, `framing.ts` (zoom levels), `PIN_AVOID` in `labels.ts`.
- Scope: may touch `packages/world` (Puig Campana position only), `mar-client.tsx` (hint only), i18n, tests / must not touch other islands' positions, the Cañón minigame launched from Puig Campana beyond its position.
- Done when:
  - unit test: `layoutPins` with the map view's zoom and the new position shows Puig Campana's label (not hidden, not collided) → pass
  - unit/component test: the hint disappears after 2.5 s and the map is still open → pass
  - Test command → exit 0
- Outcome: hint is a 2.5 s popup with its own close; Puig Campana not moved, its label is kept and nudged to a free spot in map view (mapKeep), full opacity; haiku + Opus audit — 582c0fd

## T276 — Carnet sign-up with email + code, ready to switch on
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Creating the Carnet must ask for the email and the 6-digit code when accounts are on. The code exists since plan 008 (`lib/account/session.ts` `sendCode`/`verifyCode`, `sign-in-sheet.tsx`, `gate.ts` `requireAccount`, `carnet-editor.tsx` ~431) but production runs without the Supabase variables, so it never asks. (1) Against the dev project `boia-planet-dev` only (credentials from the main checkout's `apps/web/.env.local`, read by absolute path, never committed): prove end to end that creating a Carnet asks for email, sends the code, verifies it and stores the member in Supabase; that a guest's local progress merges in; that sign-out/delete work; fix whatever is broken. (2) Make sure the build behaves correctly in both modes on both hosts (Cloudflare via `pnpm cf:build`/`cf:measure`, Vercel via `pnpm build`) (no variables → local mode as today; variables → Carnet requires the code). (3) Write the exact switch-on checklist for Álvaro, step by step in Spanish with where to click: the two `NEXT_PUBLIC_SUPABASE_*` build variables on BOTH hosts (Cloudflare Workers Builds, the public `boiaplanet.net`, and Vercel, the copy; `docs/DESPLIEGUE.md` §2) with identical values, then a push so both rebuild and `hosts-parity` stays green, Supabase Auth custom SMTP with the existing Brevo account (the default Supabase SMTP only mails project members), sender `hola@boiaplanet.net`, code email template in Spanish, rate limits, Site URL and redirect URLs for `boiaplanet.net` and the Vercel copy, which migrations to apply and how, the privacy text that must be approved before collecting real emails, and how to check it works after the push. Put it in `docs/propuestas/2026-10-03-produccion-supabase.md` (update, do not duplicate) and add one line pointing to it in `plans/seguridad-pendiente.md`.
- Context: `lib/account/*`, `lib/repo.ts`, `lib/supabase/*`, `supabase/migrations/`, `docs/propuestas/2026-10-03-produccion-supabase.md`, `docs/DESPLIEGUE.md` §2, `plans/008-cuentas-carnet-rankings.md`, `pnpm test:supabase`, e2e with `E2E_SUPABASE=1`.
- Scope: may touch `lib/account/*`, `lib/mundo/carnet/*` (sign-up gate only), their tests, the two docs above / must not touch any panel, host variable or production Supabase project, must not apply migrations anywhere but dev, must not send email to addresses other than a test inbox, must not edit `docs/DECISIONES.md` or write the legal text itself.
- Done when:
  - `pnpm test:supabase` against dev → pass (counts in ESTADO)
  - the Carnet e2e spec with `E2E_SUPABASE=1` (only that spec) → pass
  - unit tests: without variables the Carnet is created locally with no prompt; with variables `requireAccount` blocks until verified → pass
  - Test command → exit 0
- Outcome: Carnet sign-up proven on dev (test:supabase 160 pass, cuenta e2e 10 pass); nickname bug fixed; test harness repaired; switch-on checklist for both hosts in docs/propuestas/2026-10-03-produccion-supabase.md — 0afe526

## T277 — Gallery: videos in full screen, videos in /mar, longer clips; more photos on the home
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: (1) **Lightbox**: the collage already lets people drag the pieces around and opens a tapped piece with an animation from its spot (`media-collage.tsx` `opened` phases, drag vs tap via `isDrag`/`CLICK_AFTER_DRAG_MS`). Keep both exactly: dragging still moves photos and clips and never opens them, a tap opens. Extend that existing open view (no second lightbox) so that tapping any photo or clip in `/galeria` (and in the home `#fotos` block for photos) opens it full screen: photos large, clips with play/pause, sound on/off, a progress bar and the poster while loading; next/previous with arrows, keyboard and swipe; close with ✕, Escape and swipe down; focus trapped and returned, accessible labels via i18n. Must work on iPhone Safari and inside the Instagram/TikTok in-app browsers (reuse what plan 026 learned about video in iOS webviews: `playsInline`, muted autoplay rules, user gesture for sound). The collage keeps its current muted looping preview. (2) **Clips in /mar**: the photos island sheet (`app/mar/sheet.tsx` ~327-354) shows clips too, with the same collage behaviour and the same lightbox. (3) **Longer clips**: raise the Admin upload limits from 30 s / 20 MB to 60 s / 50 MB (50 MB is the Supabase free plan's per-file cap); update `lib/admin/photo-upload.ts`, the Admin copy, and a new migration for the `event-clips` bucket `file_size_limit` if the bucket sets one (apply it to the dev project only; production migrations are Álvaro's, add the line to the T276 switch-on checklist or `plans/seguridad-pendiente.md`). Clips keep loading lazily (`preload="none"`/poster) so pages do not get heavier. (4) **Home photos**: Álvaro approved the rights of the 4 real photos `public/art/galeria/galeria-1..4.webp` (2026-10-13): mark them as real content (no longer `muestra`), put them in the home selection and raise the `#fotos` block limit so the home shows at least 7 photos (the 5 current + real ones, real ones first); keep the landing critical path under the 200 kB gzip cap (the block is lazy; check the build's landing budget check passes) and serve the photos at sensible sizes (`srcset`/widths, WebP).
- Context: `app/(landing)/galeria/page.tsx`, `app/(landing)/components/photo-galleries.tsx`, `media-collage.tsx` (~310-390 `ClipPiece`), `blocks.tsx` (~340-375), `packages/store/src/sample/content.ts` (~76 block limit, ~352-416 photos and selection), `lib/landing/resolve.ts` (~101-107), `app/admin/sections/photos.tsx`, `lib/admin/photo-upload.ts`, `supabase/migrations/20261008100400_gallery_clips.sql`, plan 026 (`plans/026-video-ios-webview.md`), REQ-COM-032 (clips never on the home: keep it).
- Scope: may touch the files above, a new lightbox component, i18n, tests, a new migration, `docs/spec/estado.md` for affected REQs / must not touch other landing blocks, the hero, ticket flows, production Supabase.
- Done when:
  - unit/component tests: dragging a piece still moves it and does not open it, a tap opens it; lightbox open/close/next/prev/keyboard, clip controls, swipe handlers; upload validation accepts 60 s / 50 MB and rejects above; home selection has ≥ 7 photos with the 4 real ones first and none of them `muestra` → pass
  - `pnpm build` landing budget check → under 200 kB (number in ESTADO)
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: viewer with prev/next/swipe/keys and playable clips (plan 026 iOS rules), clips in /mar, 60 s / 50 MB, home 7+ photos with the 4 real first (198.8 kB); sonnet + Opus audit (galeria e2e 6/6) — 0944e1e

## T278 — Database security: lock down SECURITY DEFINER functions before accounts go live
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: T276 found that `admin_sign_in_email` is callable by `anon` and returns the email of the Carnet 000 (Admin owner) account, and that four SECURITY DEFINER functions live in `public` (`admin_sign_in_email`, `discount_code_for`, `radio_reorder`, `radio_set_first`). Fix them with a new migration: nobody but the right role can call each one (revoke EXECUTE from `public`/`anon`/`authenticated` as needed and grant only what the app needs), each checks the caller inside the function (admin/owner role via the existing helpers), `set search_path = ''` (or pinned) with schema-qualified names, and no function leaks an email or a discount code to someone who should not get it. If the Admin sign-in flow needs to know the owner's email before login, redesign it so it does not (e.g. the Admin types the email, or the server route uses the service role) and adapt the client code. Then sweep ALL functions in `supabase/migrations/` for the same problems (SECURITY DEFINER without search_path, EXECUTE granted to anon, RLS gaps on tables they touch) and fix any found. Apply to `boia-planet-dev` only; production gets it with the switch-on migrations (add it to the checklist in `docs/propuestas/2026-10-03-produccion-supabase.md`).
- Context: `supabase/migrations/`, `lib/account/admin-auth.ts`, the radio and discount code callers in `apps/web`, the `*.supabase.ts` tests and `schema.supabase.ts` (its list of known exceptions), `pnpm test:supabase`, Supabase advisor rules (security definer, search_path).
- Scope: may touch `supabase/migrations/` (new migration only, never edit applied ones), the callers in `apps/web` and `packages`, the `*.supabase.ts` tests, the switch-on doc / must not touch production, panels, secrets, `docs/DECISIONES.md`.
- Done when:
  - new `*.supabase.ts` tests: as anon, each fixed function is denied (or returns nothing sensitive); as a normal member, admin-only functions are denied; as admin/owner, they work → pass
  - `schema.supabase.ts` known-exceptions list shrinks accordingly; a test fails if any public SECURITY DEFINER function lacks a pinned search_path or is executable by anon without being on an explicit allowlist → pass
  - `pnpm test:supabase` against dev → pass; `E2E_SUPABASE=1` the admin access e2e spec only → pass
  - Test command → exit 0
- Outcome: admin_sign_in_email dropped; discount_code_for/radio_* moved to private SECURITY DEFINER with INVOKER wrappers; every function has empty search_path; schema test enforces it; test:supabase 170 pass on dev; migration 20261013100200 dev only — 4518539

## T268 — Weather episodes: levante, summer storm, calima
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: A weather layer on top of the mood the player chose (día/tarde/noche stay as they are). About every 4 minutes of play (some jitter) a 30-second episode starts with a smooth fade in/out, picked at random among: **levante** (foam streaks and faster water, gentle sideways drift on the boat that never fights the controls or the autopilot badly), **tormenta de verano** (darker sky, closer fog, rain particles, lightning flashes with synthesized thunder a moment later), **calima** (orange haze, closer fog, muted sun). No episode during races, the Cañón, the Castillo or other minigames; an episode in progress ends softly when one starts. Under `prefers-reduced-motion` or low quality: no lightning flashes (thunder only), fewer particles. Flashes stay well under 3 per second and never full-screen white.
- Context: `engine/mar3d.ts` `applyMood()` (~3331) and the fog near/far per frame (~3521), `engine/planet.ts` sky uniforms + `setMood`, `engine/palette.ts` `mixMood`/`cloneMood`, `engine/water.ts` uniforms, `lib/mundo/sound.ts`, `packages/engine` for the pure scheduler.
- Scope: may touch `apps/web/app/mar/engine/*` (new `weather.ts` + hooks in `mar3d.ts`), `packages/engine` (pure scheduler + tests), `lib/mundo/sound.ts` (thunder, rain, wind), i18n / must not touch the mood menu behaviour, minigame logic, sales pages.
- Done when:
  - unit tests for the scheduler (first episode not before ~4 min, 30 s duration, no episode while a minigame is active, deterministic with a seeded RNG, reduced-motion flag removes flashes) → pass
  - dev override `?clima=levante|tormenta|calima` starts that episode at once
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: weather scheduler (30 s every ~4 min, no minigames), levante drift, storm with rain/flashes/thunder, calima haze, ?clima= override; cf 2,201 KiB — 9028c69

## T269 — Big waves as ramps and the "salto mortal"
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: Now and then (every 1–2 min of free sailing, never in minigames) a big swell rises somewhere ahead of the boat, visible a few seconds before (a moving crest with foam, procedural, drawn on the existing water). Crossing it launches the boat with the existing visual `BoatJump` (`packages/engine/src/circuit/jump.ts`) and a splash on landing; crossing it with turbo active makes a full flip in the air (backflip) and unlocks the achievement "Salto mortal" (wire the achievement id; T274 does the hints/stamps). The simulation stays 2D as today (the jump is visual), the camera follows smoothly, no motion sickness under reduced-motion (smaller jump, no flip spin of the camera).
- Context: `engine/mar3d.ts` (jump `this.air` ~3566, race ramps ~159-164 and ~708, turbo ~1248 and ~3251), `packages/engine/src/circuit/jump.ts`, `packages/engine/src/ship/boost.ts`, `engine/water.ts`, `lib/mundo/achievements.ts`.
- Scope: may touch `engine/*` (new `swell.ts` + hooks), `packages/engine` (pure swell spawner + crossing test + tests), achievements registry (one new id), i18n / must not touch race ramps behaviour, the 2D ship simulation, minigames.
- Done when:
  - unit tests: spawner timing and placement ahead of the boat, crossing detection, flip only with turbo, nothing during minigames → pass
  - dev override `?ola=1` spawns a swell right ahead
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: swells every 60–120 s as ramps, flip with turbo, secret achievement salto-mortal, ?ola=1; audit made the wave read clearly, no swells in map/Entradas voyage, no per-frame allocations; sonnet + Opus audit — 13fc7ca

## T270 — Characters in the water: thieving seagull, dancing crab, the lost tourist
- Status: done
- Depends on: none
- Model: fable
- Skills: blender-modeling-workflow, blender-asset-validation
- Goal: Three characters: the seagull and the crab procedural in code, the tourist on the flamingo modelled in Blender (≤ 300 KB, lazy). (1) **Gaviota ladrona**: from time to time a seagull dives at the boat, steals a few coins (never below zero, never more than a small cap, never during minigames) and flies off slowly with a coin in its beak; catching it within ~15 s gives the coins back plus a small bonus and the achievement "Gaviota pillada"; if not, it laughs (synthesized squawk) and leaves. (2) **Cangrejo bailarín**: a crab on a rock near the port that dances, in time with the radio when it plays (beat from the radio's analyser or its BPM; idle shuffle otherwise); tapping it makes it do a special move. (3) **El guiri del flamenco**: a sunburnt tourist on an inflatable flamingo drifting slowly around the map; tapping it shows a speech bubble cycling «Excuse me, where's the after?» and «There's always an after.» (exact English text), and between 03:00 and 07:00 Alicante time a third line pointing towards the after island (T273).
- Context: `engine/wildlife.ts`, `engine/tortuga.ts`, `engine/minikraken.ts` (procedural animals), coins/points pickups in `packages/world/src/worlds/arcilla/map.ts` and `behaviors.ts`, `lib/radio/`, `lib/mundo/sound.ts`, existing speech/toast UI in `mar-client.tsx`.
- Scope: may touch `engine/*` (new files per character + hooks), Blender sources under `art/` / `tools/blender/` and the exported `.glb` under `public/art/`, `packages/world` map entries, `packages/engine` (pure seagull steal/return rules + tests), radio read-only hook for the beat, achievements registry (new ids), i18n / must not touch the shop, wallet persistence format (use existing add/spend APIs), minigames.
- Done when:
  - unit tests: seagull never steals below zero or above the cap, returns coins + bonus if caught in time, no theft in minigames; guiri line selection by hour (Europe/Madrid) → pass
  - dev overrides `?gaviota=1` (attack now) and `?hora=4` (pretend it is 04:00 in Alicante, shared with T273)
  - the guiri `.glb` ≤ 300 KB, validated (multiview render in ESTADO), loaded lazily
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: thieving seagull (HUD escrow, caught = coins back + 3 + secret achievement gaviota-pillada), crab dancing at 124 BPM on the radio clock near the port, guiri on the flamingo from Blender (76 KB, lazy within 90 u) with its lines and the 03–07 hint, ?gaviota=1 ?hora=4 — 0bab932

## T271 — Boat toys: the horn and the napping boat
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: (1) **Bocina**: a horn button next to turbo in the bottom bar (and the `H` key); each boat has its own synthesized horn; honking three times near Boia Fiestera makes her dance for a few seconds (achievement "Fiestera bailando"); a short cooldown so it cannot be spammed into noise. (2) **Barco aburrido**: after 60 s with no input and the boat still, the captain (or the boat, if there is no captain figure) falls asleep: floating "Zzz", soft synthesized snore, and a seagull lands on the bow; any input wakes it with a little startle. Never while a menu, dialog or minigame is open. No secret codes (no BOIA typing, no disco-ball planet).
- Context: `mar-client.tsx` bottom bar `mar-bar` (~2489-2555, turbo button `mar-turbo`), `engine/mar3d.ts` keyboard (~2854) and pointer (~2877-2956), boats in `tienda.tsx` / `public/art/barco`, Fiestera NPC (`fiestera` in `map.ts`), `lib/mundo/sound.ts`.
- Scope: may touch `mar-client.tsx` (bar button only), `engine/*`, `packages/engine` (pure idle timer and horn rules + tests), `lib/mundo/sound.ts`, achievements registry, i18n / must not touch turbo behaviour, the shop flow, minigames.
- Done when:
  - unit tests: idle timer (resets on input, blocked by open UI), horn cooldown and the 3-honks-near-Fiestera rule → pass
  - dev overrides `?siesta=1` (nap after 5 s)
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: horn button + H key with per-boat voice, 3 honks make the Fiestera dance (also aboard), nap after 60 s with Zzz, snore and a bow gull measured per boat; audit fixed the bar layout, perches, captain, snore; sonnet + Opus audit — 55c2ec6

## T272 — Character banter, the daily horóscopo boiero and the port welcome
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: (1) Boia Fiestera, the castaway (`naufrago`) and the dolphin get a pool of short funny lines each (at least 6 per mood), chosen by the current mood: día = hungover morning, tarde = warming up, noche = full party. No repeats until the pool is used up. (2) At the port, a "horóscopo boiero" of the day: one of ≥ 30 short lines picked deterministically from the date (Europe/Madrid), the same for everyone that day, shown once per day as a bubble or a sign the player can tap again. (3) Arriving at the Puerto no longer says "Isla descubierta" (`island.firstVisit`): a proper welcome line (first visit) and a short "welcome back" variant afterwards. All lines are `muestra`, in Spanish, BOIA tone, brand-safe; list them all in the ESTADO section so Álvaro can rewrite them.
- Context: `lib/i18n/es-mar.ts`, `es-mundo.ts`, existing NPC dialogue for `fiestera`, `naufrago` and the dolphin encounter (`lib/mundo/encounters.ts`), `island.firstVisit`, mood state in `mar-client.tsx`.
- Scope: may touch i18n files, the NPC dialogue/bubble code, a new pure line-picker in `lib/mundo/` + tests / must not touch NPC prizes, discounts, encounters' rules.
- Done when:
  - unit tests: picker never repeats until the pool is exhausted, horóscopo is stable for a given date and changes the next day, welcome vs welcome-back → pass
  - dev override `?fecha=2026-12-31` for the horóscopo
  - Test command → exit 0
- Outcome: 109 muestra lines (Fiestera, castaway, dolphin by mood; 32+ daily horóscopos; port welcome / welcome back) in their own bubble, 30 s per speaker, horóscopo re-readable in the Puerto card, no drinks/drugs test; sonnet + Opus audit — 2977857

## T273 — The after island (03:00–07:00 Alicante time) and the after boat
- Status: done
- Depends on: T270
- Model: opus (fable until the models were done)
- Skills: blender-modeling-workflow, blender-asset-validation
- Goal: An island, modelled in Blender like the other event islands, that exists only between 03:00 and 07:00 Europe/Madrid time (whatever the chosen mood): sound system, neon, lights pulsing with the music, fish dancing around it; it fades in at 03:00 and out at 07:00 even if the player is there. Reaching it the first time gives the achievement "There's always an after", a big coin prize (`muestra` amount in config) and unlocks the **barco del after** (modelled in Blender) for free in the shop/garage: a battered boat with neon, disco ball, a blown speaker, cans, sunglasses and a punctured float (brand-safe, no drug references), with its own horn sound for T271 if that is already in. Reuse the `?hora=` override from T270.
- Context: `engine/island-models.ts`, `engine/islands.ts`, `packages/world/src/worlds/arcilla/map.ts`, boats in `tienda.tsx` and `public/art/barco` (follow how existing boats are defined/rendered), `lib/mundo/achievements.ts`, wallet APIs, the T270 hour helper.
- Scope: may touch `engine/*`, Blender sources under `art/` / `tools/blender/` and the exported `.glb` files under `public/art/`, `packages/world`, the boats catalogue (one new boat), achievements registry, i18n / must not touch prices or behaviour of existing boats, tickets, discounts.
- Done when:
  - unit tests: time window in Europe/Madrid (02:59 no, 03:00 yes, 06:59 yes, 07:00 no, DST change days), prize given once, boat unlocked once → pass
  - dev override `?hora=4` shows it
  - island and boat `.glb` each ≤ 300 KB, validated (multiview renders in ESTADO), not downloaded outside 03:00–07:00 unless the boat is owned/selected
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: after island (Blender, 284 KiB) only 03:00–07:00 Europe/Madrid with fade and DST tests, prize once, secret achievement, after boat (Blender, 63 KiB) unlocked once with its own horn; nothing downloaded outside the window — 66f95fd

## T274 — Achievements and hints for every new secret
- Status: done
- Depends on: T268, T269, T270, T271, T272, T273
- Model: haiku
- Audit: opus
- Skills: none
- Goal: Every secret from this plan has an achievement in the achievements screen with icon (made the same way as the existing achievement icons; find how they are made and follow it) and text (no Carnet stamps: stamps are only for tickets): Salto mortal, Gaviota pillada, Fiestera bailando, There's always an after, plus "Capeaste el temporal" (sail through a whole storm) and "Horoscopado" (read 7 different daily horóscopos). The `boia-secretos` buoy gives one cryptic hint for a secret the player has not found yet (random among the missing ones; a congratulation when all are found). Update `docs/spec/estado.md` only if an existing REQ is affected, and write in ESTADO the full list of new achievements with how to get each one.
- Context: `lib/mundo/achievements.ts`, `logros.tsx`, `lib/logros/`, the `boia-secretos` place in `map.ts`, the ids wired by T268–T273.
- Scope: may touch the achievements registry and UI, the `boia-secretos` behaviour, i18n, tests / must not touch the features' own logic beyond calling the unlock, the Carnet stamps.
- Done when:
  - unit tests: each new achievement unlocks from its trigger, hint picker only offers missing secrets and congratulates when none are missing → pass
  - Test command → exit 0
- Outcome: icons for the 6 new achievements, «Capeaste el temporal» (whole storm sailed, StormWatch) and «Horoscopado» (7 distinct days, bubble or Puerto card), boia-secretos hints for missing secrets + congratulation; haiku + Opus audit — 3679fc4

## T279 — Regressions found by Álvaro after the push: tap-to-move, Nochevieja label, character bubbles in the map
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Álvaro tried the published build (c041d61) on 2026-10-14 and found: (1) **Tap-to-move is broken**: tapping/clicking the water no longer sails the boat there, neither in the normal view nor from the big map (it worked before plan 029: 4150c56). Find the cause (git bisect between 4150c56 and c041d61 with a headless check; suspects: T271 nap wake on pointer-down / horn button, T275 map hint popup overlay, T274 250 ms polling, T269/T270 pointer handling, T277 viewer key capture) and fix it without losing the feature that broke it. (2) **Nochevieja's name is missing on the big map**: the event island "Isla de Nochevieja" must always show its label in the map view (events are important); T275 gave Puig Campana a kept, nudged label (`mapKeep` in labels.ts) that now sits on top of Nochevieja. Event/always pins must win over `keep` pins; Puig Campana's label must find another free spot or yield. Both labels visible at 360×640 and 1280×720. (3) **Character messages show in the map**: the banter bubbles (T272), the guiri bubble (T270), the seagull/crab/fiestera messages and the like appear when looking from far away in the map view. They must not show in the map view at all, and in normal view only when the boat is near that character (a sensible radius), never from far away.
- Context: `apps/web/app/mar/engine/mar3d.ts` (pointer ~2877-2956 `onDown`/`endStick`/autopilot), `mar-client.tsx`, `app/mar/engine/labels.ts` (`layoutPins`, `MAP_KEEP`, `nudgeClear`), `map-labels.test.ts`, `lib/mundo/banter.ts`, T270/T271/T272/T274 code.
- Scope: may touch the files above and their tests / must not remove any plan 029 feature.
- Done when:
  - an e2e or headless test proves tap on water sails the boat (normal view and from the map) → pass, and it fails on c041d61
  - `map-labels.test.ts`: Nochevieja and Puig Campana labels both visible at full opacity in map view at both sizes → pass
  - unit/component test: character bubbles hidden in map view and when the boat is beyond the radius → pass
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome: tap-to-move fixed (shared tmpV overwritten by T270 character check), e2e mar-toque guards it; event labels placed first in map view; bubbles hidden in map and beyond 600 u; map view fits every island (moves the view, zoom unchanged) — 3bd12e8

## T280 — Map close button, Castillo de Santa Bárbara and Las Calitas labels, coin glyph
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: Álvaro tested T279 locally (2026-10-14): (1) The big map's «Cerrar» button (T275 `.mar-mapclose`) is too big and covers labels: make it small, bottom-left, out of the way (or drop it if the map already closes another clear way, e.g. tapping the minimap again / Escape / back; keep at least one obvious, accessible way to leave the map, aria-label via i18n). (2) In the map view (zoomed out) the «Castillo de Santa Bárbara» island label does not show: make it show, even if the label sits a bit to the left of its island (labels.ts layout, like the event/keep handling from T275/T279). (3) «Las Calitas» label also missing in the map view, probably hidden by the close button: must show. All island labels in the map view should show at 360×640, 390×844 and 1280×720; extend map-labels.test.ts to assert every island label is visible and not covered by HUD controls (including the new close button position). (4) When the game gives coins, the notice shows a missing-glyph box instead of the coin symbol (points show a star fine). Likely an emoji not supported on Windows 10 (like 🪙, Unicode 13; T273 hit the same with 🪩). Find every place that renders the coin glyph (notices, HUD, shop, achievements, rewards) and use a symbol that renders everywhere (an inline SVG coin in the style of the existing icons, or the same approach the HUD coin counter already uses if it renders fine); add a test that the coin glyph is not 🪙 or another unsupported emoji.
- Context: `apps/web/app/mar/engine/labels.ts`, `mar3d.ts` (`placePins`), `mar-client.tsx` (map close, notices), `map-labels.test.ts`, T275/T279 status sections in ESTADO.md, i18n files for the coin symbol.
- Scope: may touch the files above, the coin glyph wherever it is rendered, their tests / must not remove plan 029 features or change island positions.
- Done when:
  - map-labels.test.ts: every island label visible in map view at the three sizes, none under the close button → pass
  - test for the coin glyph → pass; headless screenshot at 360×640 of a coin notice shows the coin (path in the status file)
  - e2e `mar-toque.spec.ts` still passes (only that spec)
  - Test command → exit 0
- Outcome: small ✕ close bottom-left (knots and horn hidden in map view), every island label kept in map view (mapKeeps, hang below / shrink to 0.7), layout cached while still; CoinIcon SVG everywhere coins show — 7cd3482

## T281 — New Carnet questions (Álvaro, 2026-10-14)
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: Replace the 5 public Carnet questions (v14 §44.1, D-08) with the set Álvaro chose on 2026-10-14, exact text, in this order:
  1. ¿Qué momento te hizo pensar «yo quiero estar en esto»?
  2. ¿Cuál es la canción que tienes en repeat ahora mismo?
  3. ¿Qué estás creando o tramando estos días?
  4. ¿Qué disco escucharías de principio a fin sin saltarte ninguna?
  5. Completa la frase: una buena fiesta necesita siempre…
  Question 5 is unchanged and keeps its id `buena-fiesta` and its answers. The other four are new questions with new ids (the old `cosa-mas-rara`, `descubrimiento`, `obra`, `mejor-recuerdo` are retired): their old answers are kept in storage but no longer shown anywhere (Carnet, public Carnet, Admin moderation keeps access if it already lists them), never deleted. Update everywhere the questions live: `packages/contracts/src/carnet.ts` (CARNET_QUESTIONS, with the comment explaining the change replaced §44.1 by Álvaro's decision of 2026-10-14), the i18n keys `carnet.q1..q5` in `apps/web/lib/i18n/es-zonas.ts`, the local store (`packages/store/src/local.ts`, sample data / muestra answers so the sample Carnets answer the new questions), the help text if needed, and a NEW Supabase migration that adds the new question rows and retires the old ones without deleting answers (look at `20260928100100_identity.sql` and how questions/versions are modelled; the test that requires the contract and the seeded rows to match must keep passing). Apply the migration to the dev project only (credentials in the main checkout's apps/web/.env.local, read by absolute path, never committed) and add it to the migrations step of `docs/propuestas/2026-10-03-produccion-supabase.md`. Update `docs/spec/` / `docs/spec/estado.md` where REQ-IDE-014 quotes the questions; never edit `docs/DECISIONES.md` (list under OUT OF SCOPE that D-08 needs Álvaro's note).
- Context: `packages/contracts/src/carnet.ts`, `apps/web/lib/mundo/carnet/*`, `apps/web/lib/mundo/carnet/public-carnet.ts`, `packages/store/src/local.ts`, `supabase/migrations/`, `*.supabase.ts` tests (`pnpm test:supabase`).
- Scope: may touch the files above, their tests, the switch-on doc, docs/spec / must not delete any stored answer, must not touch production.
- Done when:
  - unit tests: the Carnet editor and the public Carnet show exactly the 5 new questions in order; an answer to `buena-fiesta` survives; answers to retired questions are not shown and are not deleted → pass
  - `pnpm test:supabase` against dev → pass
  - Test command → exit 0
- Outcome: 5 new questions (ids momento-quiero-estar, cancion-en-repeat, creando-tramando, disco-entero, buena-fiesta kept); old ones retired, answers kept and labelled in moderation; RLS blocks answers to retired questions; migrations 20261014100100 + 20261014100110 dev only; sonnet + Opus audit — 836760c

## T282 — Sequential Carnet numbers from 10, editable from the Admin
- Status: done
- Depends on: T281
- Model: opus
- Skills: none
- Goal: Carnet numbers look random today. New Carnets must get sequential numbers starting at 10 (10, 11, 12…; 000 stays the Admin's, 1–9 reserved), in both modes: local/demo (packages/store local repository) and accounts (Supabase: a sequence or an atomic next-number in the member creation path, safe under concurrent sign-ups, skipping numbers already taken). Existing members keep the number they have (never renumber silently); the sequence continues after the highest number already given in the 10+ range only if that is below a sane cap, otherwise from the first free number ≥ 10 — decide, test and log it. The Admin can change any member's Carnet number from the Admin (members/Carnets section): integer ≥ 1, unique (clear Spanish error if taken), never 0 for a non-owner, logged in the existing admin audit trail if there is one; in accounts mode through an admin-only RPC (same security rules as T278: private SECURITY DEFINER + INVOKER wrapper, empty search_path, role check inside, tests as anon/member/admin). Wherever the number is shown (Carnet, public Carnet, QR/stamps, rankings) keeps working after a change.
- Context: find where numbers are assigned (`packages/store/src/local.ts`, `supabase/migrations/20260928100100_identity.sql`, `20261003100000_accounts.sql`), `lib/admin/demo-auth.ts` (ADMIN_CARNET_NUMBER), Admin sections in `apps/web/app/admin/`, T278's `security-definer.supabase.ts` and `schema.supabase.ts`.
- Scope: may touch the store, a new migration (dev only; add it to the switch-on doc), Admin UI and i18n, tests / must not renumber existing members, must not touch production.
- Done when:
  - unit tests (local): first new Carnet gets 10, then 11…; taken numbers skipped; Admin change validates range and uniqueness → pass
  - `pnpm test:supabase` against dev, with new tests for the sequence (incl. two concurrent creations) and the admin RPC permissions → pass
  - Test command → exit 0
- Outcome: accounts: next_member_number never below 10, counter reset once (migration 20261014100200, dev only); local: numbers from 10 per browser + Admin editor in Moderación; pnpm admin:carnet0 — 3a33729

## T283 — Change the Admin password
- Status: done
- Depends on: none
- Model: sonnet
- Audit: opus
- Skills: none
- Goal: Álvaro does not remember the Admin password and wants a way to change it. (1) Accounts mode: in the Admin's «Seguridad» section, a «Cambiar contraseña» form (current session must be fully signed in with TOTP / aal2; new password twice; minimum length per Supabase settings; `supabase.auth.updateUser`), plus on the Admin sign-in screen a «He olvidado la contraseña» link that sends Supabase's password recovery email to the typed address and a page to set the new password from that email link (redirect URL on both hosts; list it in the switch-on doc). (2) Local/demo mode (`lib/admin/demo-auth.ts`, PBKDF2 hash in the repo): a script `pnpm admin:password` that asks for the new password twice in the terminal with hidden input, generates a new random salt and hash with the same parameters, and rewrites `DEMO_ADMIN_PASSWORD` in `demo-auth.ts` (prints only «hash actualizado», never the password); document in the Admin docs that a commit + push is then needed for both hosts. The demo-auth tests that read `ADMIN_DEMO_PASSWORD` from the environment keep working.
- Context: `apps/web/lib/admin/demo-auth.ts`, `apps/web/app/admin/demo-gate.tsx`, `apps/web/app/admin/real/gate.tsx`, `lib/account/admin-auth.ts`, the Admin «Seguridad» section, `docs/propuestas/2026-10-03-produccion-supabase.md`.
- Scope: may touch those files, a new script under `apps/web/scripts/`, package.json scripts, i18n, tests / must not print or commit any password, must not change the current demo hash itself.
- Done when:
  - unit/component tests: change-password form validation and the aal2 requirement; recovery link flow; the script's hash function verifies with the existing `verifyDemoPassword` (or equivalent) for a test password → pass
  - Test command → exit 0
- Outcome: «Cambiar contraseña» in Seguridad (aal2), «He olvidado la contraseña» + /admin/recuperar (no account enumeration, tokens cleared), pnpm admin:password for the demo hash; tested on dev (supabase 4/4, e2e 3/3); sonnet + Opus audit — 136d03e

## T284 — Sign out that resets the device, and the account in the menu
- Status: running (attempt 1)
- Depends on: none
- Model: opus
- Skills: none
- Goal: Accounts mode only (no change in local mode; Álvaro said no to a «start from zero» button there). (1) **Sign out = this device starts from zero**: on «Cerrar sesión», flush anything pending to the account (existing `onBeforeSignOut` hooks), close the session, then wipe from this browser every copy of that account's data and every guest/game state (Carnet, points, coins, boats/skins, achievements, stamps, bottles drafts, race/cañón/castillo records, mascots, merged-guest leftovers, IndexedDB uploads tied to the account, caches in `lib/repo-member.ts` and the store) so the world starts as a first visit; KEEP only device preferences: sound/music/effects volumes, radio settings, the chosen mood (día/tarde/noche), language, cookie/consent choices, reduced-motion/quality. Before signing out, a confirmation: «Tu progreso queda guardado en tu cuenta. En este móvil empiezas de cero.» (i18n, muestra). Signing back in with the same email restores everything from the account; another person signing in sees only theirs (no merge of the previous person's data into the new account). (2) **Account in the menus**: where the menu appears when the user scrolls/slides down (find it: the landing's sticky/scroll menu and the /mar menu «Menú de a bordo»; Álvaro: «cuando se desliza hacia abajo y aparece el menú»), show the account: signed in → «Tu cuenta» with nickname/Carnet number and «Cerrar sesión» (same flow as above); signed out (accounts mode) → «Entrar». The existing `landing-sign-out.tsx`, `account-section.tsx` and the Carnet panel sign-out must all use the same flow.
- Context: `apps/web/lib/account/session.ts` (`signOut`, `onBeforeSignOut`, `mergeGuest`), `lib/repo.ts`, `lib/repo-member.ts`, `packages/store` (guest storage keys), `apps/web/lib/account/account-section.tsx`, `app/(landing)/components/landing-sign-out.tsx`, `lib/mundo/carnet/carnet-panel.tsx`, the /mar menu, e2e `cuenta.spec.ts` (E2E_SUPABASE).
- Scope: may touch those files, a single `resetDevice`/keep-list helper with tests, i18n / must not change local mode behaviour, must not delete anything server-side.
- Done when:
  - unit tests: after sign-out every game/account key is gone and every preference key is kept (the keep-list is explicit and tested against the real storage keys); no merge of a previous user's data into a new account → pass
  - `E2E_SUPABASE=1` `cuenta.spec.ts` (only that spec) extended: user A signs in, plays/earns, signs out → world is fresh; user B signs in → sees none of A's; A signs in again → has everything → pass
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-13: Day/night stays as the three menu moods; no shooting star; weather episodes 30 s every ~4 min, random invented (no real weather API) (Álvaro)
- 2026-10-13: Jumps come from big waves acting as ramps, no jump button; backflip with turbo (Álvaro)
- 2026-10-13: After island only 03:00–07:00 real Alicante time; reward = achievement + many coins + battered after-party boat, brand-safe, no drug references (Álvaro)
- 2026-10-13: Not in this plan: sea traffic, Alicante landmarks (Cara del Moro, mascletà, paella, turrón), photo mode, Cañón act 3 (Álvaro)
- 2026-10-13: Secrets give achievements only, never Carnet stamps (stamps are only for tickets) (Álvaro)
- 2026-10-13: Blender for the after island, the after boat and the guiri; seagull and crab procedural; ≤ 300 KB per model, lazy (Álvaro)
- 2026-10-13: Accounts: a task prepares and proves the email + code Carnet on dev and writes the switch-on checklist; Álvaro switches it on (Álvaro)
- 2026-10-13: No secret codes / disco-ball planet (Álvaro)
- 2026-10-13: Anything about hosting covers both hosts: Cloudflare (public) and Vercel (copy) (Álvaro)
- 2026-10-13: Gallery: full-screen lightbox with playable clips, clips in the /mar photos island, clip limits 60 s / 50 MB (Álvaro)
- 2026-10-13: Álvaro approves the rights of the 4 real photos `galeria-1..4`; they go to the home, which shows at least 7 photos (Álvaro)
- 2026-10-13: Models: sonnet/haiku where possible with an Opus audit before integration; T268 opus, T270 and T273 (Blender) fable, T276 (Supabase auth) opus; Codex only for images (Álvaro)
- 2026-10-13: Launch order: Álvaro's fixes first (T275, T276, T277), then the world tasks (orchestrator)
- 2026-10-13: T275: Puig Campana kept in place (routes and art); label priority `mapKeep` in map view only; audit touched labels.ts and mar3d.ts beyond the listed Scope (T275 audit)
- 2026-10-13: T276: removed a stuck test owner role once on dev; schema test lists known exceptions from plans 019–023; added a section to plans/seguridad-pendiente.md as the task asked (T276)
- 2026-10-13: New task T278 (DB security of SECURITY DEFINER functions), launched next (Álvaro: "arregla la función de la base y las otras")
- 2026-10-13: T277 audit: viewer video follows plan 026 (attributes before src, preload none, unload on nav), viewer captures its keys so /mar does not steer underneath, sound choice carries to the next clip (T277 audit)
- 2026-10-13: T268: busy = race or any minigame + 20 s calm after; no repeat of the same episode; levante 8 u/s west; flash max 35 % to lavender; edited mar-client.tsx beyond Scope to wire it (T268)
- 2026-10-13: T278: the real Admin now signs in typing the Carnet 000 account email + password + TOTP ("000" shortcut only in local demo), because no server route may hold the service key (T278)
- 2026-10-13: T269: swell every 60–120 s, 24 s life; flip only with turbo (not the Entradas voyage); no swells in map view or during the Entradas voyage; reduced motion: small jump, no spin (T269 + audit)
- 2026-10-13: T270: stolen coins are not debited (no client API subtracts coins; Scope forbids new wallet APIs): shown missing while the gull flees, returned "with the tide" if it escapes; crab beat fixed 124 BPM (no analyser: CORS); launch T273 before T272 since it is longer (orchestrator)
- 2026-10-13: T271: horn button outside the bar grid (phone: above the bar left of zoom; desktop: left of turbo); no nap while the thief seagull acts and no thief while napping (T271 audit)
- 2026-10-14: T273 switched from Fable to Opus for the rest of the task (Álvaro)
- 2026-10-14: T273: shop item renamed "After"; map pin 🎧 (🪩 is an empty box on Windows 10); Admin "visit island" achievements got an optional island name/count (lib/admin/achievements.ts, beyond Scope) (T273)
- 2026-10-14: main had Next's automatic tsconfig.json rewrite from a dev server; reverted before integrating T273 (orchestrator)
- 2026-10-14: T272: banter in its own bubble (right, under notices) because the top notice truncates on phones; no drink mentions or zodiac signs; welcome gender-neutral; alicanteDate next to alicanteHour (T272 audit)
- 2026-10-14: T274: the two new achievements are visible (not secret); boia-secretos keeps its once-per-visit dialogue and gives a hint after it on each pass (T274 audit)
- 2026-10-14: Carnet questions replaced (D-08 / §44.1): «yo quiero estar en esto», canción en repeat, qué estás creando o tramando, disco de principio a fin, una buena fiesta necesita siempre… (Álvaro)
- 2026-10-14: Sign out resets the device to a first visit, keeping only device preferences; account entry (or sign out) also in the menu that appears when sliding down; no «start from zero» button in local mode (Álvaro)
- 2026-10-14: T282: counter reset to after the highest number ≥ 10 if below 1000, otherwise to 9; local numbers count per browser; sample members get no number (T282)
- 2026-10-13: If Álvaro does not answer a blocked question (Telegram wait timed out, no reply in session), the orchestrator (Opus) picks the best reversible option, logs it here and continues; irreversible or outward-facing actions (push, deploy, production, emails, accounts) still need his explicit yes; an unanswered push offer means no push (Álvaro)
- 2026-10-13: Telegram question on the Supabase project (A reuse dev as production + new test project / B new production project) and the push offer timed out after 4 h: per the no-answer rule nothing outward is done (no push, no panel change); recommendation A stays for Álvaro (orchestrator)
- 2026-10-13: Security checklist (`plans/seguridad-pendiente.md`) stays with Álvaro; offer it again at the next plan (Álvaro)

## Proposals (new scope)
- 2026-10-14: admin-password.supabase.ts «el enlace abre una sesión aal1» is flaky in the full run (passes alone); test:supabase uses up member numbers on dev; a trashed member whose number was reused cannot be restored (T282)
- 2026-10-14: An Admin who loses both password and phone has no way back in (backup codes only after the password); dev min password length is 6, set 8 in production (T283 audit)
- 2026-10-14: D-08 in docs/DECISIONES.md still quotes the old Carnet questions: Álvaro to note the change (T281)
- 2026-10-14: 🪪 (Unicode 14) shows as an empty box on Windows 10 too (reward.tsx, sign-in-sheet, carnet panel/menu, checkout, es-mar); after island label may not fit at 360×640 at night; Puerto body rect vs dock model (T280)
- 2026-10-14: In map view the «Cerrar» button sits over the «El Remanso de los Cocodrilos» label (T279)
- 2026-10-14: Draw icons for the older achievements and the Admin keys boia…cofre so the panel is consistent; /juego (2D) gives no secret hints (T274 audit)
- 2026-10-14: The top notices are one line on phones and truncate existing texts ("Boia encontr…", seagull messages) (T272 audit)
- 2026-10-14: With accounts on, the server progress data must learn the new secret achievements and the after boat (today browser-only); the after island pier sits slightly off the shore up close (T273)
- 2026-10-13: Real coin loss for the seagull needs a negative ledger entry (local + Supabase RPC) — Álvaro decides (T270)
- 2026-10-13: Try on a phone: flip and camera feel at real frame rate (headless could not trigger it) (T269 audit)
- 2026-10-13: Defence in depth: ~20 private SECURITY DEFINER functions trust p_user from their public wrapper; add p_user = auth.uid() checks. TRASPASO ~405 still mentions typing 000 for the admin email; mark the SECURITY DEFINER item done in seguridad-pendiente (T278)
- 2026-10-13: admin-fotos.spec.ts has the same untranslated island-name line galeria.spec.ts had; the 4 real photos have no srcset (~260 KB lazy on phones) (T277 audit)
- 2026-10-13: SECURITY before switching accounts on: `admin_sign_in_email` is callable by anon and returns the Carnet 000 account email; SECURITY DEFINER functions in public (`admin_sign_in_email`, `discount_code_for`, `radio_reorder`, `radio_set_first`) need a review (T276)
- 2026-10-13: hosts-parity could also check that accounts are on/off identically on both hosts (CSP header) (T276)
- 2026-10-13: prettier issues in several `*.supabase.ts` tests (T276)
- 2026-10-13: Production: apply migration `20261013100100_gallery_clips_longer.sql` (event-clips bucket 50 MB) with the other switch-on migrations; applied to dev only (T277)
- 2026-10-13: Try the gallery viewer by hand on iPhone Safari and inside Instagram/TikTok (T277)
- 2026-10-13: On a 360 px phone the Puig Campana label sits ~45 px above its island and partly covers Isla de Nochevieja; a proper fix means moving the island and re-rendering its art (T275 audit)
- 2026-10-13: Fix stale data: mapa.json still has a stale `faro` minigame at (-10.5,-25.2) while map.ts puts the lighthouse at (-2.32,10.26) (T275 agent)

## Log
- 2026-10-13: plan drafted with Álvaro
- 2026-10-13: approved by Álvaro ("aprueba el plan y empieza"); plan 028 done; main clean, worktree baseRef head, Telegram OK, bypassPermissions; main test green from plan 028 last integration (479a38f)
- 2026-10-13 T275 launched (attempt 1, haiku), agent a1ef183e563a6caed
- 2026-10-13 T276 launched (attempt 1, opus), agent a4eba793614248545
- 2026-10-13 T275 haiku done (9c7eca2): island not moved (route test), canon label always:true, hint popup; layoutPins test missing. Opus audit launched, agent a03d940d071dc102c, branch base worktree-agent-a1ef183e563a6caed
- 2026-10-13 T275 audit done (4bcbbbd), integrated 582c0fd
- 2026-10-13 T277 launched (attempt 1, sonnet), agent ab5e49bb5c8072903
- 2026-10-13 T277 sonnet done (8c5d2b9). Opus audit launched, agent a1331ec5b6ea3d060
- 2026-10-13 T276 done, integrated 0afe526
- 2026-10-13 T268 launched (attempt 1, opus), agent a95f87962ffc91f9d
- 2026-10-13: T278 added by Álvaro, next to launch
- 2026-10-13 T277 audit done (3178a94), integrated 0944e1e
- 2026-10-13 T268 done, integrated 9028c69
- 2026-10-13 T278 launched (attempt 1, opus), agent a13f2d74366ae24f2
- 2026-10-13 T269 launched (attempt 1, sonnet), agent a893c7855c7d8fe56
- 2026-10-13 T269 sonnet done (0f97849). Opus audit launched, agent afd51daa15d6ea5c3
- 2026-10-13 T278 done, integrated 4518539
- 2026-10-13 T270 launched (attempt 1, fable), agent a017190b1102de517
- 2026-10-13 T269 audit done (dd4b97c), integrated 13fc7ca
- 2026-10-13 T271 launched (attempt 1, sonnet), agent abc82f58a5feeadad
- 2026-10-13 T271 sonnet done (c77bba0). Opus audit launched, agent a51a301b8c2e08dae
- 2026-10-13 T270 fable done (d57b4a4, 08e7784); integrate → conflict (mar3d, mar-client, achievements.test, engine package.json, sample progress); sent back to agent to merge main
- 2026-10-13 T270 conflict resolved by agent (88cc9bf), integrated 0bab932
- 2026-10-13 T273 launched (attempt 1, fable), agent a149a775331d33506
- 2026-10-13 T271 audit done (1df1709); integrate → conflict (mar3d, mar-client, sound.ts, engine package.json) with T270; sent back to audit agent to merge main
- 2026-10-13 T271 conflict resolved by audit agent (0ad4a92), integrated 55c2ec6
- 2026-10-13 T272 launched (attempt 1, sonnet), agent aa130675a45762f44
- 2026-10-13 05:30 T272 and T273 agents stopped by the API session limit; leftovers committed as WIP (66afc1b, e56bb90); continuation agents launched: T272 a2d1a03a76a741362 (sonnet), T273 ac589fdb479b60999 (fable)
- 2026-10-14 15:07 continuations hit the weekly limit (reset 14 Oct 14:00); leftovers committed (T272 4e047ac); relaunched on Álvaro's "Intentar nuevamente": T272 ad8ac08b891dfc6f4 (sonnet), T273 a6dbdc258a5d60564 (fable)
- 2026-10-14 T272 sonnet done (6d6b60d). Opus audit launched, agent aa150b8ee86c8577b
- 2026-10-14 T273 fable agent stopped at Álvaro's request; WIP 184903e; Opus continuation launched, agent a417b81b9c5f6cac3
- 2026-10-14 T273 done (ddc29bc), integrated 66f95fd
- 2026-10-14 T272 audit done (b7fbd8e), integrated 2977857
- 2026-10-14 T274 launched (attempt 1, haiku), agent a535e585e2f23d8f7
- 2026-10-14 T274 haiku done (d313278). Opus audit launched, agent a8131bad40a2752ba
- 2026-10-14 T274 audit done (a5a54ab), integrated 3679fc4 (tests green on that integration)
- 2026-10-14 plan done: 11/11
- 2026-10-14 pushed to origin/main (c041d61) on Álvaro's request
- 2026-10-14 plan reopened: T279 regressions reported by Álvaro after the push (tap-to-move, Nochevieja label, bubbles in map)
- 2026-10-14 T279 launched (attempt 1, opus), agent aebd224dddaad0415
- 2026-10-14 Álvaro added to T279: big map zoom further out so every island fits (sent to agent)
- 2026-10-14 T279 done (beb1ef1), integrated 3bd12e8; plan done again
- 2026-10-14 T280 added from Álvaro's local test (map close button, Santa Bárbara and Las Calitas labels, coin glyph)
- 2026-10-14 T280 launched (attempt 1, opus), agent a4ec31786fa0bec3c
- 2026-10-14 T281 added (new Carnet questions, Álvaro)
- 2026-10-14 T281 launched (attempt 1, sonnet), agent ac8ac3c102ef9ffb3
- 2026-10-14 T282 (sequential Carnet numbers from 10, editable in Admin) and T283 (change Admin password) added by Álvaro
- 2026-10-14 T281 sonnet done (cec555e). Opus audit launched, agent a641a149d60fc6547
- 2026-10-14 T280 done (d1b97ab), integrated 7cd3482
- 2026-10-14 T283 launched (attempt 1, sonnet), agent a9cd29eefb9d13f4d
- 2026-10-14 T283 sonnet done (f6a13a7). Opus audit launched, agent a5beddb0416553e50
- 2026-10-14 T281 audit done (98ce530), integrated 836760c
- 2026-10-14 T282 launched (attempt 1, opus), agent a908433e031e20047 (+ CLI admin:carnet0)
- 2026-10-14 T284 added (sign out resets device, account in menus)
- 2026-10-14 T283 audit done (48a1ec7), integrated 136d03e
- 2026-10-14 T284 launched (attempt 1, opus), agent a6966deea167aeb60
- 2026-10-14 T282 done (94f17ea); integrate → conflict in package.json with T283; sent back to agent
- 2026-10-14 T282 merge conflict resolved (60e7a72), integrated 3a33729
