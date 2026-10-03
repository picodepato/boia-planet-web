# 07 · Admin

Fuente: v14 §23, §48.4 a §48.8, §49.1, §49.2, §49.13, §49.15 y las secciones del Admin de los Prompts 1 a 3; D-02, D-10 y D-20, y el plan 008 (borrador D-27). El contenido cambiante es dato, no código (§23): una fiesta nueva se configura desde el Admin. El Admin no es una herramienta aparte: usa las mismas entidades, el mismo esquema de mundo y las mismas validaciones que la web y el motor (P3).

- **REQ-ADM-001** `L1` — Tratar como datos, nunca como código, el evento prioritario, carteles, URL de tickets, diálogos, spawn y demás contenido cambiante. *Fuente: §23, §24, §30*

## Acceso, roles y auditoría

Plan 008 (2026-10-03, borrador D-27, [`docs/propuestas/2026-10-03-d27-borrador.md`](../propuestas/2026-10-03-d27-borrador.md)): con Supabase, `/admin` se entra con el código de 6 cifras del email y después el TOTP (Supabase MFA, `aal2`; alta con QR la primera vez), sin contraseña; el rol lo da `pnpm admin:grant -- <email> <owner|admin|editor|none>` con la clave de servicio, y sin rol se ve «Sin acceso». Cuatro secciones van sobre datos reales (Fiestas y QR, Socios y emails, Moderación de botellas, Rankings), cada acción con motivo y auditoría; las demás siguen en la demo de este navegador. Sin las variables de Supabase, el «Probar admin» de siempre (REQ-ADM-039). Los códigos de respaldo del TOTP y la recuperación no están.

- **REQ-ADM-002** `L1` — Exigir a toda cuenta del Admin email, contraseña y TOTP, con códigos de respaldo entregados en privado y recuperación por correo verificado que no salta roles ni permite apropiarse de cuentas. *Fuente: §49.13, P2, D-10*
- **REQ-ADM-003** `L1` — Inicializar al propietario con un mecanismo de un solo uso: contraseña temporal aleatoria de al menos 20 caracteres generada al desplegar, entregada una vez a Álvaro por canal privado y cambiada en el primer acceso; ninguna contraseña en código, repositorio ni documentos. *Fuente: §49.13, P1, P2, D-10*
- **REQ-ADM-004** `L1` — Implementar los roles propietario (gestiona permisos e integraciones), administrador (no transfiere la propiedad) y editor (edita borradores, no publica), con una cuenta por persona y protección del último propietario. *Fuente: §49.13, P1, P2, D-02*
- **REQ-ADM-005** `L2` — Añadir los roles moderador (modera, no altera saldos) y artista (sólo edita su ficha) [provisional]. *Fuente: P1, P2*
- **REQ-ADM-006** `L1` — Aplicar los permisos en rutas, servicios y base de datos, de modo que ningún miembro se eleve a administrador manipulando una petición. *Fuente: P2, D-04*
- **REQ-ADM-007** `L1` — Auditar login administrativo, cambios de rol, publicaciones, correcciones de progreso, acciones masivas, moderación, promociones, compras, sellos e integraciones. *Fuente: P1, P2*
- **REQ-ADM-008** `L1` — Ofrecer en L1 las secciones Página principal, Eventos, Mundo, Artistas, Fotos y vídeos, Logros y cosméticos (con precios de cosméticos y umbrales de rango), Moderación, Textos y música, Temporadas (sólo la activa), Usuarios de administración e Integraciones, y dejar para L2 Resumen, Tienda, Promociones y QR, Perfiles y Carnets, Encuestas, Mensajes y Revisión [provisional]. *Fuente: P2, D-02*
- **REQ-ADM-039** `L1` — En la versión de prueba, abrir el Admin con un botón «Probar admin» en el pie de la landing y en el menú, sin login, con un aviso permanente de que es una demo y de que los cambios se quedan en este navegador; cada cambio pasa por el repositorio local (REQ-ARQ-025), queda en una auditoría local y se puede volver a los datos de muestra. Es una excepción temporal a REQ-ADM-002 a REQ-ADM-004 que no se publica (REQ-PRO-020). *Fuente: D-20*

## Editor del mundo

