# Plan de seguridad pendiente (lo hace Álvaro en los paneles)

Status: pending — offer it to Álvaro every time a new plan starts, until every item is ticked.
Created: 2026-10-12

Cosas que no se pueden automatizar desde el repo porque piden entrar en un
panel, crear un secreto o decidir algo con dinero. Salieron de la revisión de
«qué puede fallar» del 2026-10-12 (plan 027). Marcá cada una con `[x]` cuando
esté hecha (o pedíselo al orquestador).

## Urgente

- [ ] **Copia de seguridad diaria de Supabase.** El workflow
      `supabase-backup` falla todas las noches desde al menos el 2026-10-11:
      no hay ninguna copia. GitHub → Settings → Secrets and variables →
      Actions → Secrets: `SUPABASE_DB_URL` (la misma línea del Session pooler
      que está en `apps/web/.env.local`) y `BACKUP_PASSPHRASE` (frase larga
      inventada; guardala fuera del ordenador: sin ella la copia no se abre).
      Después Actions → supabase-backup → Run workflow y comprobar que sale
      verde. Guía: `docs/propuestas/2026-10-08-backups.md`.

## Cuentas

- [ ] **Verificación en dos pasos** en: el Gmail personal (dueño de
      Porkbun y Cloudflare), Porkbun, Cloudflare, GitHub (`picodepato`),
      Supabase, Vercel y Brevo. Es lo que más protege de perder el dominio.
- [ ] **Supabase:** confirmar que `admin@boiaplanet.net` es **Owner** (no
      sólo miembro) en Organization settings → Team.
- [ ] **Porkbun:** la tarjeta del auto-renew no caduca antes de 2027-10-12.

## Encender las cuentas (Carnet con email y código)

- [ ] Cuando se decida encenderlas, la lista paso a paso (proyecto de
      producción, SMTP de Brevo, plantillas, límites, URLs, migraciones,
      política y las dos variables en Cloudflare y Vercel):
      [`docs/propuestas/2026-10-03-produccion-supabase.md`](../docs/propuestas/2026-10-03-produccion-supabase.md).

## Avisos

- [ ] **Cloudflare → Notifications → Add:** avisos de builds fallidos de
      Workers y, si aparece, de uso de Workers cerca del límite gratuito
      (100.000 peticiones al día).

## Con secreto nuevo (decide Álvaro)

- [ ] **Uso mensual automático de la clave SMTP de Brevo** (si pasa 90 días
      sin usarse, Gmail deja de poder enviar desde `hola@`). Hace falta poner
      la clave SMTP como secreto en GitHub; con eso, una tarea de un plan
      añade un workflow que manda un correo de prueba al mes. Mientras no
      esté, el plan 028 abre un recordatorio mensual.

## Correo

- [ ] **SPF combinado** (Cloudflare + Brevo) si los correos de `hola@`
      empiezan a caer en spam: registro en `docs/DESPLIEGUE.md` §6.

## Limpieza local

- [ ] Borrar `apps/web/.env.local.dev-viejo` (claves viejas de Supabase en el
      disco) cuando se confirme que no hace falta.
- [ ] Borrar a mano las dos carpetas que quedaron en `.claude/worktrees/`
      (`agent-a51d5f12c87f2006d`, `agent-aabe6eccf48621f68`, …): Windows no
      dejó quitarlas; sus ramas ya no existen.
