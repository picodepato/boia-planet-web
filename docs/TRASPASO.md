# Traspaso

Dónde está BOIA.PLANET y qué queda, para quien llegue sin contexto. Se
actualizó el 2026-10-15 al cierre del plan 032. Lo de cada plan está en
`ESTADO.md` y en `plans/`; las reglas de trabajo, en [`CLAUDE.md`](../CLAUDE.md).

## En una pantalla

- **Quién lleva el proyecto:** Álvaro (BOIA, GitHub `picodepato`) desde el
  2026-10-12. Hernán aparece en el historial como quien lo dirigió hasta el plan 026.
- **Dónde corre:** la web pública es Cloudflare Workers (Worker `boia-planet`,
  `boiaplanet.net`); Vercel (https://boia-planet-roan.vercel.app) es una copia
  idéntica del mismo build. Cada push a `main` despliega a los dos. Detalle y
  qué hacer si uno cae: [DESPLIEGUE.md](DESPLIEGUE.md).
- **Modo cuentas:** activo en los dos hosts desde el 2026-10-14. Sin cuentas
  no hay ticketera real: las entradas y el contenido siguen siendo `muestra`.
- **Último plan cerrado:** 032 (pulido de /mar y embudo propio). Los últimos seis:
  - **027** Cloudflare con doble despliegue (Cloudflare y Vercel), PWA.
  - **028** Vigilancia automática de hosts, caducidades y flujos de GitHub.
  - **029** El mundo con gracia: clima, olas grandes, personajes con frases, isla «after».
  - **030** Landing abierta a Google (títulos, canónicas, sitemap, robots), imágenes para compartir, bloque «Sácate el Carnet».
  - **031** Los artistas reclaman su perfil con un enlace personal.
  - **032** /mar con mar vivo (olas y balanceo), /mar sobrevive a la pérdida de WebGL, avisos y 🪪 en SVG, embudo con contadores propios en Supabase y panel «Embudo» del Admin (PostHog retirado), copias probadas, paridad de hosts y lint de textos sueltos.
- **Requisitos** ([spec/estado.md](spec/estado.md); `python3 tools/spec/estado.py`):
  295 REQ: **187 HECHO**, 59 PARCIAL, 14 FALTA, 25 L2, 8 para la versión
  final y 2 retirados. REQ-ARQ-018 pasa a HECHO en el plan 032 (T304);
  REQ-ARQ-019 (embudo propio) sigue PARCIAL porque `purchase_confirmed` llega
  con la ticketera real.
- **Pruebas** (T304, esta rama): `vitest` con 348 archivos, 3099 pruebas
  pasando y 3 omitidas; `tools/spec/checks.sh` (cada comprobador), `pnpm lint`,
  `pnpm build` y `pnpm typecheck` con código 0. La e2e completa la corre Álvaro
  (`E2E_PORT=<libre> pnpm e2e --workers=2`, unos 15 min); los agentes sólo
  corren un spec cuando hace falta.
- **Arranque, pruebas y despliegue:** [README.md](../README.md).
- **Comandos** (en Windows: `PYTHONUTF8=1`, y `packages/db` fuera de vitest
  porque pide un Postgres local): `pnpm exec vitest run --exclude
  '**/packages/db/**' --testTimeout=30000`, `sh tools/spec/checks.sh`,
  `pnpm lint`, `pnpm build`, `pnpm typecheck`. Los textos de interfaz van por
  clave en `apps/web/lib/i18n/`; la regla `boia/no-loose-strings` avisa de los
  sueltos en `.tsx`.

## Qué está construido

- `/`: landing como un solo scroll (planeta en reposo, «Zarpar» entra en `/mar`,
  «Entradas» abre el panel de Tickets). Pesa 199,3 kB gzip en su ruta crítica
  de 200 kB (`apps/web/scripts/landing-budget.mjs`): el código nuevo de la
  landing va perezoso (`lazy`), fuera de esa ruta.
- `/mar`: el mundo navegable en 3D, un solo mundo jugable (Arcilla), islas de
  eventos, Boia Fiestera, el Cañón «Que no pare la música» en beta, el circuito
  Los Rápidos, tienda de barcos, radio, Carnet, ranking y Las Calitas.
- `/carnet`, `/sello`, `/ranking`, `/legal/*` y `/admin` (en modo cuentas, Carnet
  + contraseña + TOTP; eventos, tienda, moderación, copias y «Embudo»).
- Detalle por ruta y por plan: `ESTADO.md` y la tabla de planes de
  [README.md](../README.md).

## Qué depende de Álvaro

### Antes del push del plan 032

- **Prueba de mano del mar nuevo:** el mar vivo (`LIVELY_SEA` en
  `apps/web/app/mar/engine/waves.ts`). Si algo falla, poner `LIVELY_SEA` a
  apagado. Probar también bloqueo de pantalla y cambio de app en un móvil real
  (sólo está probado en emulación).
- **Migraciones de producción** `20261015100700` (T300, premios del after) y
  `20261015101100` (T301, embudo): las aplica el orquestador antes del push;
  las dos sólo están en dev.
- **Una prueba de restauración** con una copia nocturna real (guía del T302).
- **Textos:** la privacidad («Medición de visitas: apagada en esta versión»)
  queda mal en cuanto se enciende el interruptor del embudo; el consejo del
  minimapa «mantenlo pulsado para moverlo» también está mal (mantener
  pulsado abre el mapa). Nuevo texto de los dos: decide Álvaro.
- **Premios del after** (150 puntos y 500 monedas): siguen `muestra`.

### Pendiente de Álvaro (no bloquea el push)

- **Limpieza:** las variables `NEXT_PUBLIC_POSTHOG_*` sin uso en Vercel y
  Cloudflare; y **D-04** de DECISIONES, que sigue diciendo PostHog (no se ha tocado).

Preguntas abiertas en [DECISIONES.md](DECISIONES.md), «Preguntas abiertas»
(este documento no las cierra):

- **P2** ticketera real y su cuenta; **P16** códigos de descuento reales;
  **P3** fecha del próximo All Day (el primero es BOIA Club · Halloween, 31-10-2026).
- **P14** visto bueno a `/mar` como planeta de agua y a los logros y premios.
- **P15, P17, P18, P19** enlaces reales, fotos de artistas, música con
  licencia y el cartel de BOIA Club · Halloween.
- **P21** datos legales reales y revisión de textos; **P22** lectura de textos.
- **P23–P27** (borrador de D-27): lista de emails, importes de puntos, arte del
  Carnet, qué es una temporada y el dominio definitivo.
- **P7** (Supabase de desarrollo) está hecha, pero la tabla de DECISIONES aún
  la muestra abierta. **P20** (tipografía) no tiene objeto desde el plan 019.
- **D-04** de DECISIONES dice que la analítica va con PostHog. Álvaro decidió
  el 2026-10-15 contadores propios en Supabase (plan 032 T301) y la spec ya lo
  recoge. Corregir D-04 lo decide Álvaro; no se ha tocado.
- **Seguridad:** [plans/seguridad-pendiente.md](../plans/seguridad-pendiente.md)
  tiene puntos sin marcar (copia diaria de Supabase, paneles, secretos). Se
  ofrece en cada plan nuevo hasta que estén todos.
- **Publicar y desplegar** (push, dominio, cuentas, claves) lo decide Álvaro.
- **Qué pasa cuando hay push:** cada push a `main` despliega a Cloudflare y a
  Vercel a la vez.

## Qué queda

- **Spec:** los PARCIAL son sobre todo medición en móvil físico, revisión de
  diseño o decisiones de Álvaro, no código que falte. Cada uno lleva su nota en
  [spec/estado.md](spec/estado.md).
- **Ticketera real y webhook** (REQ-COM-017, REQ-COM-018): hasta P2 hay sandbox.
- **Versión final (D-20):** editor visual del Admin y los REQ marcados «final».
- **Copias:** las herramientas de copia y restauración tienen pruebas (plan 032 T302).
- **Acuarela** sigue en el código y oculta. REQ-ENT-028 está retirado por D-26.
- **Lista de publicación:** [entrega.md](entrega.md) (REQ-PRO-020), la firma Álvaro.

## Cosas que conviene saber

- **Producción es de Álvaro.** El modo cuentas está vivo en producción desde
  el 2026-10-14 (proyecto Supabase con ref `kzxdywtysrcnqqjfhhnc`). Los agentes
  no tocan producción nunca. Las migraciones nuevas van sólo a
  `boia-planet-dev` y se listan en
  [propuestas/2026-10-03-produccion-supabase.md](propuestas/2026-10-03-produccion-supabase.md);
  el orquestador las aplica en producción antes de hacer push.
- Sin variables de Supabase la web corre en modo local; las de desarrollo están
  en `apps/web/.env.local`, fuera de git.
- `pnpm db:clean-test-users` y `pnpm test:supabase` sólo van contra
  `boia-planet-dev`, nunca contra producción.
- El build falla si la landing pasa de su presupuesto.
- Blender 5.2.2 sin interfaz genera los modelos (`tools/blender/`).
