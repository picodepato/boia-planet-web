# Skills del proyecto

Claude Code las carga solas al abrir una sesión en este repo. Si hay una
skill personal (`~/.claude/skills/`) con el mismo nombre, manda la personal.

| Skill | Para qué | Origen |
|---|---|---|
| `orchestrator` | `/orchestrator`: planifica con Hernán un lote de ~10 tareas (`plans/NNN-*.md`) y lo corre con agentes en worktrees, integrando cada tarea en `main` con sus pruebas. Es el método vigente (planes 001–004). | Skill casera de Hernán, copiada el 2026-10-01 con las rutas apuntando al repo |
| `grilling` | La entrevista por rondas que usa `orchestrator` para armar el plan. | [mattpocock/skills](https://github.com/mattpocock/skills) (`skills/productivity/grilling`), MIT, ver su `LICENSE` |
| `grill-me` | `/grill-me`: atajo manual a `grilling`. | [mattpocock/skills](https://github.com/mattpocock/skills) (`skills/productivity/grill-me`), MIT, ver su `LICENSE` |
| `frontend-design` | Dirección visual al construir o rehacer UI (tipografía, paleta, composición, movimiento). Se invoca sólo en tareas de diseño visual (p. ej. el parallax de la landing), no en las de rendimiento, pruebas o docs. Aquí manda la identidad ya aprobada de BOIA sobre sus defaults. | [anthropics/skills](https://github.com/anthropics/skills) (`skills/frontend-design`), Apache-2.0, ver su `LICENSE.txt`; copiada el 2026-10-02 |
| `orquestador`, `encargo` | El método de la ronda 1 (encargos numerados en `docs/prompts/`). Histórico. | Propias del proyecto |

## Lo que `orchestrator` necesita fuera del repo

- **`python3`** del sistema (sus scripts sólo usan la biblioteca estándar).
- **Telegram (opcional).** Para avisar a Hernán y recibir sus respuestas,
  `scripts/tg.py` lee un JSON con esta forma:

  ```json
  { "telegram": { "bot_token": "<token del bot>", "chat_id": "<id del chat de Hernán>" } }
  ```

  Por defecto lo busca en la ruta del Mac de Hernán; en otra máquina, se
  apunta con la variable `TELEGRAM_CONFIG`. El archivo nunca va al repo.
  Se comprueba con:

  ```sh
  python3 .claude/skills/orchestrator/scripts/tg.py check
  ```

  Sin él, el orquestador pregunta todo en la propia sesión.
- **Modo de permisos `bypassPermissions`** en la sesión del orquestador (lo
  comprueba al arrancar), y `.claude/settings.json` con
  `"worktree": {"baseRef": "head"}` (ya está).

Mientras corre, el hook `scripts/guard.py` bloquea `git push`, despliegues,
`git reset --hard`, `git clean` y `rm -r` fuera del checkout, en la sesión y
en sus agentes. Para probarlo con un comando:
`python3 .claude/skills/orchestrator/scripts/guard.py --explain 'git push'`.
