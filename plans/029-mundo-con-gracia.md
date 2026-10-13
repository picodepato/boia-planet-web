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
- Status: running (attempt 1)
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
- Outcome:

## T273 — The after island (03:00–07:00 Alicante time) and the after boat
- Status: running (attempt 1)
- Depends on: T270
- Model: fable
- Skills: blender-modeling-workflow, blender-asset-validation
- Goal: An island, modelled in Blender like the other event islands, that exists only between 03:00 and 07:00 Europe/Madrid time (whatever the chosen mood): sound system, neon, lights pulsing with the music, fish dancing around it; it fades in at 03:00 and out at 07:00 even if the player is there. Reaching it the first time gives the achievement "There's always an after", a big coin prize (`muestra` amount in config) and unlocks the **barco del after** (modelled in Blender) for free in the shop/garage: a battered boat with neon, disco ball, a blown speaker, cans, sunglasses and a punctured float (brand-safe, no drug references), with its own horn sound for T271 if that is already in. Reuse the `?hora=` override from T270.
- Context: `engine/island-models.ts`, `engine/islands.ts`, `packages/world/src/worlds/arcilla/map.ts`, boats in `tienda.tsx` and `public/art/barco` (follow how existing boats are defined/rendered), `lib/mundo/achievements.ts`, wallet APIs, the T270 hour helper.
- Scope: may touch `engine/*`, Blender sources under `art/` / `tools/blender/` and the exported `.glb` files under `public/art/`, `packages/world`, the boats catalogue (one new boat), achievements registry, i18n / must not touch prices or behaviour of existing boats, tickets, discounts.
- Done when:
  - unit tests: time window in Europe/Madrid (02:59 no, 03:00 yes, 06:59 yes, 07:00 no, DST change days), prize given once, boat unlocked once → pass
  - dev override `?hora=4` shows it
  - island and boat `.glb` each ≤ 300 KB, validated (multiview renders in ESTADO), not downloaded outside 03:00–07:00 unless the boat is owned/selected
  - Test command → exit 0; `pnpm cf:measure` → ≤ 2,800 KiB
- Outcome:

## T274 — Achievements and hints for every new secret
- Status: pending
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
- 2026-10-13: If Álvaro does not answer a blocked question (Telegram wait timed out, no reply in session), the orchestrator (Opus) picks the best reversible option, logs it here and continues; irreversible or outward-facing actions (push, deploy, production, emails, accounts) still need his explicit yes; an unanswered push offer means no push (Álvaro)
- 2026-10-13: Security checklist (`plans/seguridad-pendiente.md`) stays with Álvaro; offer it again at the next plan (Álvaro)

## Proposals (new scope)
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
