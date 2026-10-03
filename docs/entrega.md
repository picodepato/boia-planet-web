# Lista de entrega (REQ-ARQ-024)

Lo que pide REQ-ARQ-024 para entregar BOIA.PLANET y dónde está cada cosa. Es
la entrega de la **versión de prueba** (D-20): todo en el navegador, contenido
`muestra`. La publicación de verdad es otra lista, la de REQ-PRO-020, que
firma Álvaro. Estado a 2026-09-30 (T49), al día con el plan 008 (cuentas con
Supabase, T95, 2026-10-03): el despliegue sigue en modo local y las cuentas
están listas para un proyecto de producción
([lista](propuestas/2026-10-03-produccion-supabase.md)).

| # | Elemento | Dónde | Estado |
|---:|---|---|---|
| 1 | Repositorio exportable | Este repo (`git clone`; monorepo pnpm, sin submódulos ni binarios fuera de `art/`) | ✅ |
| 2 | URL pública | https://boia-planet-roan.vercel.app (producción en Vercel, **temporal hasta el dominio definitivo**; `README.md`, «Desplegar la versión de prueba») | ✅ versión de prueba; el dominio de BOIA llega con la versión final (REQ-ARQ-022) |
| 3 | URL del Admin | `<URL pública>/admin` («Probar admin» en el pie) | ✅ sin login en modo local (D-20); con Supabase, código del email + TOTP y rol dado con `pnpm admin:grant` (plan 008) |
| 4 | Manual para BOIA | [manual-alvaro.md](manual-alvaro.md) (uso del Admin, en llano) y [manual-admin.md](manual-admin.md) (publicar, papelera, peticiones de datos) | ✅ |
| 5 | Manual técnico | [README.md](../README.md) (arrancar, probar, desplegar, «Cuentas con Supabase»), [CLAUDE.md](../CLAUDE.md), [spec/00-indice.md](spec/00-indice.md), [DECISIONES.md](DECISIONES.md) | ✅ |
| 6 | Catálogo de comportamientos | `packages/world/src/behaviors.ts` (con sus pruebas) y [spec/03-mundo-y-motor.md](spec/03-mundo-y-motor.md) | ✅ |
| 7 | Catálogo de recursos | `art/**/manifest.json`, validados por `python3 tools/blender/check.py` (corre con `pnpm test`, REQ-MUN-031); [mundos/README.md](../mundos/README.md) | ✅ |
| 8 | Plantillas | Lugares por mundo en `tools/blender/lugares.json` y `packages/world/src/worlds/*`; plantillas en el Admin (REQ-ADM-011) | ⏳ las del Admin llegan con el editor visual (versión final) |
| 9 | Migraciones | `supabase/migrations/*.sql` (14), aplicadas con `pnpm db:migrate:dev`; la muestra en `supabase/seeds/` y quitarla con `supabase/sample/remove-sample.sql` | ✅ aplicadas al proyecto de desarrollo `boia-planet-dev`; sin aplicar a un proyecto de producción |
| 10 | Variables de ejemplo | [.env.example](../.env.example) (ninguna es obligatoria; las cuatro de Supabase activan las cuentas) | ✅ |
| 11 | Integraciones | Admin → «Integraciones» (sólo lectura). Ticketera: sandbox; correo: Supabase Auth con SMTP propio (Gmail en desarrollo); analítica: PostHog apagado sin clave; datos: navegador en modo local, Supabase en modo cuentas | ✅ documentadas; en producción ninguna activada |
| 12 | Procedimiento de recuperación | Versión de prueba: «Volver todo a la muestra» en el Admin y borrar los datos del sitio en el navegador. Copias y restauración con Supabase: versión final (REQ-ARQ-023) | ⏳ |
| 13 | Resultados de pruebas | `pnpm test && pnpm typecheck && pnpm lint && pnpm build` y `pnpm e2e` (exit code y conteo en cada encargo, `ESTADO.md` y `docs/informes/`); estado por requisito en [spec/estado.md](spec/estado.md) (`python3 tools/spec/estado.py`) | ✅ |
| 14 | Matriz de dispositivos y accesibilidad | [matriz-dispositivos.md](matriz-dispositivos.md) (16 casos de REQ-ARQ-016, registro de REQ-ARQ-017) | ⏳ 4 casos a mano pendientes |
| 15 | Contenido provisional (`muestra`) | Todos los textos: [propuestas/textos-zonas.md](propuestas/textos-zonas.md) (P22); legales con datos **inventados** (P21); eventos, artistas y fotos de muestra salvo «BOIA Club · Halloween»; enlaces, fotos de artistas y carteles: qué entregar, formato y dónde va cada uno en [contenido-real.md](contenido-real.md) (todo en `packages/store/src/sample/real-content.ts`; los enlaces de prueba salen marcados «muestra»); logros en [propuestas/logros-catalogo.md](propuestas/logros-catalogo.md); preguntas abiertas en [DECISIONES.md](DECISIONES.md) | ⏳ pendiente de Álvaro |
| 16 | Integraciones no activadas | En producción: Supabase (datos compartidos, cuentas, RLS), acceso por correo y login del Admin con TOTP, construidos y probados en desarrollo (plan 008; lista de producción); ticketera real con webhook, PostHog, editor visual, dominio y cuentas de BOIA (inventario v14 §4) | ⏳ versión final |

## Antes de enseñar un despliegue

- [ ] `pnpm test && pnpm typecheck && pnpm lint && pnpm build` salen con 0 sin
      variables de entorno.
- [ ] `E2E_PORT=<libre> pnpm e2e --workers=2` sale con 0.
- [ ] `python3 tools/spec/estado.py` sale con 0 (ningún REQ «HECHO» sin prueba).
- [ ] Con cuentas (las variables de Supabase puestas): `pnpm test:supabase` y
      `E2E_SUPABASE=1 E2E_PORT=<libre> pnpm e2e <specs de cuentas> --workers=1`
      salen con 0 contra `boia-planet-dev`, y después `pnpm db:clean-test-users`
      dice que quedan 0 cuentas `@example.test`.
- [ ] Las cabeceras de seguridad llegan (`curl -I <URL>` enseña
      `content-security-policy`, REQ-ARQ-012).
- [ ] Las páginas legales llevan arriba el aviso de datos inventados.
- [ ] El recorrido del móvil de la «Guía de la demo» (`ESTADO.md`, plan 002
      T30) pasa en un móvil físico y se apunta en
      [matriz-dispositivos.md](matriz-dispositivos.md).

## Antes de publicar de verdad (no es esta entrega)

La lista de REQ-PRO-020, firmada por Álvaro: datos legales reales con
revisión profesional (P21), textos aprobados (P22), cuentas de producción de
BOIA (REQ-PRO-021), Supabase de producción y copias probadas (REQ-ARQ-002,
REQ-ARQ-023; [lista de producción](propuestas/2026-10-03-produccion-supabase.md)),
ticketera elegida (D-06) y 0 elementos `muestra` en el contenido público
(REQ-PRO-018).
