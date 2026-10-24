# Plan 047 — Remove «Probar admin» from the public site

Status: done
Created: 2026-10-24
Base branch: main
Goal: The public site still shows a «Probar admin» link (landing footer, `blocks.tsx`, and the menu, `lib/mundo/menu/onboard-menu.tsx`). Álvaro: it must not appear; the Admin is reached at `/admin`. This retires the temporary REQ-ADM-039 link (its own spec says it goes once real admin login exists, which it does since accounts mode is live).
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T327 — Remove the «Probar admin» links
- Status: done
- Depends on: none
- Goal: Remove the «Probar admin» link from the landing footer (`apps/web/app/(landing)/components/blocks.tsx` ~line 637) and from the menu (`apps/web/lib/mundo/menu/onboard-menu.tsx` ~line 94), plus any other public place that links to `/admin` with that label. Remove the now-unused i18n keys (`footer.tryAdmin`, `footer.tryAdmin.hint`) and `ADMIN_COPY.tryAdmin*` if nothing else uses them. `/admin` itself keeps working exactly as today (accounts login in production; the demo admin without Supabase when there are no Supabase variables). Update the spec: REQ-ADM-039 in `docs/spec/07-admin.md` / `09-requisitos.md` / `estado.md` → the link from the landing and the menu is retired (2026-10-24, Álvaro); the demo Admin remains reachable at `/admin` only in the no-Supabase build. Update e2e specs and unit tests that click «Probar admin» to navigate to `/admin` directly instead (never drop what they test about the Admin itself). Also update `docs/spec/00-indice.md` line about «Probar admin» if needed.
- Context: the files above, `apps/web/lib/admin/copy.ts`, `apps/web/lib/admin/paths.ts`, `apps/web/lib/i18n/es-zonas-web.ts`, `grep -rn "Probar admin\|tryAdmin" apps/web docs/spec`, the landing budget (removing code only helps).
- Scope: may touch those components, i18n keys, admin copy, tests and e2e specs that use the link, docs/spec / must not touch the Admin pages and their access control, SQL, production. Do not run the full e2e; run only the specs you change.
- Done when:
  - `grep -rn "Probar admin\|tryAdmin" apps/web --include=*.ts --include=*.tsx` → nothing left in app code (tests may assert its absence)
  - the changed e2e specs, run alone → pass
  - the project Test command → pass
- Outcome: link removed from footer and menu, keys and ADMIN_COPY.tryAdmin* removed, REQ-ADM-039 renamed «Admin de la demo» (link retired 2026-10-24), admin.spec opens /admin directly and checks the footer has no /admin link — 9797aa9

## Decisions
- 2026-10-24: «Probar admin» goes from the landing and the menu; Admin only via /admin (Álvaro)

## Proposals (new scope)
- 2026-10-24 T327: DECISIONES.md, manual-alvaro.md, manual-admin.md, entrega.md and docs/presentacion 02-landing.ts still describe the «Probar admin» button

## Log
- 2026-10-24 T327 launched · attempt 1 · agent a2a4a24ee140f7f35
- 2026-10-24 T327 done · branch worktree-agent-a2a4a24ee140f7f35 → 9797aa9; plan done
