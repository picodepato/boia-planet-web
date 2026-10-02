# Traspaso

Dónde está BOIA.PLANET y qué queda, para quien llegue sin contexto. Estado a
2026-10-01, con los planes 001–004 cerrados (último commit de código:
`6a10c3c`, T49). El detalle de cada tarea está en `ESTADO.md`; las reglas,
en [`CLAUDE.md`](../CLAUDE.md).

## En una pantalla

- **Qué hay:** la **versión de prueba** (D-20) completa y desplegada en
  https://boia-planet.vercel.app. Todo vive en el navegador del visitante:
  sin servidor, sin cuentas, sin correo y sin ticketera real. El contenido es
  `muestra` (inventado o sin aprobar).
- **Pruebas en `main`:** `pnpm test && pnpm typecheck && pnpm lint && pnpm
  build` salen con 0 (101 archivos, 917 pruebas, más los comprobadores de
  Python); `pnpm e2e`: 204 pasan, 36 saltadas, 0 fallan (T49, 2026-09-30).
- **Requisitos:** de los 294 REQ de la spec v15, **155 HECHO**, 59 PARCIAL,
  33 FALTA, 28 L2 y 19 para la versión final
  ([spec/estado.md](spec/estado.md)).
- **Lo que frena publicar de verdad** no es código: son las respuestas y el
  material de Álvaro (abajo) y los servicios de la versión final.

## Qué está construido

| Ruta | Qué es |
|---|---|
| `/` | Entrada cinemática (planeta → mar → letras 3D «BOIA», «Zarpar») y landing HTML con entradas, eventos, fotos y artistas |
| `/juego` | El mundo 2.5D isométrico (PixiJS): dos mundos, Arcilla (B05) y Acuarela (B02), con islas de eventos, náufragos, descuentos escondidos, cofres, delfín, Boia Fiestera, minijuegos Faro y Cañón, logros, ranking local, tienda de barcos y cambio de mundo por agujero negro |
| `/mar` | El mismo mundo en 3D (three.js), «planeta de agua» con «Entradas» siempre a mano; a la par con `/juego` en lo del plan 004 |
| `/carnet` | Carnet BOIA (perfil del visitante) |
| `/admin` | Admin sin login (D-20): eventos, descuentos, fotos, textos, mundo activo, integraciones (sólo lectura), «Volver todo a la muestra» |
| `/legal/*` | Aviso legal, privacidad y cookies, con datos **inventados** y aviso arriba |
| `/api/art` | Sirve el arte de `art/` (D-16) |

Stack: monorepo pnpm (Node 24), Next.js 15.5 + React 19 en `apps/web`,
`packages/` (`engine` motor Pixi, `world` mundos y comportamientos,
`contracts` tipos, `store` el repositorio local y la economía, `db` el
esquema de Supabase para la versión final), arte generado con Blender sin
interfaz desde `tools/blender/` (D-05).

| Plan | Qué cerró |
|---|---|
| [001](../plans/001-demo-l1.md) | Primer hito: entrada, landing con entradas, mundo navegable con el barco real. T07 (auth) y las tareas que dependían de ella, saltadas |
| [002](../plans/002-demo-completa.md) | Versión de prueba completa: dos mundos, misiones, comunidad, Admin, desplegable en Vercel |
| [003](../plans/003-mar-planeta.md) | `/mar` como planeta de agua, «Entradas» siempre visible, diálogos legibles, logros que se reclaman |
| [004](../plans/004-cierre-v14.md) | Los huecos del inventario v14 → código: economía de barcos, agujero negro, eventos y descuentos que llevan a su isla, ranking, sonido, endurecimiento del Admin, marca, entrega |

## Qué queda

### Se puede hacer ya (sin Álvaro ni Supabase)

- **Repasar los 59 PARCIAL y 33 FALTA** de [spec/estado.md](spec/estado.md).
  Muchos FALTA piden una revisión, una medición en móvil o un documento, no
  código (p. ej. REQ-PRO-008, REQ-ENT-021, REQ-ARQ-017).
