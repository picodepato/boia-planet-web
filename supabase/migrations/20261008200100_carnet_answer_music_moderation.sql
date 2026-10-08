-- Moderación fina de un Carnet con cuentas (plan 020 T229): el Admin retira
-- una sola respuesta de un Carnet y cambia o quita el enlace a la música de
-- un Carnet de artista, sin ocultar el Carnet entero. Lo que cambia va a la
-- papelera de moderación, que lo guarda 30 días para deshacerlo.
-- Escrita y probada como texto en local, NO aplicada a ningún proyecto (la
-- aplica Hernán en boia-planet-dev, detrás de las de los planes 017–019).
-- Convenciones: las de 20261003100000_accounts.sql y
-- 20261007100200_moderation.sql. Todo pide rol admin con segundo factor
-- (aal2) y deja su fila en audit_log con el motivo.

-- ---------------------------------------------------------------------------
-- La papelera de moderación: lo retirado o cambiado, para devolverlo. Fuera
-- del alcance de los clientes (private, sin permisos); sólo la leen y la
-- tocan las RPC del Admin. Dura 30 días: cada escritura purga lo viejo.

create table private.carnet_moderation_trash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.carnets (user_id) on delete cascade,
  -- answer: una respuesta retirada; music: el enlace a la música cambiado o quitado.
  kind text not null check (kind in ('answer', 'music')),
  question_id text,
  -- Cómo estaba (a lo que vuelve) y cómo quedó.
  before jsonb not null,
  after jsonb,
  reason text,
  actor_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references auth.users (id) on delete set null,
  check ((kind = 'answer') = (question_id is not null))
);
create index carnet_moderation_trash_created_idx on private.carnet_moderation_trash (created_at desc);
alter table private.carnet_moderation_trash enable row level security;
revoke all on private.carnet_moderation_trash from public, anon, authenticated;

-- Días que la papelera de moderación guarda cada cambio (decisión 6 de plan 020).
create function private.moderation_trash_days() returns integer
language sql immutable
set search_path = ''
as $$
  select 30
$$;

-- Borra lo que pasó su plazo; devuelve cuántas filas.
create function private.purge_moderation_trash() returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  delete from private.carnet_moderation_trash t
  where t.created_at < now() - make_interval(days => private.moderation_trash_days());
  get diagnostics n = row_count;
  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lo que el Admin necesita ver de un Carnet para moderarlo fino: sus
-- respuestas (con la pregunta) y su enlace a la música.

create function private.admin_carnet_content(p_user uuid) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  c public.carnets;
begin
  perform private.require_staff('admin');
  select * into c from public.carnets where user_id = p_user;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  return jsonb_build_object(
    'user_id', c.user_id,
    'is_artist', c.is_artist,
    'music', case when c.music_url is null then null
                  else jsonb_build_object('platform', c.music_platform, 'url', c.music_url) end,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'question_id', a.question_id, 'prompt', q.prompt, 'answer', a.answer,
        'updated_at', a.updated_at) order by q.position)
      from public.carnet_answers a
      join public.carnet_questions q on q.id = a.question_id
      where a.user_id = p_user
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Retirar una respuesta: sale del Carnet (las demás y el Carnet siguen) y
-- queda en la papelera. Su dueño puede volver a responder esa pregunta.

create function private.admin_remove_carnet_answer(p_user uuid, p_question text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  a public.carnet_answers;
  trash uuid;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Retirar una respuesta pide un motivo.';
  end if;
  select * into a from public.carnet_answers
  where user_id = p_user and question_id = p_question for update;
  if not found then
    raise exception 'unknown_answer' using detail = 'Ese Carnet no tiene esa respuesta.';
  end if;
  perform private.purge_moderation_trash();
  delete from public.carnet_answers where user_id = p_user and question_id = p_question;
  insert into private.carnet_moderation_trash (user_id, kind, question_id, before, after, reason, actor_id)
  values (p_user, 'answer', p_question,
          jsonb_build_object('answer', a.answer, 'question_version', a.question_version,
                             'created_at', a.created_at),
          null, why, actor)
  returning id into trash;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'moderate_carnet:remove_answer', 'carnet_answers',
          p_user::text || '/' || p_question, why,
          jsonb_build_object('answer', a.answer), null);
  return jsonb_build_object('trash_id', trash, 'user_id', p_user, 'question_id', p_question);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cambiar o (con nulos) quitar el enlace a la música de un Carnet de
