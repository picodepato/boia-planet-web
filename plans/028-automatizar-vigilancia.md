# Plan 028 — Automate the watch over hosts, expiries and GitHub workflows

Status: done
Created: 2026-10-12
Base branch: main
Goal: After plan 027 the site runs on Cloudflare (public, `https://boiaplanet.net`) and Vercel (backup), with scheduled GitHub workflows (`hosts-parity.yml`, `supabase-keepalive.yml`, `supabase-backup.yml`). Automate, inside the repo and with no new accounts, secrets or money, the failure modes Álvaro listed on 2026-10-12: expiry dates nobody remembers, GitHub silently disabling scheduled workflows after 60 days without repo activity, a Worker that grows past the Cloudflare free limit, and commits authored by someone other than `picodepato` (Vercel Hobby then stops deploying). Everything that needs Álvaro in a panel or a new secret lives in `plans/seguridad-pendiente.md`, not here.
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

Notes for every task: same machine notes as plan 027 (`plans/027-cloudflare-doble-despliegue.md`, "Notes for every task"): Windows 10 + Git Bash, `packages/db` excluded, `PYTHONUTF8=1`, run the checks one by one if a guard blocks the chain, never commit `apps/web/public/atlas/`, `.claude/launch.json`, `.claude/*.out`, `e*.log`, `reunion/`, `output/` or `.env*` (except `.env.example`), never push or deploy, never create accounts, tokens or secrets, never edit `docs/DECISIONES.md`. Álvaro runs the project. Never run the e2e suite. Workflows use only the built-in `GITHUB_TOKEN` with the narrowest `permissions:` block; no third-party actions beyond `actions/checkout`, `actions/setup-node` and `pnpm/action-setup` (pin major versions as the existing workflows do). Messages and docs for Álvaro in Spanish; code and comments follow the surrounding style. Model: opus. Skills: none.

## Tasks

## T266 — Expiry reminders and keeping scheduled workflows alive
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: (1) A data file with every dated expiry (start with: domain `boiaplanet.net` at Porkbun, expires 2027-10-12, auto-renew on, 12.52 USD/yr; Brevo SMTP key used by Gmail "Send as" for `hola@boiaplanet.net`, expires 2027-10-12) and a recurring item "send at least one email from `hola@` this month" (the Brevo key also dies after 90 days without SMTP use; this reminder stands in until that is automated). A scheduled workflow `recordatorios.yml` (monthly plus `workflow_dispatch`) runs a small Node script that opens a GitHub issue per item when it is within 60, 30 or 7 days (one open issue per item; at a later threshold it comments instead of opening a duplicate; it closes nothing on its own), plus the monthly `hola@` issue (skip if last month's is still open, comment on it instead). Issue text in Spanish says what expires, the date, what breaks and how to renew (copy the renew steps from `docs/DESPLIEGUE.md` §8). (2) Make every scheduled workflow resistant to GitHub's 60-day inactivity disable: research how (e.g. the REST "enable a workflow" endpoint called with `GITHUB_TOKEN` + `actions: write` from a frequently scheduled workflow, for all scheduled workflows including itself), implement it, and state in ESTADO and in `docs/DESPLIEGUE.md` §8 what is proven and what is only documented behaviour. Update the §8 table so it points at the automation.
- Context: `.github/workflows/*.yml` (style), `docs/DESPLIEGUE.md` §8 "Cosas que caducan", `apps/web/scripts/check-hosts.mjs` + `hosts.test.ts` (style for a Node script with unit tests).
- Scope: may touch `.github/workflows/` (new `recordatorios.yml`; the scheduled ones only to add the keep-alive step), a new data file and script (e.g. under `tools/ops/` or `apps/web/scripts/`), their unit tests, `docs/DESPLIEGUE.md` §8, root `package.json` scripts / must not touch app code, Supabase migrations, `docs/DECISIONES.md`, existing workflow behaviour beyond the keep-alive step.
- Done when:
  - unit tests for the reminder logic (outside window → nothing; 60/30/7 thresholds; existing open issue → comment, not duplicate; monthly item) → pass
  - the script has a dry-run mode that prints what it would do for a given date; ESTADO shows its output for 2027-08-20 and for today
  - Test command → exit 0
- Outcome: `recordatorios.yml` (weekly, issues at 60/30/7 days + monthly `hola@` nudge, data in `apps/web/scripts/caducidades.json`) and a `keepalive-workflows` job in the 4 scheduled workflows; 479a38f

## T267 — CI checks: Worker size budget and commit author
- Status: done
- Depends on: none
- Model: opus
- Skills: none
- Goal: (1) A workflow on every push to `main` (and on pull requests) that runs `pnpm cf:measure` on Linux (Node 24, pnpm 11.27.1, as Cloudflare Workers Builds uses) and fails with a clear Spanish message above the 2,800 KiB gzip budget, or if the static assets break Cloudflare's limits (20,000 files, 25 MiB per file). Cache the pnpm store; keep it under ~10 min. (2) A check, in the same or a separate workflow, that fails when any commit pushed to `main` (the range `before..after`; for PRs the PR's commits) has an author not in an allowlist (start with `picodepato` / `admin@boiaplanet.net`; keep the list in one place), with a message explaining that Vercel Hobby stops deploying commits from other authors and how to fix it (amend/rebase the author). Logic in a small Node script with unit tests; the workflow only calls it.
- Context: `apps/web/scripts/cf-measure.mjs` (it already copies the repo with `nodeLinker: hoisted`; on Linux check whether that copy is needed and reuse it either way), plan 027 Decisions (T262) in `plans/027-cloudflare-doble-despliegue.md`, `.github/workflows/hosts-parity.yml` (style), `CLAUDE.md` (commit author rule).
- Scope: may touch `.github/workflows/` (new files only), `apps/web/scripts/` (new script + tests; `cf-measure.mjs` only to add a machine-readable exit/limit check if needed), root/app `package.json` scripts, `docs/DESPLIEGUE.md` (one short paragraph naming the checks) / must not touch app code, `wrangler.jsonc`, `open-next.config.ts`, the other workflows.
- Done when:
  - unit tests for the author check (all allowed; one foreign author; empty range; first push with `before` all zeros) → pass
  - `pnpm cf:measure` locally → exit 0 and the size limit check is exercised by a unit test (over budget, too many files, file too large)
  - Test command → exit 0
