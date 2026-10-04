# Telegram

The orchestrator writes to Hernán on Telegram at once in four cases: it needs his decision, a
task failed twice, a task was integrated into main (Hernán, 2026-10-04), or the plan finished.
It also sends at most one reminder per decision question. There is no watchdog notice: timers
were removed (Hernán, 2026-09-29). Nothing else.

Messages are in Spanish and start with `[{project}]`. They do not name the task id. Questions
carry the options with the recommended one marked, and every message ends with the session
link line.

The script is `<repo>/.claude/skills/orchestrator/scripts/tg.py`. Write the message to a file first,
then pass `--file` so quoting never breaks it. Never print or copy the bot token.

## Asking and waiting

1. `python3 tg.py ask --id {qid} --file {msgfile}`, where qid = `{project}-{NNN}-{Txx}-{n}`.
   Add `--attach {absolute path}` (repeatable) for each file the agent listed as `ATTACH:`. Images go
   as photos and anything else as a document, each sent as a reply to the question; replying
   to an attachment also counts as the answer.
2. Start the wait with the Bash tool and `run_in_background: true`:
   `python3 tg.py wait --id {qid} --timeout 14400`
   When it exits, the session wakes up with its output:
   - `REPLY {qid}` + the answer text (exit 0)
   - `TIMEOUT {qid}` (exit 3): 4 hours without an answer
   - `CANCELLED {qid}` (exit 4)
3. Also show the question in the session. If Hernán answers there first, stop the background
   wait and run `python3 tg.py cancel --id {qid}`.
4. On TIMEOUT: if nothing is running and nothing is ready (everything is stalled), send
   `python3 tg.py remind --id {qid} --file {reminderfile}` once, then wait again without
   `--timeout`. If other work is still moving, wait again with `--timeout 3600` and check again
   then. Never send a second reminder for the same question.

Several orchestrator sessions can wait at once: they take turns reading the bot, and each reply
goes to the session whose message Hernán replied to. Only messages from his configured chat count.

## Push offers (task done, plan finished)

Every "task done" and "plan finished" message offers to deploy the test version, so Hernán can
try the changes from anywhere. Send it with `ask`, id `{project}-{NNN}-push-{Txx}` (`-push-end`
for the plan), and start its wait in the background **without** `--timeout`. Only one push offer
is open at a time: before asking a new one, `tg.py cancel` the previous one (its wait ends with
CANCELLED; that is expected). Never remind about a push offer.

When the answer arrives:
- A / sí / yes: if an integration is running, wait for it to end. Then, in the main checkout,
  `git push origin main` (the guard allows exactly this command), and `tg.py send`:
  `[{project}] Subido ✓ En ~2 min está en {URL}` (the test URL from the project's CLAUDE.md or README), or the error in
  one line if the push failed. Note it in the plan's Log.
- B / no / anything else: drop it. Free text that is an instruction is handled like a message
  on screen.

On resume, `tg.py cancel` every pending `-push-` question instead of waiting on it.

## Formats

**Decision needed**
```
[{project}] Necesito una decisión
{la pregunta, en 1–3 líneas}
A) {opción}
B) {opción}  ← recomiendo: {por qué, una línea}
Sesión «{session title}» → https://claude.ai/code
Respondé con «Responder» a este mensaje (A, B o texto libre), o en la sesión.
```

**Task failed twice**
```
[{project}] Falló dos veces: {qué se intentaba hacer, en pocas palabras}
{qué falló: comando y error, 1–2 líneas}
A) Reintentar  B) Saltear  C) Otra instrucción  ← recomiendo: {letra y por qué}
Sesión «{session title}» → https://claude.ai/code
Respondé con «Responder» a este mensaje, o en la sesión.
```

**Reminder** (sent with `tg.py remind`, as a reply to the question)
```
[{project}] Sigo esperando tu respuesta a esta pregunta. Todo lo demás está parado.
```

**Task done** (push offer, sent with `tg.py ask`)
```
[{project}] ✓ Hecha ({n}/{total}): {título de la tarea}
{mini resumen de lo aplicado, 2–4 líneas en lenguaje llano: qué cambia para quien usa la web}
Tests en main: ok.
¿Subo a Vercel para que lo pruebes? A) Sí  B) Todavía no
Respondé con «Responder» si querés subirlo; si no, no hace falta contestar.
```

**Plan finished** (push offer, sent with `tg.py ask`)
```
[{project}] Plan {NNN} terminado
{n}/{total} hechos{, n fallidos}{, n salteados}. Tests en main: {ok | fallan}.
Resumen: {3–6 líneas: lo que cambió en la web, en lenguaje llano}
{n} decisiones para revisar, detalle en la sesión «{session title}».
¿Subo a Vercel? A) Sí  B) Todavía no
```

**Next plan** (sent with `tg.py send` right after "plan finished")
```
[{project}] ¿Arrancamos otro plan?
Abrí la sesión «{session title}» en la app de Claude (Remote Control), escribí /clear y después
/orchestrator {qué querés lograr}. Así empieza con el contexto limpio.
```