-- artista. Las mismas reglas que `set_artist_music`; pide motivo.

create function private.admin_set_carnet_music(
  p_user uuid, p_platform text, p_url text, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  url text := nullif(btrim(coalesce(p_url, '')), '');
  platform text := nullif(btrim(coalesce(p_platform, '')), '');
  c public.carnets;
  old_music jsonb;
  new_music jsonb;
  trash uuid;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Cambiar el enlace de un artista pide un motivo.';
  end if;
  select * into c from public.carnets where user_id = p_user for update;
  if not found then
    raise exception 'unknown_member' using detail = 'Esa cuenta no tiene Carnet.';
  end if;
  if not c.is_artist then
    raise exception 'artist_required' using detail = 'Sólo un Carnet de artista lleva enlace a su música.';
  end if;
  if (url is null) <> (platform is null) then
    raise exception 'invalid_music' using detail = 'Falta la plataforma o el enlace.';
  end if;
  if url is not null and (char_length(url) > 300 or not private.music_url_ok(platform, url)) then
    raise exception 'invalid_music'
      using detail = 'Un enlace https de Spotify, SoundCloud, Bandcamp o Instagram.';
  end if;
  old_music := case when c.music_url is null then null
                    else jsonb_build_object('platform', c.music_platform, 'url', c.music_url) end;
  new_music := case when url is null then null
                    else jsonb_build_object('platform', platform, 'url', url) end;
  if old_music is not distinct from new_music then
    return jsonb_build_object('trash_id', null, 'user_id', p_user, 'music', new_music);
  end if;
  perform private.purge_moderation_trash();
  update public.carnets set music_platform = platform, music_url = url where user_id = p_user;
  insert into private.carnet_moderation_trash (user_id, kind, before, after, reason, actor_id)
  values (p_user, 'music', coalesce(old_music, 'null'::jsonb), new_music, why, actor)
  returning id into trash;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'moderate_carnet:set_music', 'carnets', p_user::text, why,
          old_music, new_music);
  return jsonb_build_object('trash_id', trash, 'user_id', p_user, 'music', new_music);
end;
$$;

-- ---------------------------------------------------------------------------
-- La papelera de moderación: lo de los últimos 30 días que no se ha
-- deshecho, lo más nuevo primero.

create function private.admin_list_moderation_trash(p_limit integer) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  out jsonb;
begin
  perform private.require_staff('admin');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'user_id', t.user_id, 'nickname', c.nickname, 'kind', t.kind,
    'question_id', t.question_id, 'prompt', q.prompt, 'before', t.before, 'after', t.after,
    'reason', t.reason, 'created_at', t.created_at,
    'expires_at', t.created_at + make_interval(days => private.moderation_trash_days()))
    order by t.created_at desc), '[]'::jsonb)
  into out
  from (
    select * from private.carnet_moderation_trash x
    where x.undone_at is null
      and x.created_at >= now() - make_interval(days => private.moderation_trash_days())
    order by x.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 500)
  ) t
  join public.carnets c on c.user_id = t.user_id
  left join public.carnet_questions q on q.id = t.question_id;
  return out;
end;
$$;

-- Deshacer un cambio de la papelera: la respuesta vuelve (si su dueño no ha
-- respondido otra vez esa pregunta) o el enlace vuelve a como estaba (si
-- nadie lo ha cambiado después).

