# Plan 039 — Real legal data (P21) in the legal pages

Status: active
Created: 2026-10-22
Base branch: main
Goal: Replace the invented `muestra` legal data (aviso legal, privacidad, cookies, `/legal/*`) with Álvaro's real data and remove the «muestra» markings on them, so the privacy policy no longer says «muestra». Real data given by Álvaro on 2026-10-22: titular «Boia planet», NIF E0764676C, domicilio «Calle Alicante, 7, 03005 Alicante», correo `hola@boiaplanet.net` (also for privacy matters). The texts themselves are NOT lawyer-reviewed: Álvaro was told to get a review; keep a reviewer note in the docs, not on the public pages.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T319 — Real legal data and accurate privacy text
- Status: pending
- Depends on: none
- Goal: (1) Find where the legal pages (`apps/web/app/(landing)/legal/[doc]/page.tsx`, content under `apps/web/lib/legal/` or i18n/store, `docs/DECISIONES.md` D-23/O14 and P21) keep the sample owner data and put the real values above everywhere they are used (aviso legal, privacidad, cookies, footer, Contacto, any `privacy@`-style sample address → `hola@boiaplanet.net`). Do not state a legal form (sociedad, asociación, comunidad de bienes): only name, NIF, address, email. Remove the «muestra» / «datos de ejemplo» markings and banners on the legal pages and any test or check that enforces them for legal data (update the test to assert the real values; never loosen others). (2) Make the privacy text accurate to what the app really does today: accounts and Carnet with email login code (Supabase); newsletter/emails if the app has them (Brevo as sender); hosting (Cloudflare, Vercel); own visit counters in Supabase (plan 032 T301, no PostHog, no third-party analytics) — fix the old sentence «Medición de visitas: apagada en esta versión»; guest list for parties (name chosen by the member, Carnet nickname, email and signup/scan date shown to BOIA staff); door scans (attendance recorded when the Carnet is scanned); data rights (access, rectification, erasure, etc.) with contact `hola@boiaplanet.net`; and what is stored in the browser (localStorage for the demo/local Carnet and preferences). Only claim what the code does: check cookies/storage (grep localStorage, cookies) and list them honestly. Do not invent retention periods or legal bases you cannot support: use cautious standard wording and list these two points under OUT OF SCOPE for the lawyer to confirm. (3) Update `docs/DECISIONS.md` P21 (mark real data received 2026-10-22, text review pending) only if that file may be edited by agents; `CLAUDE.md` says never edit `docs/DECISIONS.md` in plans — in that case do not touch it and report it instead. Update `docs/contenido-real.md` («Qué ha llegado ya»).
- Context: the legal route and its content source, `apps/web/lib/i18n/` legal keys, `docs/contenido-real.md`, REQ-PRO-020 in `docs/spec/`, tests that mention «muestra» for legal pages, the landing budget (do not touch landing code; legal pages are separate routes).
- Scope: may touch the legal content/i18n/sample files, the legal route, related tests, footer/Contacto only where the owner data or address is shown, docs/contenido-real.md, docs/spec/estado.md rows for REQ-PRO-020 only if their status really changes / must not touch `docs/DECISIONS.md`, other pages, SQL, production.
- Done when:
  - unit tests asserting the legal pages show `E0764676C`, `Calle Alicante, 7`, `03005 Alicante`, `hola@boiaplanet.net` and no longer contain «muestra» or «ejemplo» → pass
  - `grep -ri "muestra" ` over the legal content shows no remaining sample-marker for the owner data (state what remains and why)
  - the project Test command → pass
- Outcome:

## Decisions
- 2026-10-22: Real legal data as above, titular «Boia planet», email hola@ (Álvaro)
- 2026-10-22: Legal form not stated; retention periods and legal bases left for the lawyer (orchestrator)

## Proposals (new scope)

## Log
