# Plan 037 — «Entraron» list: everyone scanned at the door of a party

Status: done
Created: 2026-10-22
Base branch: main
Goal: Admin shows, per party, everyone whose Carnet was scanned at the door (staff scanner, shared link or manual stamp), whether or not they signed up on the guest list, with a CSV download. Today the Lista panel only shows people who signed up, with an «Entró» flag, so someone who walks in without being on the list is stamped but invisible. Needed for Halloween (2026-10-31) so BOIA can have the list of people who actually came.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T317 — «Entraron» panel and CSV in Admin
- Status: done
- Depends on: none
- Goal: In Admin → Fiestas y QR, each party card gets an «Entraron» panel (next to the existing «Lista» panel; it works for every party, not only parties in list mode). It shows a counter «N han entrado (M en lista, K sin lista)» and a table, newest scan first, with: apodo del Carnet, email, «Nombre en la lista» (or «No estaba en la lista»; for a party without list mode just «—»), hora del escaneo, and how it was scanned (puerta, enlace, a mano). A «Descargar CSV» button with the same columns (reuse `app/admin/real/csv.ts`). A person scanned twice appears once (earliest scan). In demo mode (no Supabase) the same panel appears in each card of Admin → Eventos, fed from the local attendance.
- Context: `apps/web/app/admin/real/guest-list*` (the Lista panel from plan 034 T310) and `csv.ts`, the admin RPC `admin_guest_list` in `supabase/migrations/20261021200100_guest_lists.sql` (admin + 2FA pattern, `public` INVOKER wrapper over `private` SECURITY DEFINER, empty search_path), `event_attendance` in `20261008100300_door_stamps.sql` (+ `door_link_id` from `20261021100100_door_links.sql`), the client module `apps/web/lib/guestlist/`, the local store attendance, `apps/web/lib/i18n/es-admin.ts`, `packages/db/src/supabase/schema.supabase.ts` (anon allowlists), the landing budget (Admin code stays off the landing).
- Scope: may touch a new migration (timestamp after 20261021300100) with an admin-only read RPC returning the attendees of a party, new Admin components, the guest-list client (additions only), i18n keys, unit tests, SQL tests, generated types and the schema allowlist / must not touch the member flow, the door scanners, the stamp rules, the existing Lista panel semantics, production.
- Done when:
  - SQL test against dev (call `node src/cli/test-supabase.ts <file>` inside packages/db) → pass: only admin with 2FA can call it; anon, member and editor are rejected; returns each person once with earliest scan, source, list name or null
  - unit tests (CSV columns, counts «en lista / sin lista», demo path) → pass
  - the project Test command → pass
- Outcome: migration 20261022100100 (admin_event_attendees, admin+2FA), panel «Entraron» per party in Fiestas y QR (Eventos in demo), counter en lista/sin lista, CSV apodo,email,en_lista,nombre_lista,escaneado,como; REQ-ADM-043 — 01dfc32

## Decisions
- 2026-10-22: Show everyone scanned, with or without list, and a CSV (Álvaro: «hazme ese cambio»)
- 2026-10-22: Admin (with 2FA) only, because it shows emails (orchestrator)
- 2026-10-22 T317: source = link if door_link_id set, else door/manual; GuestListApi.admin.attendees() added; demo builds it from local attendance (email null); party without list mode: counter «N han entrado», list column «—», CSV en_lista empty (agent)

## Proposals (new scope)
- 2026-10-22 T317: no e2e spec for the panel; production migration 20261022100100 pending (on Álvaro's yes)

## Log
- 2026-10-22 T317 launched · attempt 1 · agent a0994cd6a31bf0526
- 2026-10-22 T317 done · branch worktree-agent-a0994cd6a31bf0526 → 01dfc32; plan done
- 2026-10-22 production: applied 20261022100100 (admin_event_attendees); pushing main (Álvaro's yes)