create function private.admin_undo_carnet_moderation(p_id uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  t private.carnet_moderation_trash;
  c public.carnets;
  current_music jsonb;
begin
  perform private.purge_moderation_trash();
  select * into t from private.carnet_moderation_trash where id = p_id for update;
  if not found or t.undone_at is not null then
    raise exception 'unknown_trash' using detail = 'Ese cambio no está en la papelera o ya pasó su plazo.';
  end if;
  if t.kind = 'answer' then
    if exists (select 1 from public.carnet_answers a
               where a.user_id = t.user_id and a.question_id = t.question_id) then
      raise exception 'answer_exists' using detail = 'Su dueño ya ha vuelto a responder esa pregunta.';
    end if;
    insert into public.carnet_answers (user_id, question_id, question_version, answer, created_at)
    values (t.user_id, t.question_id, (t.before ->> 'question_version')::integer,
            t.before ->> 'answer', coalesce((t.before ->> 'created_at')::timestamptz, now()));
  else
    select * into c from public.carnets where user_id = t.user_id for update;
    current_music := case when c.music_url is null then null
                          else jsonb_build_object('platform', c.music_platform, 'url', c.music_url) end;
    if current_music is distinct from t.after then
      raise exception 'music_changed' using detail = 'El enlace ha cambiado después; no se pisa.';
    end if;
    update public.carnets
    set music_platform = nullif(t.before, 'null'::jsonb) ->> 'platform',
        music_url = nullif(t.before, 'null'::jsonb) ->> 'url'
    where user_id = t.user_id;
  end if;
  update private.carnet_moderation_trash set undone_at = now(), undone_by = actor where id = t.id;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'moderate_carnet:undo_' || t.kind,
          case when t.kind = 'answer' then 'carnet_answers' else 'carnets' end,
          t.user_id::text || coalesce('/' || t.question_id, ''), why, t.after, t.before);
  return jsonb_build_object('id', t.id, 'kind', t.kind, 'user_id', t.user_id,
                            'question_id', t.question_id, 'undone', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Las públicas: envoltorios sin más.

create function public.admin_carnet_content(p_user uuid) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_carnet_content(p_user)
$$;

create function public.admin_remove_carnet_answer(
  p_user uuid, p_question text, p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_remove_carnet_answer(p_user, p_question, p_reason)
$$;

create function public.admin_set_carnet_music(
  p_user uuid, p_platform text default null, p_url text default null, p_reason text default null
) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_set_carnet_music(p_user, p_platform, p_url, p_reason)
$$;

create function public.admin_list_moderation_trash(p_limit integer default 100) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_list_moderation_trash(p_limit)
$$;

create function public.admin_undo_carnet_moderation(p_id uuid, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_undo_carnet_moderation(p_id, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: las privadas, sólo para quien tiene sesión (piden rol dentro);
-- las públicas, nunca para anon.

revoke all on function private.moderation_trash_days() from public;
revoke all on function private.purge_moderation_trash() from public;
revoke all on function private.admin_carnet_content(uuid) from public;
revoke all on function private.admin_remove_carnet_answer(uuid, text, text) from public;
revoke all on function private.admin_set_carnet_music(uuid, text, text, text) from public;
revoke all on function private.admin_list_moderation_trash(integer) from public;
revoke all on function private.admin_undo_carnet_moderation(uuid, text) from public;
grant execute on function private.moderation_trash_days() to authenticated, service_role;
grant execute on function private.purge_moderation_trash() to service_role;
grant execute on function private.admin_carnet_content(uuid) to authenticated;
grant execute on function private.admin_remove_carnet_answer(uuid, text, text) to authenticated;
grant execute on function private.admin_set_carnet_music(uuid, text, text, text) to authenticated;
grant execute on function private.admin_list_moderation_trash(integer) to authenticated;
grant execute on function private.admin_undo_carnet_moderation(uuid, text) to authenticated;

revoke all on function public.admin_carnet_content(uuid) from public, anon;
revoke all on function public.admin_remove_carnet_answer(uuid, text, text) from public, anon;
revoke all on function public.admin_set_carnet_music(uuid, text, text, text) from public, anon;
revoke all on function public.admin_list_moderation_trash(integer) from public, anon;
revoke all on function public.admin_undo_carnet_moderation(uuid, text) from public, anon;
grant execute on function public.admin_carnet_content(uuid) to authenticated;
grant execute on function public.admin_remove_carnet_answer(uuid, text, text) to authenticated;
grant execute on function public.admin_set_carnet_music(uuid, text, text, text) to authenticated;
grant execute on function public.admin_list_moderation_trash(integer) to authenticated;
grant execute on function public.admin_undo_carnet_moderation(uuid, text) to authenticated;
