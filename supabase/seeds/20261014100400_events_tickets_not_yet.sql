-- Muestra (plan 030 T292): ALL DAY BOIA y BOIA Nochevieja, «Tickets todavía
-- no disponibles», como en el contenido de la web
-- (packages/store/src/sample/content.ts). Sólo las filas de muestra.
-- Reejecutable.
update public.events
   set tickets_not_yet = true
 where slug in ('sonido-2026', 'nochevieja-2026')
   and is_sample
   and not tickets_not_yet;
