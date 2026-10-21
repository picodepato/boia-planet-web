# Plan 034 — Shareable door-scanner link and guest list for parties

Status: active
Created: 2026-10-21
Base branch: main
Goal: (1) The door scanner that stamps Carnets (today `/admin/puerta`, editor + TOTP) also works from a secret per-party link that anyone can open without logging in, so BOIA can hand it to whoever is at the door (stamps are low-stakes). (2) A party can run in «guest list» mode instead of selling tickets: its buy button becomes «Apuntarse en la lista»; signing up needs a Carnet account, lets you pick the name for the list (prefilled with the Carnet nickname), is once per account, and shows the date and name used if you already signed up. Halloween (`halloween-2026`) ships in list mode with a cap of 100 and the notice «la lista vale hasta las 22:30; después, por orden de llegada». Admin sees each party's list crossed with door attendance (who actually got scanned) and can export it as CSV; the door scanner says whether the scanned Carnet is on the list.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Shared rules for every task:
- Product decisions by Álvaro (2026-10-21) are in Decisions below; follow them literally.
- UI text only through keys in `apps/web/lib/i18n/` (Spanish, tú, BOIA tone); no loose strings in components.
- The demo mode without Supabase (D-20, sample content, Carnet 000) must keep working: follow how the door and the Carnet already fall back today.
- New Supabase migrations go in `supabase/migrations/` with a timestamp after the latest one; RLS on every new table; writes only through RPCs (`public` wrapper over a `private` security-definer function, like `staff_stamp` in `20261008100300_door_stamps.sql`). You may apply your migration to the dev project (`boia-planet-dev`, `pnpm --filter @boia/db db:migrate:dev -- --no-seed`) and run the SQL tests there; never touch production.
- New behaviour gets a REQ in `docs/spec/09-requisitos.md` and its row in `docs/spec/estado.md` with the test that proves it (`python3 tools/spec/estado.py` must pass).
- Each task writes its ESTADO section (`## 2026-10-21 — plan 034 Txxx: <title>`) in `.orchestrator/status/Txxx.md`.
- Full e2e is not run by agents; run only the specs you add or change.

## Tasks

