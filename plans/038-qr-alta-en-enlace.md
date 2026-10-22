# Plan 038 — «Create a Carnet» QR on the shared door link page

Status: done
Created: 2026-10-22
Base branch: main
Goal: The staff door page (`/admin/puerta`) already shows a QR that opens «Crear carnet» (`/carnet?crear=1`) for people who arrive without a Carnet. The shared door link page (`/puerta/[token]`, plan 034 T307) does not. Show the same QR there so the security person with the link can show it to someone without a Carnet.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T318 — Signup QR on the shared door link page
- Status: done
- Depends on: none
- Goal: On `/puerta/[token]` (valid link), show the same «Crear carnet» QR block the staff door shows (reuse `SignupQr` from `apps/web/app/admin/door/signup-qr.tsx`, with the same fullscreen/print behaviour and texts) below or beside the scanner, so someone without a Carnet can scan it with their own phone and create one on the spot. It must not appear on the invalid/revoked link screen. The block must not get in the way of scanning on a phone (compact by default if the staff page has such a mode; one tap to enlarge).
- Context: `apps/web/app/admin/door/door-page.tsx` and `door-section.tsx` (where `SignupQr` is used today), the link route from plan 034 T307 (`apps/web/app/puerta/[token]/…` and the shared scanner components in `apps/web/app/admin/door/`), `apps/web/lib/scanner/carnet-url.ts` (`signupUrl`), `apps/web/lib/i18n/es-puerta.ts`, `apps/web/e2e/puerta-enlace.spec.ts`.
- Scope: may touch the link page and the door components that render it, i18n keys only if the staff texts do not fit, unit tests, the existing `puerta-enlace.spec.ts` (extend it) / must not touch SQL, the stamp rules, the staff page behaviour, the landing, production.
- Done when:
  - unit tests (the link page renders the signup QR for a valid link and not for an invalid one; the QR encodes `/carnet?crear=1` on the current origin) → pass
  - `E2E_PORT=<free> pnpm e2e puerta-enlace.spec.ts` → pass (extended: the signup QR is visible on the link page)
  - the project Test command → pass
- Outcome: compact SignupQr below the scanner on /puerta/[token] (valid links only), tap to enlarge; puerta-enlace.spec.ts extended; REQ-ADM-041 note — 1656413

## Decisions
- 2026-10-22: Same signup QR as the staff door, on the shared link page (Álvaro)

## Proposals (new scope)

## Log
- 2026-10-22 T318 launched · attempt 1 · agent a2b5277d3f58d2fb0
- 2026-10-22 T318 done · branch worktree-agent-a2b5277d3f58d2fb0 → 1656413; plan done (no component test setup: presence covered by e2e)
