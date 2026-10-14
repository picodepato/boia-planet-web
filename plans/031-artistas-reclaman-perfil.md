# Plan 031 — Artists claim their profile

Status: active
Created: 2026-10-15
Base branch: main
Goal: Today the 26 artist profiles on /artistas (content, managed in the Admin) and the artist Carnets (members with `carnets.is_artist`, created through the single global artist link) are two separate tracks: a listed artist who signs up shows twice on /artistas and «Ver carnet» does not open their real Carnet. Álvaro, 2026-10-15: let artists claim their profile in three ways — (1) a personal claim link per artist that the Admin creates and sends (automatic join), (2) «¿Eres uno de estos?» when signing up with the general artist link, which creates a request the Admin approves or rejects, (3) the Admin joins a Carnet to a profile by hand (for artists already registered). A claimed profile shows once on /artistas under the Carnet's nickname (Álvaro's choice), with the Carnet's photo/avatar and music link, keeps the profile's genres, and «Ver carnet» opens the real Carnet; unclaimed profiles stay as today; the Admin can always undo a join.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 027 (`plans/027-cloudflare-doble-despliegue.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded from vitest, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`. Álvaro runs the project. Never run the full e2e suite (one spec only if strictly needed).
Accounts rules for every task: accounts mode is LIVE in production since 2026-10-14 (Supabase project ref kzxdywtysrcnqqjfhhnc): agents NEVER touch it. New migrations are applied to the dev project only (`boia-planet-dev`, credentials in the main checkout's `apps/web/.env.local`, read by absolute path) and listed in `docs/propuestas/2026-10-03-produccion-supabase.md`; the orchestrator applies them to production before the plan's push. Security model as plan 029 T278: admin-only actions through private SECURITY DEFINER functions with an INVOKER wrapper, empty search_path, role check inside, tests as anon/member/admin in `pnpm test:supabase`; secret codes stored only as hashes (like `private.artist_link`). Local/demo mode must keep working (no Supabase variables): mirror the behaviour where the local store already models artist Carnets, or degrade gracefully, and say which. Landing critical-path budget (`scripts/landing-budget.mjs`, 200 KB gzip, ~198.7 now) and `pnpm cf:measure` must still pass: Admin and claim code stays off the landing. All new UI text through `apps/web/lib/i18n/`, `muestra` until Álvaro approves it. Audit rule as plan 029 (sonnet/haiku tasks get an Opus audit).

## Tasks

## T295 — Join an artist Carnet to its profile, and show it once
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: The data model and the display for a claimed profile, plus the Admin's manual join (way 3). Add the link between a member's Carnet and a content artist profile (e.g. `carnets.artist_profile_id` text, unique, referencing the content artist id/slug; content artists live in the store's `artists` content area, not in a table — check and choose the cleanest join, log it). Admin, in «Socios» (and/or the artists editor): «Unir a un perfil de artista» on an artist Carnet (pick from the unclaimed profiles), «Deshacer unión» on a joined one; joining also sets `is_artist`; every change goes to the admin audit trail. Display: /artistas, the landing's ArtistRotator and any artist list show a claimed profile ONCE, with the Carnet's nickname as the name (Álvaro), the Carnet's photo/avatar and music link (falling back to the profile's if the Carnet has none), the profile's genres, and «Ver carnet» opening the real public Carnet; the separate Carnet entry disappears; unclaimed profiles and unjoined artist Carnets show as today. Undoing restores both entries.
- Context: `packages/contracts/src/content.ts` (`artistSchema`), `packages/store/src/sample/content.ts` (`ARTISTS_V14`), `packages/store/src/local.ts` ~986–1037 (local artist Carnets, `artistCarnetId`), `apps/web/lib/artists/registered.ts`, `apps/web/app/(landing)/components/artist-rotator.tsx`, `apps/web/app/(landing)/artistas/page.tsx`, `apps/web/app/admin/real/socios.tsx` (`admin_set_artist` ~77), `supabase/migrations/20261003100000_accounts.sql`, `20261006100600_member_numbers_artist_link.sql`, `20261008100200_artist_music.sql`, REQ-IDE-018 / REQ-COM-026..029 / REQ-ADM-005 / REQ-ADM-019 in `docs/spec/09-requisitos.md`.
- Scope: may touch those files, a new migration (dev only) + switch-on doc, Admin UI, artist list components, i18n, tests, `docs/spec/estado.md` / must not change the general artist link flow (T297 does), must not touch production.
- Done when:
  - unit tests: merge function (profiles + artist Carnets → one list): a joined pair shows once with the Carnet nickname, Carnet photo/link (fallback to profile), profile genres and the Carnet link; unjoined items unchanged; undo restores both → pass
  - `pnpm test:supabase` (dev): admin can join/unjoin (audit row written); member and anon cannot; a profile cannot be joined to two Carnets → pass
  - Test command → exit 0
- Outcome: carnets.artist_profile_id (slug, unique); Admin join/undo in Socios with audit; one merged entry on /artistas and ArtistRotator (Carnet nickname, photo, music; profile genres); private.join_artist_profile for T296/T297; migration 20261015100200 (dev); landing 199.2 kB — 65f1ee7

## T296 — Personal claim link per artist
- Status: done
- Depends on: T295
- Model: opus
- Skills: none
- Goal: Way 1. In the Admin, next to each UNCLAIMED artist profile, «Crear enlace para reclamar»: generates a random one-time code for that profile (shown once, with a copy button and a ready-to-send WhatsApp text; stored only as a hash with the profile id and a creation date; creating a new one invalidates the previous one for that profile; optional expiry of 30 days — decide and log). Opening `/artista/reclamar/<code>` (new route, both hosts, noindex) shows «Reclama tu perfil de <nombre> en BOIA» and leads to the Carnet sign-up (email + code); when the Carnet is created (or, if the person already has a Carnet, after signing in), the server checks the code and joins the Carnet to that profile automatically (T295's join, `is_artist` set, audit row «claim_link»); the code is then spent. Wrong, spent or expired code → a clear message and a normal sign-up, no join. A profile that is already claimed cannot get a link. Admin sees per profile: unclaimed / link sent (date) / claimed by <nickname>.
- Context: T295's join; the existing artist link (`apps/web/app/artista/[code]/`, `lib/account/artist-link.ts`, `save_profile(..., p_artist_code)`, `admin_rotate_artist_link`) as the pattern; Carnet sign-up flow (`lib/account/sign-in-sheet.tsx`, `carnet-editor.tsx`); T285's `NOINDEX` in `lib/seo.ts` and robots.
- Scope: may touch those files, a new route, a new migration (dev only) + switch-on doc, Admin UI, i18n, tests / must not change T295's display rules or the general artist link.
- Done when:
  - `pnpm test:supabase` (dev): a valid code joins on sign-up and on sign-in with an existing Carnet; spent/expired/rotated codes do not join; only admin can create codes; codes are stored hashed → pass
  - unit/component tests: claim page states (valid, invalid), Admin status per profile → pass
  - Test command → exit 0
- Outcome: per-profile claim links (hashed, 30-day expiry, one per profile), /artista/reclamar/<code> (noindex), claim_artist_profile on sign-up/sign-in, Admin «Perfiles de artista» panel; /carnet/artista-<id> redirects to the real Carnet; migration 20261015100300 (dev) — 0769875

## T297 — «¿Eres uno de estos?» with the general link, approved by the Admin
- Status: running (attempt 1)
- Depends on: T296
- Model: opus
- Skills: none
- Goal: Way 2. When someone creates their Carnet through the general artist link (`/artista/<code>`, valid code), after sign-up show «¿Eres uno de estos artistas?» with the UNCLAIMED profiles (search by name) and «No, soy nuevo»; choosing one creates a claim REQUEST (pending), never a join: anyone with the general link could pretend to be someone else. The artist sees «Solicitud enviada: BOIA la revisará» in their Carnet. The Admin gets a «Solicitudes de artistas» list (count badge in the Admin nav) with Carnet nickname, email, chosen profile and date: «Aprobar» joins them (T295, audit «claim_request_approved»), «Rechazar» closes it (the Carnet stays a normal artist Carnet). One pending request per Carnet and per profile at a time; a profile that gets claimed by another way closes its pending requests. The artist can cancel their request.
- Context: T295 and T296; the general artist link flow; Admin «Socios»; existing admin badges/lists for patterns.
- Scope: may touch those files, a new migration (dev only) + switch-on doc, Admin UI, sign-up flow after the artist link, i18n, tests / must not join without Admin approval.
- Done when:
  - `pnpm test:supabase` (dev): member creates/cancels a request only for themselves; admin approves (join + audit) or rejects; requests for an already-claimed profile are closed; anon cannot see requests → pass
  - unit/component tests: the picker after the general link, the «Solicitud enviada» state, the Admin list → pass
  - Test command → exit 0
- Outcome:

## Decisions
- 2026-10-15: Álvaro: when this plan is done and pushed, message the session «Orchestrator: plan y detalles originales» [b8b0e7] so it launches its next plan, which it already has ready (orchestrator)
- 2026-10-15: Álvaro: push when every task is done (git push origin main deploys both hosts), after applying the plan's migrations to production (orchestrator)
- 2026-10-15: All three ways (personal link, request + approval, manual join by the Admin); on /artistas a claimed profile shows the Carnet's nickname (Álvaro)
- 2026-10-15: Request + approval because the general artist link is shared and could be used to impersonate (orchestrator)

## Proposals (new scope)
- 2026-10-15 T296: event line-ups still show a claimed profile's name instead of the Carnet nickname; event-card.tsx is on the landing critical path (0.8 kB left) — needs a budget decision or a lighter approach (Álvaro)

## Log
- 2026-10-15 T295 launched · attempt 1 · agent a76cbaf455e18ad7d (opus)
- 2026-10-15 T295 done · merged 65f1ee7
- 2026-10-15 T296 launched · attempt 1 · agent af145814d94c78100 (opus); also covers line-ups / /carnet/artista-<id> for claimed profiles (left out of T295)
- 2026-10-15 T296 done (opus) · 821d8f4; integrating. Line-ups still show the profile name (event-card is on the landing critical path, 0.8 kB left) → Proposals
- 2026-10-15 T296 done · merged 0769875
