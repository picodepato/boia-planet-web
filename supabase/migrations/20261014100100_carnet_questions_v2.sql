-- Carnet BOIA: nuevas preguntas públicas (decisión de Álvaro, 2026-10-14;
-- sustituye a v14 §44.1 en D-08, REQ-IDE-014). La quinta (`buena-fiesta`) no
-- cambia. Las cuatro anteriores se retiran (is_active = false) y NUNCA se
-- borran, ni ellas ni las respuestas guardadas en `carnet_answers`: la FK
-- sigue valiendo y el Admin (moderación, papelera, exportación) las sigue
-- viendo. Dejan de enseñarse en el Carnet y en el Carnet público.
-- Reejecutable.

-- 1. Retirar las cuatro antiguas y apartarlas de las posiciones 1..4 (la
--    posición es única); pasan a 11..14.
update public.carnet_questions
   set is_active = false,
       position = case id
         when 'cosa-mas-rara' then 11
         when 'descubrimiento' then 12
         when 'obra' then 13
         when 'mejor-recuerdo' then 14
       end
 where id in ('cosa-mas-rara', 'descubrimiento', 'obra', 'mejor-recuerdo');

-- 2. Las cuatro nuevas, en las posiciones 1..4.
insert into public.carnet_questions (id, position, prompt) values
  ('momento-quiero-estar', 1, '¿Qué momento te hizo pensar «yo quiero estar en esto»?'),
  ('cancion-en-repeat', 2, '¿Cuál es la canción que tienes en repeat ahora mismo?'),
  ('creando-tramando', 3, '¿Qué estás creando o tramando estos días?'),
  ('disco-entero', 4, '¿Qué disco escucharías de principio a fin sin saltarte ninguna?')
on conflict (id) do update
  set position = excluded.position, prompt = excluded.prompt, is_active = true;
