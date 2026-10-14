-- Carnet BOIA: preguntas por público (plan 030 T294, decisión de Álvaro del
-- 2026-10-14). Detrás de 20261014100300_home_block_carnet.sql.
--
-- Los ARTISTAS (Carnet creado con el enlace de artistas: carnets.is_artist)
-- conservan las 5 preguntas de T281 tal cual. El resto del público cambia la
-- primera (`momento-quiero-estar`) por `dia-siguiente`, «Completa la frase:
-- al día siguiente de una fiesta yo…» (texto exacto, aprobado; no es
-- muestra). Las preguntas 2–5 son de todos.
--
-- - Columna `audience`: 'all' | 'artist' | 'public'. La posición deja de ser
--   única en toda la tabla: es única dentro de cada público (artista y
--   público comparten la 1).
-- - Un miembro sólo escribe (crea o cambia) respuestas a preguntas activas
--   de su público (amplía la regla de 20261014100110). Borrar la propia
--   sigue permitido.
-- - No se borra ninguna respuesta: quien no es artista y ya contestó
--   `momento-quiero-estar` la conserva guardada (la ve sólo la moderación
--   del Admin, como las retiradas). Si un miembro pasa a ser artista, ve las
--   de artista desde entonces (se decide por carnets.is_artist al leer).
-- Reejecutable.

-- 1. El público de cada pregunta (las que ya había, de todos).
alter table public.carnet_questions
  add column if not exists audience text not null default 'all';

alter table public.carnet_questions
  drop constraint if exists carnet_questions_audience_check;
alter table public.carnet_questions
  add constraint carnet_questions_audience_check
  check (audience in ('all', 'artist', 'public'));

-- 2. La posición, única dentro de cada público.
alter table public.carnet_questions
  drop constraint if exists carnet_questions_position_key;
create unique index if not exists carnet_questions_audience_position_key
  on public.carnet_questions (audience, position);

-- 3. La primera de T281 queda para artistas; la nueva, para el público.
update public.carnet_questions
   set audience = 'artist'
 where id = 'momento-quiero-estar' and audience <> 'artist';

insert into public.carnet_questions (id, position, prompt, audience) values
  ('dia-siguiente', 1, 'Completa la frase: al día siguiente de una fiesta yo…', 'public')
on conflict (id) do update
  set position = excluded.position, prompt = excluded.prompt,
      audience = excluded.audience, is_active = true;

-- 4. Sólo se contestan las activas del propio público. El público sale del
--    propio Carnet (su dueño siempre lo lee, aunque esté oculto); sin
--    Carnet, el del público.
drop policy if exists carnet_answers_insert_own on public.carnet_answers;
create policy carnet_answers_insert_own on public.carnet_answers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and exists (
      select 1 from public.carnet_questions q
      where q.id = carnet_answers.question_id
        and q.is_active
        and (q.audience = 'all'
             or q.audience = case
               when coalesce((select c.is_artist from public.carnets c
                              where c.user_id = (select auth.uid())), false)
               then 'artist' else 'public' end)
    )
  );

drop policy if exists carnet_answers_update_own on public.carnet_answers;
create policy carnet_answers_update_own on public.carnet_answers
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.carnet_questions q
      where q.id = carnet_answers.question_id
        and q.is_active
        and (q.audience = 'all'
             or q.audience = case
               when coalesce((select c.is_artist from public.carnets c
                              where c.user_id = (select auth.uid())), false)
               then 'artist' else 'public' end)
    )
  )
  with check (user_id = (select auth.uid()));