- Outcome: `cf-size.yml` (cf:measure on Linux, limits incl. 20k files / 25 MiB) and `commit-author.yml` (`pnpm check:authors`, allowlist in `apps/web/scripts/check-authors.mjs`); 1e9efa2

## Decisions
- 2026-10-12: Only what needs no account, secret or money is in this plan; panel settings, new secrets (backup, Brevo key), 2FA and similar go to `plans/seguridad-pendiente.md`, offered to Álvaro when the next plan starts (Álvaro)
- 2026-10-12 T267: two workflows, `cf-size.yml` (push/PR/manual, ubuntu-24.04, 15 min) and `commit-author.yml`, both `contents: read`; cf-size reuses the hoisted copy on Linux, pnpm from `packageManager`, a test keeps it equal to `PNPM_VERSION` in DESPLIEGUE
- 2026-10-12 T267: `limitProblems()` exported from `cf-measure.mjs` with Spanish messages and `::error::` lines; allowlist by email: `admin@boiaplanet.net` + picodepato's GitHub noreply (web merges); zero/forced `before` → check only `after`
- 2026-10-12 T266: `recordatorios.yml` runs weekly (Monday), hidden markers dedupe so the monthly item still fires once a month; data/script/tests in `apps/web/scripts/` (`caducidades.json`, `recordatorios.mjs`) because vitest only collects `apps/*`; past an expiry it keeps warning until the date is updated
- 2026-10-12 T266: `keepalive-workflows` job (`actions: write`) in all 4 scheduled workflows re-enables active or inactivity-disabled workflows, leaves manually disabled ones; that "enable" resets the 60-day count is community practice, not documented by GitHub

## Proposals (new scope)

## Log
- 2026-10-12: plan written and approved in session (Álvaro: "lanza ahora todas las que puedas hacer tú solo")
- 2026-10-12 23:45 T266 launched (attempt 1, opus), agent a75bb588ae65c9c79
- 2026-10-12 23:45 T267 launched (attempt 1, opus), agent a79477a651e288365
- 2026-10-12 23:53 T267 done, merged 1e9efa2
- 2026-10-12 23:58 T266 conflict in package.json with T267; sent back to its agent
- 2026-10-13 00:01 T266 first integration failed: secretos.test found a JWT in main's stale .next, built after the orchestrator had Álvaro put the legacy anon JWT in apps/web/.env.local; restored the project's sb_publishable/sb_secret keys (still valid), rebuilt, T266 merged 479a38f. Plan done
