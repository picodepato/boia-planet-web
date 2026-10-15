# Plan 033 — Twice-monthly SMTP test email so the Brevo key never goes stale

Status: active
Created: 2026-10-15
Base branch: main
Goal: The Brevo SMTP key that Gmail «Send as» uses for `hola@boiaplanet.net` expires after 90 days without sending. Álvaro created a new key (`gmail-y-github`, 2026-10-15) and stored it as GitHub secrets `BREVO_SMTP_LOGIN` and `BREVO_SMTP_KEY`. A scheduled GitHub workflow sends a short test email from `hola@` to `hola@` twice a month through Brevo's SMTP with that same key, so the key stays in use; if sending fails, the run goes red and GitHub emails Álvaro. The existing monthly reminder issue («enviar-desde-hola») stays as a second safety net (Álvaro).
Test command: export PYTHONUTF8=1 && pnpm exec vitest run --exclude '**/packages/db/**' --testTimeout=30000 && sh tools/spec/checks.sh && pnpm lint && pnpm build && pnpm typecheck
Worktree setup: pnpm install --frozen-lockfile
Status file: ESTADO.md

## Tasks

## T306 — Twice-monthly SMTP test email workflow
- Status: pending
- Depends on: none
- Goal: New workflow `.github/workflows/smtp-ping.yml` that sends one plain-text test email through Brevo SMTP on the 1st and 15th of every month (cron, UTC, off the hour) and on `workflow_dispatch`. From and To: `hola@boiaplanet.net`. Server `smtp-relay.brevo.com`, port 587, STARTTLS, user = `secrets.BREVO_SMTP_LOGIN`, password = `secrets.BREVO_SMTP_KEY`. Missing secrets → fail with a clear `::error::` (like `supabase-backup.yml` does). Any SMTP error → non-zero exit, so the run is red and GitHub notifies. Send with Python's standard library (`smtplib`, `email.message`) in a small script under `.github/scripts/` — no third-party GitHub actions for sending. The secrets must never be printed (no `set -x`, no echoing env). Subject/body short, in Spanish, saying it is the automatic test that keeps the Gmail «Enviar como» key alive and that it can be ignored, with the run date.
- Context: `.github/workflows/supabase-backup.yml` (secret checks, style, permissions), `.github/scripts/storage-backup.py` (script style), `apps/web/lib/admin/backup-workflow.test.ts` (how workflows are tested), `apps/web/scripts/caducidades.json` (entry `brevo-smtp-hola`, already updated 2026-10-15; reminder `enviar-desde-hola` must stay), `apps/web/scripts/recordatorios.test.ts`, `docs/DESPLIEGUE.md` §6 and the expiry table row for the Brevo key (~line 420), `plans/seguridad-pendiente.md` is the orchestrator's (do not edit).
- Scope: may touch the new workflow, a new script under `.github/scripts/`, a new unit test for the workflow (and for the script if it has logic worth testing, e.g. building the message without sending), `docs/DESPLIEGUE.md` (one short paragraph + the expiry table row: «automatic: smtp-ping.yml on days 1 and 15»), the `detalle` of `brevo-smtp-hola` in `caducidades.json` if helpful / must not touch the existing reminder `enviar-desde-hola`, other workflows, app code, secrets, or send any email yourself (never run the script against the real server).
- Done when:
  - `pnpm exec vitest run <the new test file(s)>` → pass; the tests read the real workflow file and check: cron with days 1 and 15, `workflow_dispatch`, both secrets referenced only through `secrets.*`, a missing-secret check, host `smtp-relay.brevo.com` and port 587, no third-party `uses:` besides `actions/checkout`/`actions/setup-python` (if used), `permissions` minimal
  - `python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" <script>` → exit 0
  - the project Test command → pass
- Outcome:

## Decisions
- 2026-10-15: Twice a month (days 1 and 15), from hola@ to hola@ (Álvaro)
- 2026-10-15: Keep the monthly reminder issue as a second safety net (Álvaro)
- 2026-10-15: One-task plan; the security checklist items that needed panels were done by Álvaro in this session (orchestrator)

## Proposals (new scope)

## Log
