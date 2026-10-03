# Plan 008 — Accounts with email, the ID-card Carnet, QR stamps, global rankings and bottles

Status: active
Created: 2026-10-03
Base branch: main
Goal: BOIA.PLANET stops being browser-only for the people who want to keep their progress. A visitor still sails as a guest, but saving anything (the Carnet, a skin, a QR stamp, a place in the ranking) asks for an email verified with a 6-digit code (Supabase Auth). Everything of value is then stored in Supabase through validated RPCs, and BOIA gets the list of members' emails with their consent. The Carnet is redesigned to look like a real ID card, with a "scan the party's QR" flow that puts the party's stamp on it. Rankings become global: race times per circuit, all-time points and season points. Message bottles become global, so everyone sees the latest 10, and they always sit where they can be read. /admin gets a real login (email code + TOTP) and four sections on real data. During a race, the yellow guide lines between islands disappear.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task (this machine is Windows 10, Git Bash): the two `packages/db` suites need a local Postgres that this machine does not have, hence the exclude; `PYTHONUTF8=1` makes the Python checks read UTF-8; if a guard blocks the chained test command, run its steps one by one. E2E: `E2E_PORT=<free port> pnpm e2e <spec files> --workers=1` (first time in a worktree: `pnpm --filter @boia/web exec playwright install chromium`); the machine is slow under load, rerun only failing specs; the full e2e run is done once by the orchestrator at the end of the plan, never per task. UI strings only by key in `apps/web/lib/i18n/`. When a REQ moves, update `docs/spec/estado.md` with its test (`python3 tools/spec/estado.py` must pass). Content (dates, tickets, photos, texts, legal texts, point amounts) stays `muestra`. Never commit `apps/web/public/atlas/`, `.claude/launch.json` or any `.env*` file other than `.env.example`. Never push or deploy. Never edit `docs/DECISIONES.md`: T95 drafts the decision text and leaves it for Hernán. Skills: each task's block names the skills it may invoke with the Skill tool; invoke none other. Every task runs on Opus 5.5.

Test deployment URL (Hernán, 2026-10-03): **https://boia-planet-roan.vercel.app** (not boia-planet.vercel.app); temporary until the final domain, which will replace it in Auth URLs and docs.

Supabase (dev project `boia-planet-dev`, created by Hernán on 2026-10-03): its keys are in `apps/web/.env.local` (copied into every worktree): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (publishable key), `SUPABASE_SERVICE_ROLE_KEY` (secret key, server and scripts only, never in client bundles), `SUPABASE_DB_URL` (session pooler connection string, for migrations and SQL tests). Never print, log or commit any of these values. Agents may apply migrations, seed `muestra` data and create/delete throwaway test users in that dev project without asking (Hernán), and never touch any other Supabase project. Test users use addresses under `@example.test` and are deleted by the tests that create them. Supabase's default mailer only delivers to the project team, so tests never read an inbox: they get the 6-digit code through the admin API (`auth.admin.generateLink`) with the service key. **Local mode must keep working:** when the Supabase env vars are missing (Vercel production today, unit tests, the default e2e run), the app behaves exactly as today on localStorage (D-20), so pushing `main` never breaks production. Supabase-mode e2e runs only when `E2E_SUPABASE=1` (T86 sets up the switch).