## T307 — Shareable door-scanner link per party
- Status: pending
- Depends on: none
- Goal: An admin creates, from Admin → Puerta (or the party's row in Admin → Fiestas, whichever fits the current UI best), one secret link per party, can copy it and revoke it (revoking and creating again gives a new link). The link does not expire on its own; it stops working when revoked or when the party is archived or cancelled. Opening it (no login) shows the party name and the same camera scanner as `/admin/puerta`; scanning a Carnet QR stamps it for that party exactly like the staff door scan (same `stamps` / `event_attendance` rules, once per account, points as today). Scan only: no manual stamping by nickname, no member data beyond what the staff door shows after a scan (nickname + result). Every link scan is recorded in `event_attendance` with source `door` and a reference to the link (scanned_by may be null), and in the audit log.
- Context: `apps/web/app/admin/puerta/page.tsx`, `apps/web/app/admin/door/*` (door-page, door-camera, use-door, backend), `apps/web/app/admin/real/gate.tsx`, `supabase/migrations/20261008100300_door_stamps.sql` (`staff_stamp`, `event_attendance`), `apps/web/app/carnet/[id]` (what the QR encodes), `apps/web/lib/i18n/es-admin.ts`, `docs/DECISIONES.md`.
- Scope: may touch a new migration (table for door links storing only a hash of the token; admin RPCs to create/list/revoke; a public RPC that takes token + scanned Carnet and stamps; a public RPC that returns the party title for a valid token), a new public route for the link (e.g. `/puerta/[token]`, `noindex`), reuse/refactor of the door components so both routes share the scanner, the admin UI to manage links, i18n keys, unit + SQL tests, one new e2e spec in demo mode / must not touch the guest-list work (T308–T310), the stamp economy rules, the member `/sello` flow, production.
- Done when:
  - SQL tests (as the repo runs them, e.g. `pnpm test:supabase` against dev) → pass, covering: valid token stamps once; second scan of the same Carnet does not grant a second stamp; revoked token, archived/cancelled party and unknown token are rejected; anon cannot read the links table
  - `pnpm exec vitest run` on the new/changed unit tests → pass
  - `E2E_PORT=<free> pnpm e2e <new spec>` → pass (link page renders the scanner in demo mode)
  - the project Test command → pass
- Outcome:

## T308 — Guest list: data and rules
- Status: pending
- Depends on: none
- Goal: Back end (and store/demo layer) for party guest lists. Per party settings: list mode on/off, cap (number of people), the list closing time (Halloween: 22:30 on the 31st, shown to members in the notice) and an open/closed switch for the admin. At the closing time the list closes by itself: nobody can sign up or remove themselves after it; an admin may also close it earlier with the switch. One signup per account per party: list name (2–30 chars, defaults to the Carnet nickname, free text, duplicates allowed), created_at. Rules: must be a Carnet account (anonymous rejected, like `not_member` today); if already signed up, the join call returns the existing signup (date + name) instead of creating one; a member may remove their own signup while the list is open and before the closing time, and may sign up again afterwards (freeing the spot); full list → `full`; closed list (switch off or closing time passed) → `closed`. Admin RPCs: read the list of a party with list name, Carnet nickname, email, signup date and whether that account was scanned at the door for that party (`event_attendance`), remove a signup, update the settings. A lookup the door can use: «is account X on party Y's list, under which name, and is it past the closing time». Halloween (`halloween-2026`) is set to list mode, cap 100, closing time 22:30 on 2026-10-31 (Europe/Madrid), open, in the sample content and in the seeds.
- Context: `packages/store/src/sample/content.ts` (Halloween, `boxOfficeOnly`), `apps/web/lib/ticketing/`, `supabase/migrations/20260928100200_events.sql`, `20260928100100_identity.sql` (`carnets.nickname`), `20261008100300_door_stamps.sql`, `supabase/seeds/20261003100100_economy.sql`, `apps/web/lib/account/session.ts`, `apps/web/lib/account/admin-auth.ts` (`my_staff_role`).
- Scope: may touch a new migration, seeds, the store package (types, sample content, a demo/local implementation for no-Supabase mode), a typed client module under `apps/web/lib/` (e.g. `lib/guestlist/`) that T309 and T310 will call, unit + SQL tests, `docs/spec` / must not touch UI components (T309, T310 do), the door scanner, production.
- Done when:
  - SQL tests against dev → pass, covering: join once; second join returns the first signup unchanged; anonymous rejected; cap reached → full; closed switch → closed; past the closing time → closed for join and leave; leave then join again works; a member cannot read others' signups; admin list includes the attended flag
  - `pnpm exec vitest run` on the new unit tests (client module + demo implementation) → pass
  - the project Test command → pass
- Outcome:

## T309 — Guest list: member flow on the web and in /mar
- Status: pending
- Depends on: T308
- Goal: For a party in list mode, every place that shows «Comprar entrada» (landing event card, `/eventos/[slug]`, the tickets panel in `/mar`) shows instead «Apuntarse en la lista», keeping the door price text (Halloween: «5 € con carnet en puerta») and the notice «La lista vale hasta las 22:30; después, por orden de llegada» (the closing time from the party settings). Not logged in → the existing Carnet login/registration, then back to the list. Logged in → a small dialog with the list-name field prefilled with the Carnet nickname, and a confirm button. Already signed up → a message with the date they signed up and the name used, the same notice, and «Borrarme de la lista» (with confirmation). Full → «Lista completa»; closed (switch off or past the closing time) → «Lista cerrada», and no join or remove buttons. Parties not in list mode behave exactly as before.
- Context: `apps/web/app/(landing)/components/buy-button.tsx`, `event-card.tsx`, `apps/web/app/eventos/[slug]`, `/mar` `entradas.tsx`, the client module from T308, Carnet login components, `apps/web/lib/i18n/es-*.ts`, `apps/web/e2e/carnet-requerido.spec.ts` (login-required pattern).
- Scope: may touch those components, new list components, i18n keys, unit tests, one new e2e spec in demo mode / must not touch the T308 SQL or RPC semantics (report gaps as OUT OF SCOPE or blocked), admin, the door.
- Done when:
  - unit tests of the new components/hooks → pass
  - `E2E_PORT=<free> pnpm e2e <new spec>` → pass: Halloween shows «Apuntarse en la lista»; a demo member signs up with a custom name; reopening shows the date and that name; removing works; another party still shows its normal buy button
  - the project Test command → pass
- Outcome:

## T310 — Guest list in Admin and at the door
- Status: pending
- Depends on: T307, T308
- Goal: Admin → Fiestas: for each party, turn list mode on/off and edit cap, closing time and open/closed. A guest-list view per party: count signed up / cap / scanned, table with list name, Carnet nickname, email, signup date and «entró» (scanned at the door), remove a signup (admin, with confirmation), and «Descargar CSV» with the same columns (reuse `app/admin/real/csv.ts`). At the door, both the staff scanner and the shared link scanner, after a scan show «En lista como <nombre>» or «No está en la lista» when the party is in list mode. Past the closing time the scan still works and still shows the list name, plus a notice that it is past the list time (e.g. «En lista como X · pasada la hora de lista (22:30)»): the door decides, nothing is blocked. Through the shared link only the list name is shown, never email.
- Context: `apps/web/app/admin/real/*` (fiestas, socios, csv.ts), `apps/web/app/admin/door/*` and the link route from T307, the client module and admin RPCs from T308, `apps/web/lib/i18n/es-admin.ts`.
- Scope: may touch admin sections, door components (result display only), i18n keys, unit tests, a small migration only if the door lookup through the link needs a new public RPC returning just the list name / must not touch the member flow (T309), stamp rules, production.
- Done when:
  - unit tests (CSV columns, list view, door result) → pass
  - SQL tests for any new RPC → pass against dev
  - the project Test command → pass
- Outcome:

## Decisions
- 2026-10-21: Door link: one per party, no expiry, revocable; anyone with the link can scan and stamp (Álvaro)
- 2026-10-21: Guest list is a per-party option; Halloween ships with it on (Álvaro)
- 2026-10-21: A member can remove their own signup and sign up again; no renaming (Álvaro)
- 2026-10-21: Admin list + CSV, and the door says whether the scanned Carnet is on the list; no public counter (Álvaro)
- 2026-10-21: Keep the door price next to the list button (Álvaro)
- 2026-10-21: Cap set in Admin; Halloween 100. Notice «la lista vale hasta las 22:30; después, por orden de llegada» to make people come early (Álvaro)
- 2026-10-21: At the closing time (22:30) signing up stops; at the door scans keep working and only show a notice that it is past the list time (Álvaro, correcting an earlier answer)
- 2026-10-21: Agents test migrations on dev; the orchestrator applies them to production right before the push, only on Álvaro's yes (Álvaro)
- 2026-10-21: Link scanner is scan-only (no manual stamping by nickname) and shows only nickname/list name (orchestrator)
- 2026-10-21: 22:30 read as 22:30 on 31 October; editable per party in Admin; removing yourself also stops at the closing time; admin keeps a manual open/closed switch (orchestrator)

## Proposals (new scope)

## Log