- **REQ-ADM-009** `L1` — Ofrecer, con la opción «Editar mundo», un editor visual isométrico con lienzo, biblioteca de assets, inspector, capas, selección, mover, escalar, rotar, orientaciones compatibles, activar o desactivar, eliminar, ajuste opcional a rejilla, deshacer y rehacer, donde también se fijan el spawn y la orientación inicial del barco. *Fuente: §23.1, P1, P2*
- **REQ-ADM-010** `L1` — Crear un objeto sin código en 10 pasos: añadir, elegir categoría (aporta valores por defecto, no fija la lógica), elegir asset, colocarlo, definir radio, hitbox, zona y punto seguro, añadir comportamientos, editar parámetros, asociar contenido, evento, logro, recompensa o destino, previsualizar y guardar o publicar. *Fuente: §23.2, §48.4*
- **REQ-ADM-011** `L1` — Guardar y duplicar objetos como plantillas («Obstáculo lento», «Boia de diálogo», «Isla de evento», «Cofre», «Boost») que conservan comportamientos y parámetros. *Fuente: §48.7*
- **REQ-ADM-012** `L1` — Validar formato, extensión, peso y dimensiones de cada asset antes de publicarlo, guardar el original y crear variantes optimizadas. *Fuente: §48.8, P2*
- **REQ-ADM-013** `L1` — Limitar los parámetros a rangos seguros y advertir cuando una hitbox, radio u objeto queda fuera del mar o de la zona válida. *Fuente: §48.8*
- **REQ-ADM-014** `L1` — Bloquear la publicación si una isla cierra la navegación, un teletransporte cae en tierra, una misión no tiene destino, un circuito no tiene rutas válidas o una referencia eliminada rompe home, mapa, evento o logro, y comprobar textos esenciales, tickets y destinos. *Fuente: §49.7, P1, P2*

## Publicación y revisiones

- **REQ-ADM-015** `L1` — Guardar como borrador versionado, previsualizar con el motor real en privado sin conceder puntos, publicar botellas ni cobrar, y publicar home, eventos y mundo como una revisión inmutable que cambia la versión activa de forma atómica. *Fuente: §23.4, §48.8, P2*
- **REQ-ADM-016** `L1` — Restaurar una revisión anterior sin revertir compras, saldos ni transacciones y sin reponer perfiles, botellas o mensajes retirados. *Fuente: §48.8, P2, P3*

## Página principal, eventos y contenidos

- **REQ-ADM-017** `L1` — Editar en Página principal hero, titular, subtítulo, CTA Explorar y CTA Tickets; añadir, ocultar, ordenar y programar bloques; elegir el evento prioritario y excluir eventos; configurar fotos, artistas, filosofía, tienda y contacto, y previsualizar en móvil y escritorio, todo con formularios y selectores sin HTML libre. *Fuente: §49.3, P1, P2*
- **REQ-ADM-018** `L1` — Crear, duplicar, editar, publicar, finalizar, cancelar, posponer y archivar eventos. *Fuente: P2*
- **REQ-ADM-019** `L1` — Gestionar artistas, fotos y álbumes, y los textos de la web y del mundo. *Fuente: §31.2, P2, D-02*
- **REQ-ADM-020** `L1` — Gestionar la música de ambiente y los efectos de sonido con su licencia u origen [provisional] [pendiente Álvaro]. *Fuente: §34, P2, P3*

## Logros

Publicar un logro nuevo para todos desde su publicación es L1; evaluar hechos anteriores (retroactivo) y conceder en masa son L2 (D-02).

- **REQ-ADM-021** `L1` — Crear, duplicar, activar, desactivar y versionar logros con una condición legible del catálogo de triggers (visitar isla, encontrar boia, recoger X objetos, completar circuito, tiempo jugado, comprar entrada, rescatar o entregar personaje), ámbito, puntos, monedas, icono, secreto o visible y fechas, sin constructor de lógica arbitraria. *Fuente: §23.3, §49.1, P2*
- **REQ-ADM-022** `L1` — Crear una versión o un logro nuevo en vez de cambiar la condición de un logro ya obtenido, y hacer que desactivar sólo evite nuevas concesiones. *Fuente: P2*
- **REQ-ADM-023** `L2` — Marcar un logro global como retroactivo para que una tarea segura evalúe hechos históricos compatibles y lo conceda una sola vez. *Fuente: §49.1, P2, D-02*
- **REQ-ADM-024** `L2` — Conceder un logro a todas las cuentas o a un segmento con vista previa de afectados, premio y política para cuentas futuras, motivo, proceso por lotes idempotente con progreso y errores, y compensación auditada en vez de borrar historial. *Fuente: §49.1, P1, P2, D-02*

## Carnets y perfiles

- **REQ-ADM-025** `L2` — Buscar por apodo, email privado autorizado, rol, tipo, estado, rango y fecha, y editar cualquier Carnet (identidad pública, imagen, biografía autorizada, visibilidad, respuestas, sellos, logros, puntos, monedas, barco y cosméticos), en lote sólo para cambios reversibles, con motivo en las correcciones sensibles e historial de valor anterior, nuevo, autor y fecha, sin ver ni tocar contraseñas, sesiones ni factores [provisional]. *Fuente: §49.2, P1, P2*
- **REQ-ADM-026** `L2` — Crear perfiles oficiales sin cuenta (miembro, artista, colaborador o editorial) asociables a eventos y reclamables con una invitación de un solo uso que detecta duplicados, pide confirmación del equipo si ya existe un perfil parecido y no concede permisos no aprobados. *Fuente: §49.2, P2, D-02*

## Moderación, borrado y datos personales