Decisions of 2026-10-03 that every task follows (interview, Hernán):
1. **When the email is asked.** Guests sail, race and read freely. The email is asked when they save something: creating or saving the Carnet, buying a skin, claiming a QR stamp, entering the ranking. One gate (`requireAccount(reason)`, T89) serves all of them.
2. **Verification.** Supabase Auth email OTP: the user types the email, receives a 6-digit code and types it on the same page. No magic link. The half-done login of round 1 (branch `worktree-agent-a208530713932c80c`, commit `a4c68d3`, D-10) may be reused where it helps.
3. **Consent (RGPD).** Accepting the privacy policy is mandatory (text `muestra`). Receiving BOIA news is a separate, optional, unticked checkbox. Each consent is stored with its date and the policy version. An account can be deleted from the Carnet. Legal texts stay `muestra` until P21.
4. **Guest progress always merges into the account** on sign-in (Hernán), every item passing the same server validation as a live action.
5. **Nicknames are unique** (case-insensitive), with a basic offensive-word filter. Rankings and public carnets show the nickname. The email is never public.
6. **What is stored (hybrid).** Everything of value lives in its own tables, written only through validated RPCs: the points/coins ledger, skin purchases and the equipped cosmetics, stamps, race times, discounts used and the Carnet profile. The rest of the store document (house, settings and other state) is saved as a per-account JSON copy. The client never writes value tables directly.
7. **Basic anti-cheat** in those RPCs: a minimum plausible time per circuit and version; a maximum number of points per action and per day; once per stamp and per discount; only known action types. A determined cheater is out of scope.
8. **Rankings:** race times per circuit (each account's best, global) and all-time points. The season-points ranking stays hidden in the UI until Hernán defines what a season is (its RPC from T86 stays). Each list shows the top and the viewer's own position even outside it, plus a «Mostrar más» button that loads the next page until every member is listed (Hernán).
9. **QR stamps.** One fixed QR per party. Each event has a secret code in Supabase, and the QR is a URL `/sello?e=<event>&c=<code>`. It is valid only within the party's time window, gives one stamp per account, and the stamp gives **50 points** (`muestra`, Álvaro adjusts). Two ways to scan: a «Escanear sello» button in the Carnet opens the camera inside the web, and the phone's own camera opens the URL directly.
10. **The Carnet looks like a real ID card.** A horizontal card. The front carries the avatar, nickname, member number, rank, points, member since and a QR to the public carnet. The back holds the stamps, passport-style. A tap flips it. Mockups first, then Hernán approves (T87).
11. **Admin.** It is entered with the email code plus TOTP (Supabase MFA, `aal2`, which the existing migrations already require). The owner role is given to an email by a script. Four sections move to real data: Fiestas y QR, Socios y emails (CSV export of news opt-ins; mark a member's carnet as artist so it shows in the artists' part; delete a carnet, e.g. a duplicate — Hernán), Moderación de botellas, Rankings (void a time or points). The other sections stay the local demo.
12. **Global bottles.** Everyone sees the **10 most recent** active bottles of all members, and each person has one active bottle. Bottles are placed outside the radius where an island's sheet opens on its own, and existing ones are moved out of it. The text filter blocks links, emails, phone numbers and offensive words. There is a report button, and the admin retires bottles.
13. **Race guide lines.** The yellow route lines between islands (`RouteLine`) hide from the race countdown until the race finishes, is cancelled (invalid) or the world changes.

## Tasks

## T86 — Supabase foundation: clients, migrations, validated RPCs and integration tests
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none
- Goal: Build the backend everything else in this plan uses. Add `@supabase/supabase-js` (and `@supabase/ssr` if the session needs cookies). Add clients in `apps/web/lib/supabase/` (browser, server, service-role server-only) plus an `isSupabaseConfigured()` that is false when the env vars are missing, so the app stays in local mode. Add a migration runner, `pnpm db:migrate:dev`, that applies `supabase/migrations/*.sql` to `SUPABASE_DB_URL`, records them like the Supabase CLI, is idempotent, and refuses a database whose project ref does not match `NEXT_PUBLIC_SUPABASE_URL`. Add new migrations (do not rewrite the existing seven unless one is broken on real Supabase; say why if so) for decisions 3–12 of the header:
  - Profiles: unique nickname (case-insensitive) with a filter, member number, consents with date and policy version, news opt-in.
  - The value tables, written only through `security definer` RPCs with decision 7's limits: `award_points(action, ref)`, `buy_cosmetic`, `equip_cosmetic`, `claim_stamp(event, code)` (time window, once, +50), `submit_race_time(circuit, version, ms)`, `use_discount`, `save_profile`, `save_snapshot(jsonb)`, `merge_guest(payload)` (always merges, validated item by item), `delete_my_account`.
  - Ranking RPCs or views: times per circuit, points all-time, season points, each paginated (limit/offset, stable order) and with the caller's own position.
  - Admin-only RPCs (staff role, `aal2`): set or unset a member's artist flag; delete a member's account and carnet (audited, for duplicates).
  - `event_stamp_codes` (secret code, valid_from/until), readable by admin only.
  - Global-bottle support: a "10 most recent active" read, one active per person, a DB-side text filter for links, emails and phone numbers.
  - RLS so that anon and other users can never read emails or consents, or write value tables.
  - Seed the current `muestra` events, circuits and season into dev.

  Regenerate `packages/db/src/database.types.ts`. Add `pnpm test:supabase`: vitest integration tests against the dev project that create `@example.test` users with the service key, exercise every RPC's accept and reject cases and the RLS rules, and delete their users. Without env vars it prints a skip line and exits 0. Add the `E2E_SUPABASE=1` switch to the Playwright config (web server started with the Supabase env; without it, e2e runs in local mode as today), plus a helper to sign a test user in by getting the OTP through `auth.admin.generateLink`. If `apps/web/.env.local` has no Supabase keys, stop with STATUS: blocked and ask Hernán for them.
- Context: this plan's header; `docs/DECISIONES.md` D-10, D-20, P7; `supabase/migrations/*.sql` (base with `staff_roles`, `has_staff_role`, `aal2`; identity; events with `seasons`; world; home; progress; bottles), `supabase/` seeds and the sample-removal script; `packages/db/src/harness.ts` (`migrate()`), `testing.ts`, `database.types.ts`, `cli/db-test.ts`; `packages/store/src/repository.ts` (`BoiaRepository`, which says Supabase will be another implementation), `schema.ts`, `ledger.ts`, `local.ts` (`ProgressApi`, `bottleApi`, how points, purchases, stamps, records and discounts are computed today: the RPC limits must accept every legitimate local action); `packages/engine/src/circuit/race.ts` (circuits, versions, record keys); `packages/contracts/src/carnet.ts` (bottle and carnet limits); `.env.example`; `apps/web/playwright.config.*`.
- Scope: may touch `supabase/**`, `packages/db/**`, `apps/web/lib/supabase/**`, new scripts under `tools/` or `packages/db/src/cli/`, root and app `package.json` (+ lockfile), `apps/web/playwright.config.*`, an e2e helper under `apps/web/e2e/`, `.env.example` / must not touch UI components, `packages/store/src/local.ts` behaviour, `docs/DECISIONES.md`.
- Done when:
  - `pnpm db:migrate:dev` → exit 0 and applies every migration to the dev project; run again → exit 0 with nothing applied
  - `pnpm test:supabase` → exit 0, with at least one accept and one reject case per RPC and RLS cases for anon / other user / admin, and no `@example.test` users left behind
  - with the Supabase env vars unset, `pnpm test:supabase` → exit 0 printing a skip line, and the Test command → exit 0 (local mode intact)
  - Test command → exit 0
- Outcome:

## T87 — Design: the ID-card Carnet, the scan flow, the sign-in sheet and the rankings
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design (invoke first with the Skill tool)
- Depends on: none
- Goal: Write the design Hernán approves before anything of these screens is built: the Carnet as a real ID card (decision 10), the QR stamp flow (decision 9), the email sign-in sheet with consent (decisions 1–3, 5) and the global rankings panel (decision 8). It covers:
  - Card proportions (ID-1, 85.6 × 54) and how it scales at 375, 768 and 1280 px, both inside the /mar menu and on the `/carnet` page.
  - The front: avatar, nickname, member number, rank, points, member since, QR to the public carnet, `muestra` marks.
  - The back: a passport-style stamp grid with 0, 3 and 12+ stamps, one stamp per event with its name and date, plus how an event's stamp looks.
  - The flip (tap, keyboard, reduced motion).
  - The scan flow: the «Escanear sello» button, then the camera view with framing and a permission-denied state, then the stamp landing on the back with an animation, plus the error states (outside the party's hours, already stamped, invalid code, no account → sign-in).
  - The `/sello` landing when the phone camera opens the URL.
  - The sign-in sheet: email, then the 6-digit code with resend and errors, then, for new accounts only, nickname (taken / offensive), mandatory privacy acceptance and optional news checkbox; and the "why we ask" line per reason (carnet, skin, stamp, ranking).
  - Account actions in the Carnet: sign out and delete account with confirmation.
  - The ranking panel: three tabs (circuit times with a circuit selector, all-time points, season), top list plus «tú» row, the guest state.
  - Palette and type on the approved identity (Archivo Expanded + Inter, `apps/web/lib/fonts.ts`; the BOIA brand; the Arcilla and Acuarela worlds).
  - Accessibility notes.
  - The i18n keys the new copy needs (`muestra` texts).

  Mockups are frames (SVG or PNG), not app code.
- Context: this plan's header; `apps/web/lib/mundo/carnet/*` (`carnet-card.tsx`, `carnet-panel.tsx`, `carnet-editor.tsx`, `avatar.tsx`, `carnet.css`, `share.ts`), `apps/web/lib/mundo/menu/sections/carnet.tsx` and `ranking.tsx`, `apps/web/app/carnet/`, `packages/contracts/src/carnet.ts` (the 5 questions, ranks); `apps/web/lib/i18n/`; `apps/web/lib/fonts.ts`; `docs/propuestas/2026-10-03-landing-scroll.md` (the latest approved visual language); `docs/spec/05-identidad-y-comunidad.md`; D-25 in `docs/DECISIONES.md`.
- Scope: may touch `docs/propuestas/2026-10-03-carnet.md`, `docs/informes/img/p008-t87-*.{svg,png}` / must not touch app code, CSS, i18n files, `docs/DECISIONES.md`, `docs/spec/`.
- Done when:
  - `docs/propuestas/2026-10-03-carnet.md` exists with these sections: Card, Front, Back and stamps, Flip, Scan flow, /sello page, Sign-in sheet, Account actions, Rankings panel, Palette and type, Accessibility, i18n keys, Open questions
  - there are at least 10 frames in `docs/informes/img/p008-t87-*`: front, back with 3 stamps, back with 12+, the /mar menu at 375 px, the /carnet page at 1280 px, the camera view, stamp received, scan error, sign-in email + code, new-account step, rankings
  - Hernán approves: stop with STATUS: blocked and a QUESTION that summarises the proposal in ≤ 15 lines with ATTACH lines for the frames. When the answer arrives, apply his changes, add «Approved <date> by Hernán» at the top of the document, commit and finish
  - Test command → exit 0
- Outcome: approved design (with changes) in `docs/propuestas/2026-10-03-carnet.md` + 17 frames: orange ID-1 card, passport back with rubber stamps, flip, scan flow, /sello, sign-in sheet, account actions, two-tab rankings → 281f61a

## T88 — /mar: guide lines off during the race; bottles where they can be read
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none
- Goal: Two /mar fixes, both in local mode.
  - (a) Decision 13. The yellow `RouteLine` between islands hides when the race countdown starts and shows again when the race finishes, is invalidated (cancel, offroad, timeout, panel) or the world changes. Its `update(zoom)` sets visibility every frame, so this needs a flag such as `setSuppressed(bool)` that `update` respects, not a one-off `visible = false`.
  - (b) Bottles become unreadable near islands today: approaching an island opens its sheet automatically (`content_open`), which hides the bottle buttons, and a bottle may sit only 20u past an island's collision radius, well inside the 150u reading range. Make a pure placement rule in `packages/engine/src/bottles/` that keeps every bottle at least the island sheet's auto-open radius plus the bottle reading range plus a margin away from every island, and use it in `findDropSpotWhere`. At load, relocate stored bottles that break it to the nearest valid water spot (deterministic, so the same bottle always lands in the same place). T93 reuses the rule for global bottles.
- Context: `apps/web/app/mar/engine/effects.ts` (`RouteLine`, ~324), `apps/web/app/mar/engine/mar3d.ts` (~624 creation, ~2594 per-frame update, `setRoad`/`setSemaphore` ~1236–1279, `setBottles`), `apps/web/app/mar/mar-client.tsx` (`raceEvents`: `countdown` ~570, `finish` ~617, `invalid` ~650, world switch ~1660; the island sheet auto-open `content_open` ~771–798; the bottle buttons gate ~2244); `packages/engine/src/circuit/race.ts`; `packages/engine/src/bottles/sea.ts` (`findDropSpotWhere`), `finder.ts` (150u/240u), `apps/web/app/mar/bottles.ts` (map → planet conversion, the 480u water fallback), `apps/web/app/mar/botellas.tsx`; `apps/web/e2e/mar-circuito.spec.ts`, `mar-botellas.spec.ts`.
- Scope: may touch `apps/web/app/mar/**`, `packages/engine/src/bottles/**`, `packages/engine/src/circuit/**` only if an event hook is missing, their tests and those two e2e specs / must not touch the store package, Supabase, the carnet or the ranking.
- Done when:
  - unit tests prove the route-line flag survives `update(zoom)` and the placement rule rejects spots inside an island's sheet radius plus reading range and relocates a stored bottle out of it
  - `E2E_PORT=<free> pnpm e2e mar-circuito.spec.ts mar-botellas.spec.ts --workers=1` → exit 0, with new assertions: route line hidden during the countdown and the race, visible after finish and after a cancel; a bottle near an island can be read
  - Test command → exit 0
- Outcome: route line suppressed from countdown to finish/cancel/world switch (`data-ruta` on the canvas); pure readable-placement rule (sheet radius + reading range + 30u margin) used for drops and deterministic relocation at load; 16 unit tests, 12 e2e → 9475832

## T89 — Email sign-in with a 6-digit code, consent and the account
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design (only to apply T87's approved sign-in and account designs; T87 wins over the skill's defaults)
- Depends on: T86, T87
- Goal: Decisions 1–5, on T87's approved design.
  - A session layer (`useAccount`): signed-out guest / signed-in member, session persisted, sign out.
  - The sign-in sheet: email, then the 6-digit code with resend, cooldown and errors; for a new account, nickname (unique, prefilled with the guest nickname, offensive filter), mandatory privacy acceptance and the optional news checkbox, stored with date and policy version.
  - One gate, `requireAccount(reason)`, with the reasons carnet / skin / stamp / ranking and the "why we ask" line, which T90–T93 call. Wire it now to the Carnet's save action; the other reasons are wired by their tasks.
  - The guest merge on every sign-in (decision 4, `merge_guest`).
  - Delete account from the Carnet (confirmation, `delete_my_account`, local data cleared back to a fresh guest).
  - Update the privacy page (`muestra`) to say what is collected and why.
  - In local mode no sign-in UI appears and everything works as today.
  - The Supabase dashboard settings the code needs (the email template that shows `{{ .Token }}` in Spanish, OTP length and expiry, Site URL and redirect URLs for `localhost:3100` and `boia-planet.vercel.app`): write them as exact click-by-click steps in the ESTADO fragment and stop once with STATUS: blocked asking Hernán to apply them. The tests do not need them, so keep working while waiting if possible.
- Context: this plan's header; T87's approved document and frames; T86's Outcome and `apps/web/lib/supabase/`; branch `worktree-agent-a208530713932c80c` commit `a4c68d3` (round-1 login WIP; `git show a4c68d3 --stat` first); `apps/web/lib/repo.ts`; `packages/store/src/schema.ts` (guest identity, nickname); `apps/web/lib/mundo/carnet/*`, `apps/web/lib/mundo/menu/`; the legal pages under `apps/web/app/` (privacidad); D-10, D-20, P21, REQ-ENT-032, REQ-IDE-050 in `docs/`.
- Scope: may touch `apps/web/lib/account/**` (new), `apps/web/lib/supabase/**`, the carnet and menu components for the gate and account actions, the privacy page, `apps/web/lib/i18n/`, new e2e specs, `supabase/migrations/` (new files only, if an RPC needs a fix) / must not touch the store's value logic (T90), the ranking, bottles or admin.
- Done when:
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e cuenta.spec.ts --workers=1` → exit 0, covering: a new user signs in with the code, picks a nickname, a taken nickname is refused, privacy unticked blocks; a guest with points signs in and the points are on the account; sign out and back in; delete account
  - `E2E_PORT=<free> pnpm e2e carnet.spec.ts --workers=1` → exit 0 (local mode: no sign-in UI)
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome: `apps/web/lib/account/` (session, `useAccount`, `requireAccount` gate, sign-in sheet with 6-digit code, nickname check, consents, guest merge, account section with sign out/delete), `nickname_status` RPC, CSP for Supabase, privacy page with accounts; cuenta.spec 10 passed → 6ea5b69

## T90 — The Supabase repository: a member's progress lives in the account
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T89
- Goal: Implement `BoiaRepository` for members (decision 6).
  - Every value action goes through T86's RPCs: points and coins, buying and equipping skins, stamps, race times, discounts, the Carnet profile.
  - Reads come from the server, with the local store as an offline cache.
  - The rest of the store document is saved with `save_snapshot`, debounced and on page hide.
  - Server wins on conflicts.
  - Guests keep the local repository unchanged, and signing in or out switches between them without a reload.
  - Wire `requireAccount('skin')` to the shop's buy action.
  - Failures (offline, RPC reject) show a clear message and never lose the local action silently: queue it and retry once online, or explain the rejection.
- Context: `packages/store/src/repository.ts`, `local.ts`, `schema.ts`, `ledger.ts`; `apps/web/lib/repo.ts`; T86's RPC list and `database.types.ts`; T89's `useAccount` and `requireAccount`; `apps/web/lib/barco/shop.tsx`, `shop-model.ts`; every caller of `ProgressApi` (find them first).
- Scope: may touch `packages/store/**` (new Supabase implementation and the shared interface), `apps/web/lib/repo.ts`, the shop's buy wiring, `apps/web/lib/i18n/`, tests and new e2e specs / must not touch carnet visuals (T91), the ranking UI (T92), bottles (T93), admin.
- Done when:
  - unit tests with a fake Supabase client cover the sync, offline queue, conflict (server wins) and the guest ↔ member switch
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e cuenta-progreso.spec.ts --workers=1` → exit 0: a member earns points, buys and equips a skin, finishes a race; a fresh browser context signed in as the same member sees the points, the skin equipped, the record and the Carnet
  - the existing local-mode specs that touch progress (`carnet.spec.ts`, `carnet-descuento.spec.ts`, `mar-circuito.spec.ts`, plus any shop spec) → exit 0
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome: member repository behind a switchable `gameRepository()` with a per-account local copy (`boia.cuenta.<id>`), ordered RPC queue, server-wins refresh, snapshot on guest merge; `lib/repo-member.ts` loaded only with Supabase; cuenta-progreso e2e (desktop) + 22 local specs pass → 67bbff5

## T91 — The ID-card Carnet and QR party stamps
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: frontend-design (to apply T87's approved design; T87 wins over the skill's defaults)
- Depends on: T87, T90
- Goal: Build T87's approved Carnet (decision 10) everywhere it appears: the /mar menu section, `/carnet`, and the public `/carnet/[id]`, which reads a member's public data (nickname, rank, stamps, no email) from Supabase and keeps working in local mode. Build the QR stamps (decision 9).
  - The «Escanear sello» button opens the camera in the web: `BarcodeDetector` where available, otherwise a small QR decoder loaded on demand only when scanning, never in the landing's or /mar's initial bundle. It handles the permission prompt and denial.
  - The `/sello` route claims the stamp through `claim_stamp` (asking for the email first with `requireAccount('stamp')`) and shows the received / outside hours / already stamped / invalid states.
  - The stamp appears on the back with the animation.
  - Stamps keep T87's rubber-stamp look exactly (Hernán likes it): an event's image, when Admin set one (uploaded file or URL, T94), is shown inside that same stamp treatment; without one, the generated stamp.
  - Local mode keeps today's stamp-on-test-purchase behaviour.
- Context: T87's approved document and frames; `apps/web/lib/mundo/carnet/*`, `apps/web/lib/mundo/menu/sections/carnet.tsx`, `apps/web/app/carnet/`; T86's `claim_stamp` and `event_stamp_codes`; T89's gate; T90's repository; REQ-IDE-010…023 in `docs/spec/estado.md` (IDE-023 «QR alternativo de sello»); `packages/store/src/local.ts` ~1531 (stamps today).
- Scope: may touch `apps/web/lib/mundo/carnet/**`, `apps/web/lib/mundo/menu/sections/carnet.tsx`, `apps/web/app/carnet/**`, `apps/web/app/sello/**` (new), a scanner module, `apps/web/lib/i18n/`, `package.json` (+ lockfile) for the decoder, e2e specs / must not touch the ranking, bottles, admin, the store's value logic.
- Done when:
  - unit test: the decoder reads a QR PNG fixture of a `/sello?e=…&c=…` URL
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e sello.spec.ts --workers=1` → exit 0: a member opens a valid `/sello` URL and the stamp shows on the back with +50 points; the same URL again → "already stamped"; a code outside its window → "outside hours"; a guest opening it → sign-in, then the stamp
  - `E2E_PORT=<free> pnpm e2e carnet.spec.ts carnet-descuento.spec.ts --workers=1` → exit 0 (updated to the new card; document each changed assertion in ESTADO)
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome:

## T92 — Global rankings: circuit times and all-time points
- Status: done
- Model: opus (Opus 5.5)
- Skills: frontend-design (to apply T87's approved rankings frame)
- Depends on: T87, T90
- Goal: Decision 8 on T87's design. The ranking panel reads T86's ranking RPCs: circuit times with a circuit selector and all-time points; no season tab (hidden until Hernán defines a season; the local-mode season tab goes too). Each tab shows the top 50 and the viewer's «tú» row with their position, and a «Mostrar más» button that loads the next 50 until every member is listed (then it disappears). Guests see the lists read-only, with an «Entra con tu email para aparecer» action (`requireAccount('ranking')`). Finishing a race as a member submits the time and shows the new position on the finish card (personal best / position #n). Local mode keeps today's samples (`SAMPLE_CIRCUIT_MS`). REQ-AVE-034 and REQ-IDE-053 move accordingly.
- Context: T87's approved document; `apps/web/lib/mundo/menu/sections/ranking.tsx`, `apps/web/lib/mundo/ranking-circuit.ts`; `apps/web/app/mar/carrera.tsx` (finish card), `mar-client.tsx` `raceEvents`; T86's ranking RPCs and seasons; T90's repository (`submitTime`, `record`).
- Scope: may touch the ranking section and helper, `carrera.tsx`, the race-finish wiring in `mar-client.tsx`, `apps/web/lib/i18n/`, e2e specs / must not touch the route-line code (T88), bottles, carnet, admin.
- Done when:
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e ranking.spec.ts --workers=1` → exit 0: two members with seeded times and points appear in the right order in each tab; the viewer outside the top sees their «tú» row; a guest sees the lists and the sign-in action; with more than 50 seeded members «Mostrar más» loads the rest and then disappears
  - `E2E_PORT=<free> pnpm e2e mar-circuito.spec.ts --workers=1` → exit 0
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome: two-tab global ranking (Circuito default, De siempre) with top 50, pinned «tú» row and «Mostrar más»; guest box with «Entrar en el ranking»; finish card «Puesto n de N», start card shows the global leader; `flushAccount()` in `lib/repo.ts`; local mode same look with samples → 904cb28

## T93 — Global message bottles
- Status: running (attempt 1)
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T88, T90
- Goal: Decision 12.
  - In Supabase mode the sea shows the 10 most recent active bottles of all members (refreshed on entering /mar and every few minutes; no realtime needed).
  - Each member has one active bottle, and throwing a new one retires theirs. Positions follow T88's placement rule.
  - The text filter blocks links, emails, phone numbers and offensive words, client-side for the message and DB-side as the guard.
  - Reading records a read, and the report button writes `bottle_reports`.
  - Guests read bottles freely; throwing one asks for the account (it needs a Carnet).
  - Local mode stays as today.
  - REQ-IDE-040…044 move accordingly (IDE-044 «no private messages» is the filter).
- Context: T88's Outcome and placement rule; `packages/store/src/local.ts` (`bottleApi`, `activeBottles`), `schema.ts` ~233, `packages/contracts/src/carnet.ts` (limits), `packages/engine/src/bottles/*`, `apps/web/app/mar/bottles.ts`, `botellas.tsx`; `supabase/migrations/20260928100600_bottles.sql` plus T86's additions; `apps/web/e2e/mar-botellas.spec.ts`.
- Scope: may touch the bottles code in `packages/store`, `packages/engine/src/bottles/`, `apps/web/app/mar/bottles.ts`, `botellas.tsx`, `apps/web/lib/i18n/`, `supabase/migrations/` (new files only), e2e specs / must not touch the route line, ranking, carnet, admin.
- Done when:
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e botellas-globales.spec.ts --workers=1` → exit 0: member A throws a bottle, member B sees and reads it and reports it; a message with a link or phone is refused; with 11 bottles only the 10 most recent show
  - `E2E_PORT=<free> pnpm e2e mar-botellas.spec.ts --workers=1` → exit 0
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome:

## T94 — /admin on real data: email + TOTP login and four sections
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T92, T93
- Goal: Decision 11.
  - In Supabase mode, /admin asks for the email code, then TOTP: enrol on first login with a QR for the authenticator app, Supabase MFA, `aal2`.
  - Without a staff role the user sees "no access".
  - `pnpm admin:grant -- <email> <owner|admin|editor>`: a script with the service key, for the dev project, that Hernán runs for his own email.
  - Four sections move to real data:
    - **Fiestas y QR:** events with the stamp code's valid_from/until, a big QR to project, a printable PNG/PDF, regenerate code; the event's **stamp image**, uploaded as a file (Supabase Storage bucket, public read, staff write, size/format limits from T87's document) or attached from a URL (Hernán, 2026-10-03).
    - **Socios y emails:** list and search members with signup date, nickname and news opt-in with consent date and version; CSV export of the opted-in; mark or unmark a member's carnet as **artist** (it then shows the artist label and appears in the artists' part, as the local demo does today); **delete a carnet** (the member's account and data, with confirmation and audit), for duplicates.
    - **Moderación de botellas:** open reports, retire a bottle, audited.
    - **Rankings:** void a race time or a points entry with a reason, audited.
  - The other sections and the «Probar admin» local demo keep working as today. Local mode keeps the demo admin.
  - REQ-ADM-002/004/027/039 and the related REQs move accordingly.
- Context: `apps/web/app/admin/page.tsx`, `admin-app.tsx`, `sections/*` (moderation.tsx); `supabase/migrations/20260928100000_base.sql` (`staff_roles`, `has_staff_role`, `private.staff_role()` with `aal2`, last-owner protection); T86's `event_stamp_codes` and ranking tables; T93's bottle reports; `docs/spec/07-admin.md`; D-10.
- Scope: may touch `apps/web/app/admin/**`, `apps/web/lib/account/**` for MFA, the grant script, `supabase/migrations/` (new files only), `apps/web/lib/i18n/`, e2e specs / must not touch the public carnet, ranking or bottles UI.
- Done when:
  - `E2E_SUPABASE=1 E2E_PORT=<free> pnpm e2e admin-real.spec.ts --workers=1` → exit 0: a granted test admin signs in with code + TOTP (generated in the test from the enrolment secret), regenerates an event's code and the old QR URL stops working, uploads a stamp image and sets another event's image by URL and both show on a member's carnet, exports a CSV with only opted-in members, marks a member as artist and the public carnet shows it, deletes a duplicate member who then disappears from the rankings and can no longer sign in with their data, retires a reported bottle, voids a time that then leaves the ranking; a member without a role sees "no access"
  - the existing admin e2e specs in local mode → exit 0
  - `pnpm test:supabase` → exit 0
  - Test command → exit 0
- Outcome:

## T95 — Docs, spec status and the decision draft
- Status: pending
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: T86, T87, T88, T89, T90, T91, T92, T93, T94
- Goal: Close the plan on paper.
  - `README.md`: setting up a Supabase project, the env vars, `db:migrate:dev`, `test:supabase`, `E2E_SUPABASE`, `admin:grant`.
  - `.env.example`.
  - `docs/TRASPASO.md`: what changed, and what still depends on Álvaro: legal texts P21, point amounts, the final Carnet art, the use of the email list.
  - `docs/spec/estado.md`: every REQ these tasks moved, each with its test. Check IDE-023, AVE-034, IDE-040…044, IDE-050, IDE-053, ENT-032, ADM-002/004/027/039 and the final-version REQs D-20 deferred (IDE-002/003/005/006/039, ARQ-002/010/011/013).
  - The decision draft for Hernán in `docs/propuestas/2026-10-03-d27-borrador.md`: Supabase accounts by email with consent, guest merge, global bottles, QR stamps, admin TOTP. Say exactly which points of D-20 it replaces and which open questions it closes or opens (P7). Never edit `docs/DECISIONES.md`.
  - Replace the old test URL boia-planet.vercel.app with https://boia-planet-roan.vercel.app in `CLAUDE.md`, `docs/TRASPASO.md`, `docs/entrega.md` and anywhere else (noting it is temporary until the final domain).
  - A production checklist for Hernán in the same folder: a separate prod project, Vercel env vars, custom SMTP (the default mailer only reaches the team; Gmail app password for tests, Resend with the final domain for production) and then the Spanish email templates of T89, Auth URLs, running the migrations, granting the owner, removing `muestra` data.
- Context: every Outcome and the Decisions of this plan; `docs/TRASPASO.md`, `README.md`, `.env.example`, `docs/spec/estado.md`, `tools/spec/estado.py`, `docs/DECISIONES.md` (read only).
- Scope: may touch `README.md`, `CLAUDE.md` (only the URL), `docs/entrega.md`, `.env.example`, `docs/TRASPASO.md`, `docs/spec/**`, `docs/propuestas/2026-10-03-d27-borrador.md`, `docs/propuestas/2026-10-03-produccion-supabase.md` / must not touch app code, `docs/DECISIONES.md`.
- Done when:
  - `python3 tools/spec/estado.py` → exit 0
  - Test command → exit 0
- Outcome:

## T96 — /mar fixes from Hernán's test: race buoys, the open path, whirlpools, mobile «go to»
- Status: done
- Model: opus (Opus 5.5)
- Skills: none
- Depends on: none
- Goal: Four fixes Hernán found playing on 2026-10-03, all in local mode.
  - (a) Race side buoys: the buoys that line the circuit must be **orange on both sides** (left and right). Today the two sides differ.
  - (b) The circuit is not closed **below checkpoint 8 and above checkpoint 3**: there is a gap in the course boundary that lets the player take a wrong way. Close it (buoys/boundary, and offroad detection if it relies on the same data) so the only way through is the intended route. Check the whole circuit for other gaps of the same kind and list them.
  - (c) Bug: the **whirlpools (remolinos) do not appear on the map and cannot be surfed**. Find the cause (likely a regression from a recent plan: check `git log` of the files involved) and restore them: visible on the map, surfable as designed. Whirlpools show **no name label** above them on the map, only the whirlpool itself (Hernán, 2026-10-03).
  - (d) Mobile: when choosing to go to a place, «Navegar» and «Ir en nave» (flying) only appear inside a dropdown. Both must be visible buttons without the dropdown, so the flying option is not lost; desktop keeps working.
- Context: the circuit and race: `packages/engine/src/circuit/` (`race.ts`, course data, checkpoints, offroad), `apps/web/app/mar/engine/` (buoys/marks rendering, `setRoad`, `mar3d.ts`), `apps/web/app/mar/mar-client.tsx`, `apps/web/app/mar/carrera.tsx`; the whirlpools: search `remolino`/`whirlpool` in `packages/engine` and `apps/web/app/mar`, their REQ in `docs/spec/estado.md` and the plans that touched them (`plans/005`…`007`); the «go to» UI on mobile: search the i18n keys for «Navegar» and «Ir en nave» in `apps/web/lib/i18n/` and their component; e2e `apps/web/e2e/mar-circuito.spec.ts` and the specs covering whirlpools and travel; T88's Outcome (route line, `data-ruta`) in this plan.
- Scope: may touch `packages/engine/src/circuit/**`, the whirlpool code, `apps/web/app/mar/**` (except the bottles files), the «go to» component and its i18n keys, their tests and e2e specs / must not touch accounts, Supabase, the carnet, the ranking UI, bottles.
- Done when:
  - unit tests prove: both buoy sides use the orange material; the course boundary has no opening between checkpoints 8 and 3 (a test that a path through the old gap counts as offroad / blocked); whirlpools are created and surfable from the world data
  - `E2E_PORT=<free> pnpm e2e mar-circuito.spec.ts <the whirlpool and travel specs> --workers=1` → exit 0, with new assertions: whirlpools present on the map; on a mobile viewport the «go to» sheet shows «Navegar» and «Ir en nave» as visible buttons without opening a dropdown
  - Test command → exit 0
- Outcome: orange buoys both sides; buoy arcs outside every course vertex close the gaps (CP8 143u, CP3 195u, also 0/4/6/9); whirlpools fixed (curved 32×32 mesh, current that moves the ship, moved out of Halloween's auto-sheet area), no name label, REQ-AVE-019 HECHO; mobile «go to» shows «Navegar» and «Ir en nave» in one row; 34 e2e passed → 594a472

## Decisions
- 2026-10-03 plan: interview decisions 1–13 in the header (Hernán).
- 2026-10-03 plan: added «Mostrar más» in the rankings; admin can mark a carnet as artist and delete duplicate carnets (Hernán).
- 2026-10-03 plan: tasks ordered so the backend (T86) and the design (T87) start first; T88 is independent (orchestrator).
- 2026-10-03 T87: Hernán likes T87's stamp design and wants stamps to look like that: the rubber-stamp look (shape, ink, rotation, type) is the stamp style; an event's uploaded/URL image is shown inside that same treatment, never as a plain photo (Hernán).
- 2026-10-03 plan: season ranking hidden in the UI for now (Hernán).
- 2026-10-03 T87: Hernán approved the design with changes: per-event stamp image by upload or URL (T94 builds it, T91 renders it, generated stamp as fallback); season definition open; scan first, then ask for the email; other recommendations stand (Hernán).
- 2026-10-03 T88: route-line state exposed as `data-ruta`; margin `BOTTLE_READ_MARGIN` 30u (muestra); small auto-sheet objects (port WhatsApp buoy) only keep bottles sheet radius + margin away; relocation at placement time, stored positions not rewritten; a bottle thrown next to an island goes to the nearest readable water (may land out of view) instead of failing (agent).
- 2026-10-03 T87: stamp image inside the rubber-stamp treatment (cropped window, single ink, texture, rotation); upload limits PNG/WebP/JPEG, ≥ 512 px, ≤ 2 MB, server keeps its own 512 px WebP and fetches URL images once (T94 follows this); new screens use orange buttons with black text (AA); frames are PNGs rendered from HTML (agent).
- 2026-10-03 plan: T96 added from Hernán's play test (race buoys orange both sides, open path below CP8/above CP3, whirlpools missing, mobile «go to» buttons) (Hernán).
- 2026-10-03 T89: resumed on «Continúa» assuming the dashboard was applied; the dev project still issues 8-digit codes, blocked again (orchestrator).
- 2026-10-03 T89: OTP length set to 6 by Hernán; Supabase requires a custom SMTP to edit the email templates, so the templates stay pending for Hernán (non-blocking: e2e read no email); Auth URLs use boia-planet-roan.vercel.app (Hernán).
- 2026-10-03 T89: `nickname_status` RPC migration; sign-out/delete resets to a fresh guest; guest merge sends no snapshot (T90 defines it); /carnet keeps the cream sheet until T91; templates pending custom SMTP (agent).
- 2026-10-03 T89: the old URL in CLAUDE.md/TRASPASO/entrega goes to T95 (orchestrator).
- 2026-10-03 plan: Hernán configured a custom SMTP (Gmail) on the dev project; the Spanish templates can now be edited (Hernán).
- 2026-10-03 T96: course gaps came from sharp turns, `roadMarks` adds buoy arcs at every vertex; offroad unchanged; whirlpool push is now a current with a calm centre; `data-remolinos`/`data-remolinos-vista` for tests; e2e clicks the pin with dispatchEvent; branch started on T89's WIP (session cwd was in that worktree) and was reset to main (agent).
- 2026-10-03 T90: buy/equip/save Carnet wait for the server and throw the rejection, other actions notify; sign-out flushes the queue (≤ 4 s) then drops the copy; hooks `onGuestMerged`/`onBeforeSignOut` in T89's session; `cuenta-progreso.spec` runs on desktop only (agent).
- 2026-10-03 plan: at the end of the plan the orchestrator messages the local session «DESPLEGAR WEB VERCEL ALVARO» with what is ready on main (commits, changes, env vars Vercel needs for Supabase mode) so Álvaro's Vercel can be updated; the deploy itself is decided and run there, not from this session (Hernán).
- 2026-10-03 T92: «Circuito» is the default tab; one selector option per circuit+version (today one); rows show the neutral avatar only; an `incomplete` session counts as guest; «Descubrir a un BOIERO» moved below the list; screenshots only with `RECORD_T92=1` (6 PNGs committed) (agent).

## Proposals (new scope)
- 2026-10-03 T92: on «De siempre» all members with 0 points share one position (ties ranked together), so a 0-point viewer may show «3» pinned under 50 others at «3»; the design may need a look.
- 2026-10-03 T90: a `daily` reward earned offline and sent another day counts for the arrival day (`award_points` takes no date).
- 2026-10-03 T96: with the sample whirlpool values a ship with no throttle spins gently in the centre; whether it should push the player out is a design call.
- 2026-10-03 T89: `apps/web/app/carnet/carnet-page.tsx` has hard-coded strings (not i18n); `es-mar.ts` fails `prettier --check`.
- 2026-10-03 T87: the existing `.juego-button` (white on #f26a1b, 3.4:1) fails AA for normal text; the old screens still use it.
- 2026-10-03 Hernán: the world switch could become a playable skin; then the season can no longer be «the world being played». To be discussed.

## Log
- 2026-10-03 10:59 T86 launched · attempt 1 · agent acaf409f9b8ab837f
- 2026-10-03 10:59 T87 launched · attempt 1 · agent af80896be8477f7dc
- 2026-10-03 11:25 T87 blocked · Hernán approves the design (16 frames, 7 open questions) · branch worktree-agent-af80896be8477f7dc
- 2026-10-03 11:26 T88 launched · attempt 1 · agent a811042d3613c3ad7
- 2026-10-03 12:05 T87 answered (approve with changes) · resumed agent af80896be8477f7dc
- 2026-10-03 11:53 T88 done · branch worktree-agent-a811042d3613c3ad7 → 9475832
- 2026-10-03 11:57 T87 done · branch worktree-agent-af80896be8477f7dc → 281f61a
- 2026-10-03 11:58 T89 launched · attempt 1 · agent a6c8beff0bb073cef
- 2026-10-03 12:50 T89 blocked · Hernán applies the Supabase dashboard settings (OTP 6 digits, templates, URLs) · branch worktree-agent-a6c8beff0bb073cef
- 2026-10-03 13:05 T89 answered (dashboard applied) · resumed agent a6c8beff0bb073cef
- 2026-10-03 13:08 T89 blocked again · dev project still issues 8-digit OTP codes
- 2026-10-03 13:20 T89 answered (OTP 6, templates wait for SMTP, roan URL) · resumed agent a6c8beff0bb073cef
- 2026-10-03 13:20 T96 launched · attempt 1 · agent a358611c785a3bea3
- 2026-10-03 13:27 T89 done · branch worktree-agent-a6c8beff0bb073cef → 6ea5b69
- 2026-10-03 13:30 T90 launched · attempt 1 · agent a300278d46361eb2a
- 2026-10-03 14:03 T96 done · branch worktree-agent-a358611c785a3bea3 → 594a472
- 2026-10-03 14:31 T90 done · branch worktree-agent-a300278d46361eb2a → 67bbff5
- 2026-10-03 14:33 T91 launched · attempt 1 · agent af6cb47b61ded8c78
- 2026-10-03 14:33 T92 launched · attempt 1 · agent a1bd6097682d3dc69
- 2026-10-03 15:12 T92 done · branch worktree-agent-a1bd6097682d3dc69 → 904cb28
