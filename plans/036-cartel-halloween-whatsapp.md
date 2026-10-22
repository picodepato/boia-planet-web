# Plan 036 — Real Halloween poster and real WhatsApp link

Status: done
Created: 2026-10-22
Base branch: main
Goal: Álvaro supplied the real Halloween poster and the real WhatsApp invite link (a group where nobody can write, because WhatsApp is not letting him create channels now). Make both real on the web: the poster appears in the «Próximo evento» band, `/eventos/halloween-2026` and the event sheet in `/mar`; the WhatsApp link replaces the `muestra` one in the footer invite, Contacto and the WhatsApp boia in `/mar`.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T316 — Real Halloween poster and WhatsApp link
- Status: done
- Depends on: none
- Goal: (1) Put the poster at `apps/web/public/contenido/carteles/halloween-2026.webp` (source image: `C:\Users\alvar\.claude\uploads\fe3a4dfc-053c-4cc5-9f81-96cfaabe78dc\7ce4c3d2-image.png`, 1086×1448, 3:4 portrait). Convert to WebP, keep 3:4, 900×1200 px, ≤ 200 kB (use `sharp` if it is installed in the repo's node_modules, otherwise another tool already available; do not add dependencies). Register it: `eventPosters: ['halloween-2026']` in `packages/store/src/sample/real-content.ts`. (2) Set `links.whatsapp` in the same file to `https://chat.whatsapp.com/LfcWsDaBzbLAB6H7WK7Lyw` so the real group replaces the sample everywhere it is used (footer invite, Contacto, the WhatsApp boia in /mar); remove the «MUESTRA» marking for it if the code has one tied to this value. Follow `docs/contenido-real.md` (rows 1 and 9, section «Ejemplo») and update that doc's status table if it tracks which real content arrived.
- Context: `docs/contenido-real.md`, `packages/store/src/sample/real-content.ts`, `packages/store/src/sample/content.ts` (`eventPosterPath`), `apps/web/app/(landing)/components/real-content.test.ts` (checks that every real item has its file), the landing budget (`pnpm build`: landing is ~0.1 kB under 200 kB, a poster image is a file, not JS, so it must not move the budget; if it does, report), the files that render WhatsApp (`blocks.tsx`, `site-header.tsx`, `live-landing.tsx`, `carnet-invite.tsx`, `app/mar/engine/mar3d.ts`).
- Scope: may touch the poster file, `real-content.ts`, `docs/contenido-real.md`, tests that assert the sample/real state of these two items (update them to the new real values, never loosen them) / must not touch the event hour, prices or any other event data (the poster says 22:00–4:00 but the hour is Álvaro's call), other real content, SQL, production.
- Done when:
  - `pnpm exec vitest run apps/web/app/(landing)/components/real-content.test.ts` plus any test you changed → pass
  - the WebP exists, is 900×1200, ≤ 200 kB (state the real numbers)
  - the project Test command → pass
- Outcome: poster halloween-2026.webp (900×1200, ~125 kB) + eventPosters, real WhatsApp group link, Halloween startsAt 22:00 (content + seed, seed ends_at 04:00), docs «Qué ha llegado ya» — 6230cb3

## Decisions
- 2026-10-22: Poster published as the real one (Álvaro: «sube el cartel») (Álvaro)
- 2026-10-22: WhatsApp stays a group (nobody can write) because WhatsApp is not letting him create channels now; the link is the one already on the sample site; switch to a channel link later (Álvaro)
- 2026-10-22: Halloween hour becomes 22:00 (end 04:00 if modelled), as on the poster; list closing stays 22:30 (Álvaro)
- 2026-10-22 T316: endsAt not added to content.ts (landing would be 19 B over the 200 kB budget); real-content/eventos tests assert the real poster; island-memories test reads only <a href> (agent)

## Proposals (new scope)
- 2026-10-22 T316: production public.events row halloween-2026 still has starts_at 22:00Z (=23:00 Madrid) and ends_at null: needs UPDATE to 21:00Z / 2026-11-01 03:00Z (on Álvaro's yes)
- 2026-10-22 T316: landing budget has no headroom; showing the 04:00 end needs raising the budget or trimming

## Log
- 2026-10-22 T316 launched · attempt 1 · agent af4bd1625066fe4e7
- 2026-10-22 T316 done · branch worktree-agent-af4bd1625066fe4e7 → 6230cb3; plan done
- 2026-10-22 production: UPDATE public.events halloween-2026 → starts_at 2026-10-31 21:00Z (22:00 Madrid), ends_at 2026-11-01 03:00Z (04:00); pushed to main (Álvaro's yes)