- **REQ-ADM-027** `L1` — Moderar botellas: revisar reportes, retirar y propagar la retirada. *Fuente: §17, §23.2, D-02*
- **REQ-ADM-028** `L1` — Retirar a mano, con auditoría, recompensas o récords implausibles. *Fuente: D-09*
- **REQ-ADM-040** `L1` — Moderar Carnets: un botón «Reportar» en cada Carnet público y, en Moderación, la lista de Carnets reportados con el motivo, desde la que se oculta una respuesta o la foto, o se restablece el apodo, con auditoría y sin borrar el Carnet. *Fuente: §23.2, §49.2, D-23*
- **REQ-ADM-029** `L1` — Avisar del impacto en mapa, eventos, misiones, logros y mensajes antes de editar o borrar un objeto referenciado; antes de borrar, mostrar el elemento y sus relaciones y exigir una segunda confirmación inequívoca como escribir el nombre; en operaciones masivas, mostrar número, campos que cambian y una muestra. *Fuente: §49.13, P2*
- **REQ-ADM-030** `L1` — Usar archivo o papelera recuperable como acción habitual, con plazo configurable [pendiente Álvaro] y auditoría, y exigir reautenticación para una purga irreversible. *Fuente: §49.13, P2*
- **REQ-ADM-031** `L1` — Atender a mano, con un procedimiento documentado, las peticiones de descarga o eliminación de cuenta y de retirada de contenido público [provisional]. *Fuente: §49.13, D-02*

## Temporadas

- **REQ-ADM-032** `L1` — Tratar cada mundo como una temporada (D-20) y mantener un único mundo activo, con ID y versión, que agrupa las skins publicadas sobre el mapa compartido, el destino de la misión y el ranking de temporada, sin recolocar lugares: el spawn y el puerto son los únicos del mapa compartido (`mapa:salida`, `mapa:puerto`, REQ-MUN-035); el mundo activo es el que ve por defecto quien llega, el visitante puede cambiar de mundo desde el menú (REQ-MUN-037) y crear otra temporada es duplicarla (REQ-ADM-033). *Fuente: §21, §23.4, §49.7, P1, D-02, D-20, D-23*
- **REQ-ADM-033** `L2` — Duplicar una temporada como borrador sin cuentas, ventas, mensajes ni recompensas; cambiar spawn, evento prioritario, destinos, eventos, diálogos y logros; probarla, publicarla y restaurarla. *Fuente: §23.4, P2, D-02*

Qué se conserva entre temporadas está en REQ-ARQ-008.

## Módulos de L2

- **REQ-ADM-034** `L2` — Gestionar encuestas (preguntas, opciones, texto libre limitado, fechas, audiencia, evento, recompensa opcional), con resultados agregados, exportación autorizada con contacto separado de opinión y versión nueva si cambian preguntas ya respondidas. *Fuente: §49.8*
- **REQ-ADM-035** `L2` — Gestionar Mensajes de BOIA (título, cuerpo, imagen, enlace o acción, prioridad, audiencia con todos por defecto, publicación y caducidad) con borrador, vista previa, programación, retirada, archivo, contenido saneado sin scripts y destinos validados. *Fuente: §49.9*
- **REQ-ADM-036** `L2` — Configurar cada minijuego (activación, acceso, textos, assets, sonidos, dificultad, objetivos, velocidad, tiempo, errores, munición, recarga, radio, recompensas, límites y temporada) con duplicado, previsualización, validación, publicación atómica y restauración, congelando los valores de las partidas iniciadas. *Fuente: §49.11, P2, P3*
- **REQ-ADM-037** `L2` — Ajustar desde el Admin los valores del registro contextual [provisional]. *Fuente: §49.10*

## Usabilidad del Admin

- **REQ-ADM-038** `L1` — Comprobar que una persona que no escribió el código crea un evento, añade o reutiliza su isla, revisa la home y publica en 10 minutos tras una explicación breve, y corregir las fricciones importantes que se registren. *Fuente: P3*

## Criterios de cierre de §49.15

La v14 agrupa en §49.15 los criterios verificables de cierre. Cada uno está en el REQ que lo cumple:

| §49.15 | REQ |
|---|---|
| Accesos: localización correcta, panel sin conducir, barco se queda | REQ-ENT-034, REQ-ENT-038, REQ-ENT-039 |
| Eventos: finalizar, agotado, reutilizar isla, prioridad y misión | REQ-COM-005 a REQ-COM-007, REQ-COM-002, REQ-AVE-010 |
| Comunidad: encuestas, mensajes, recordatorios de registro | REQ-IDE-046, REQ-IDE-048, REQ-IDE-008 |
| Progresión: monedas y rango, progreso local alterado, fusión doble | REQ-IDE-027, REQ-IDE-005, REQ-IDE-006 |
| Minijuegos validados por servidor | REQ-AVE-038 |
| Admin: logros, perfiles, Carnets, doble factor, doble confirmación, archivo | REQ-ADM-021 a REQ-ADM-026, REQ-ADM-002, REQ-ADM-029, REQ-ADM-030 |
| Rutas de 1 y 10 minutos medidas en móvil | REQ-MUN-017 |
| Estado por requisito con evidencia | REQ-PRO-017 |
