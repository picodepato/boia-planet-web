-- Carnet BOIA: un miembro sólo contesta (o cambia) preguntas activas
-- (T281, auditoría). Las retiradas el 2026-10-14 conservan sus respuestas
-- (ni se borran ni se tocan aquí), pero ya no se pueden escribir: ni crear
-- una respuesta nueva ni editar la que había. Borrar la propia sigue
-- permitido (es suya). Las funciones del Admin (security definer:
-- deshacer una retirada de moderación, papelera de miembros) no pasan por
-- estas políticas y pueden devolver respuestas a preguntas retiradas.
-- Reejecutable.

drop policy if exists carnet_answers_insert_own on public.carnet_answers;
create policy carnet_answers_insert_own on public.carnet_answers
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select private.is_member())
    and exists (select 1 from public.carnet_questions q
                where q.id = carnet_answers.question_id and q.is_active)
  );

drop policy if exists carnet_answers_update_own on public.carnet_answers;
create policy carnet_answers_update_own on public.carnet_answers
  for update to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.carnet_questions q
                where q.id = carnet_answers.question_id and q.is_active)
  )
  with check (user_id = (select auth.uid()));
