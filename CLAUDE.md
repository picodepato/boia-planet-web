# boia-planet

BOIA.PLANET: la web-universo de BOIA, colectivo de eventos musicales de
Alicante. Vende entradas de los "All Day BOIA" y, como segunda vía de
conversión, ofrece un mundo 2.5D isométrico navegable en barco (islas de
eventos, Boia Fiestera, descuentos escondidos, Carnet BOIA). El cliente y
quien aprueba identidad, negocio y publicación es Álvaro (BOIA); Hernán
dirige la construcción.

Versión de prueba en producción: https://boia-planet.vercel.app (D-20: todo
en el navegador, sin servidor ni cuentas; contenido `muestra`). Cada push a
`main` despliega a producción en Vercel.

## Empieza aquí

Un agente nuevo lee, en este orden:

1. [`docs/TRASPASO.md`](docs/TRASPASO.md) — dónde está el proyecto, qué
   queda y qué depende de Álvaro. Una pantalla.
2. [`README.md`](README.md) — arrancar, probar y desplegar.
3. `docs/DECISIONES.md` y `docs/spec/00-indice.md` — los requisitos (abajo).
4. La sección de arriba de `ESTADO.md` y el plan más nuevo de `plans/`, para
   el detalle de lo último que se hizo.

## Requisitos

Fuente de requisitos, en este orden de precedencia:

1. `docs/DECISIONES.md` — decisiones vigentes (D-01 a D-23) y preguntas
   abiertas a Álvaro. Prevalece sobre todo lo demás.
2. `docs/spec/` — especificación consolidada v15. Un requisito, un ID, un
   sitio (`09-requisitos.md`). El estado de cada REQ (HECHO, PARCIAL, FALTA,
   L2, final) y la prueba que lo sostiene están en `docs/spec/estado.md`.
3. `docs/fuente/v14-maestro.md` — el documento maestro v14 de Álvaro, texto
   íntegro. Es histórico: 50 secciones con capas de decisiones; las §49 y
   §4.4 prevalecen sobre las anteriores dentro de él.

## Cómo se trabaja

Desde la ronda 2 el trabajo va por **planes**: `plans/NNN-<slug>.md`, lotes
de ~10 tareas grandes (T00, T01…, la numeración sigue entre planes) que la
skill `/orchestrator` (`.claude/skills/orchestrator/`; qué necesita, en
`.claude/skills/README.md`) planifica con Hernán y
corre con agentes en worktrees, integrando cada tarea en `main` con sus
pruebas. Los planes 001–004 están terminados; el siguiente es el 005.

- Cada tarea deja su sección arriba de `ESTADO.md` (`## <fecha> — plan NNN
  Txx: <título>`: qué existe, comandos con su resultado, pendiente).
- Al cerrar algo, sube su REQ en `docs/spec/estado.md` y enlaza la prueba
  (`python3 tools/spec/estado.py` falla si un HECHO no tiene prueba).
- Comprobación completa: `pnpm test && pnpm typecheck && pnpm lint && pnpm
  build`, más `E2E_PORT=<libre> pnpm e2e --workers=2` (~15 min). Se lee por
  el código de salida y los conteos.
- Textos de interfaz por clave en `apps/web/lib/i18n/`; nada de cadenas
  sueltas en componentes.
- Contenido real (fechas, entradas, fotos, textos, legales): sólo con el
  visto bueno de Álvaro; hasta entonces es `muestra`.
- Push, despliegue, cuentas, claves y todo lo que sale fuera del repo los
  decide Hernán.

La ronda 1 usó otro método, que queda como registro: sesión orquestadora
(`/orquestador`, backlog en `docs/PLAN.md`) y encargos numerados
(`/encargo NN`, `docs/prompts/`, informes en `docs/informes/`). Esas skills
siguen en `.claude/skills/`, pero no son el método vigente.