- **Matriz de dispositivos:** 4 casos a mano (áreas seguras, zoom, sin
  conexión, pérdida del contexto gráfico) en
  [matriz-dispositivos.md](matriz-dispositivos.md).
- **i18n:** los diálogos de cada mundo siguen en
  `packages/world/src/worlds/*/skin.ts` (sus claves `world.<mundo>.…` ya
  están en el catálogo, falta que el mundo las lea); los nombres de paletas de
  `/mar` y los mensajes de consola no pasan por i18n.
- **CSP:** quitar `'unsafe-eval'` importando `pixi.js/unsafe-eval` en
  `@boia/engine` (`apps/web/lib/security-headers.ts`).
- **`/mar`:** los secretos usan arte hecho a mano (el `secreto.glb` de T39 no
  se usa); las animaciones de los comportamientos y la sensibilidad de
  Ajustes no se aplican; el Admin en la misma pestaña no dispara el vórtice
  (tampoco en `/juego`); la invitación al Carnet lleva a `/carnet`.
- **Restos:** `useShipLocks`/`lockedShipText` sin usar en
  `apps/web/lib/logros/use-logros.ts`.

Las propuestas de cada tarea están en la sección «Proposals» de cada plan.
Varias ya se hicieron en tareas posteriores (T51 cerró casi todo lo de
`/mar`): comprueba en el código antes de tomarlas.

### Depende de Álvaro

Tabla completa en [DECISIONES.md](DECISIONES.md), «Preguntas abiertas».

| # | Qué falta |
|---|---|
| P2 | Ticketera (candidata Fourvenues, D-06) y su cuenta |
| P3 | Fecha del próximo All Day (el primer evento real es BOIA Club · Halloween, 31-10-2026) |
| P14 | Visto bueno a `/mar` como planeta de agua y al catálogo de logros y premios |
| P15 | Enlaces reales: entradas, tienda, WhatsApp, Instagram, correo |
| P16 | Códigos de descuento reales con su % |
| P17 | Fotos de los 26 artistas y sus Carnets |
| P18 | Música con licencia, una por mundo |
| P19 | Cartel de BOIA Club · Halloween |
| P20 | Archivo de la tipografía de BOIA, si existe |
| P21 | Datos legales reales y revisión profesional de los textos legales |
| P22 | Lectura de los textos del equipo ([propuestas/textos-zonas.md](propuestas/textos-zonas.md)) y de O1–O15 de D-23 |

### Versión final (D-20)

Supabase (proyecto `boia-planet-dev`, P7: lo crea Hernán; el esquema ya está
en `supabase/migrations/`), acceso por correo con código y enlace (D-10),
login del Admin con TOTP, ticketera real con webhook, PostHog, editor visual
del Admin, dominio y cuentas de BOIA, copias y restauración. La lista para
publicar es REQ-PRO-020 y la firma Álvaro: [entrega.md](entrega.md).

La auth de T07 (OTP + enlace, sesión de invitado, fusión idempotente, dos
migraciones) quedó a medias en la rama `worktree-agent-a208530713932c80c`
(commit `a4c68d3`, «T07: WIP»). Es el punto de partida de la versión final.

## Cosas que conviene saber

- No hace falta ninguna variable de entorno ([.env.example](../.env.example)).
- `pnpm test` sin filtro corre también los comprobadores de Python
  (`tools/spec/checks.sh`, ~1 min, necesita `python3`).
- El build falla si la landing pasa de su presupuesto (192 kB gzip; está en
  190,9).
- Vercel: Root Directory `apps/web` con los archivos de fuera incluidos
  (`packages/` y `art/`). Cada push a `main` despliega a producción. Detalle
  en el [README](../README.md).
- Los worktrees de agentes salen de `HEAD` (`.claude/settings.json`) y copian
  lo que lista `.worktreeinclude`.
- Para seguir con el mismo método: `/orchestrator` con el objetivo del plan
  005 (`.claude/skills/orchestrator/SKILL.md`).
