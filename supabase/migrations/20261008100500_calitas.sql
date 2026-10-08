-- Las Calitas (plan 019 T222, decisión 16): la isla de los comentarios.
-- Escrita y probada como texto en local, NO aplicada a ningún proyecto (la
-- aplica Hernán en boia-planet-dev).
--
-- La gente escribe comentarios, responde (un nivel) y vota (arriba o abajo,
-- uno por persona y comentario). Leer es de todos (también sin cuenta);
-- escribir y votar piden cuenta con Carnet. El texto pasa un filtro de
-- insultos en la base aunque el cliente ya lo filtre
-- (`private.comment_text_problem`: el de las botellas más una lista propia,
-- letras repetidas y palabras deletreadas; la copia del navegador es
-- packages/store/src/comment-text.ts). El Admin (rol admin con segundo
-- factor) oculta y devuelve comentarios con motivo, y queda en audit_log.
-- Convenciones: las de 20261003100000_accounts.sql.

-- ---------------------------------------------------------------------------
-- El filtro de insultos de los comentarios

create table private.comment_blocked_words (
  word text primary key check (word ~ '^[a-z]+( [a-z]+)*$'),
  created_at timestamptz not null default now()
);
alter table private.comment_blocked_words enable row level security;
revoke all on private.comment_blocked_words from public, anon, authenticated;

insert into private.comment_blocked_words (word) values
  ('mamon'), ('mamona'), ('mamones'), ('cretino'), ('cretina'), ('tarado'), ('tarada'),
  ('soplapollas'), ('comemierda'), ('malnacido'), ('malnacida'), ('putero'), ('zorron'),
  ('cerdo asqueroso'), ('cerda asquerosa'), ('muerete'), ('basura humana'), ('escoria')
on conflict do nothing;
-- Se guardan sin tildes ni eñes, como private.blocked_words.

-- Las letras seguidas iguales, en una («putaaa» → «puta»).
create function private.squeeze_letters(p text) returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '([a-z])\1+', '\1', 'g')
$$;

-- Las letras sueltas separadas por espacios o signos, juntas («p.u.t.a» → «puta»).
create function private.join_spelled(p text) returns text
language sql immutable
set search_path = ''
as $$
  select regexp_replace(coalesce(p, ''), '\m([a-z])[^a-z0-9_]+(?=[a-z]\M)', '\1', 'g')
$$;

-- Qué tiene de prohibido un comentario: lo de text_problem ('link',
-- 'email', 'phone', 'offensive') y, después, los insultos de las dos
-- listas deletreados o con letras repetidas; null si nada.
create function private.comment_text_problem(p text) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  base text := private.text_problem(p);
  spelled text;
  squeezed text;
begin
  if base is not null then
    return base;
  end if;
  spelled := private.join_spelled(translate(private.fold_text(coalesce(p, '')), '013457$', 'oieasts'));
  squeezed := private.squeeze_letters(spelled);
  if exists (
    select 1 from (
      select word from private.blocked_words
      union
      select word from private.comment_blocked_words
    ) b
    where spelled ~ ('\m' || replace(b.word, ' ', '[[:space:]]+') || '\M')
       or squeezed ~ ('\m' || replace(private.squeeze_letters(b.word), ' ', '[[:space:]]+') || '\M')
  ) then
    return 'offensive';
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Comentarios y votos

create table public.calitas_comments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Una respuesta lleva su comentario; las respuestas no se responden.
  parent_id uuid references public.calitas_comments (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now(),
  -- Oculto por el Admin (con su motivo): no se lee salvo su autor y el equipo.
  hidden_at timestamptz,
  hidden_by uuid references auth.users (id) on delete set null,
  hidden_reason text
);
create index calitas_comments_recent_idx on public.calitas_comments (created_at desc)
  where hidden_at is null and parent_id is null;
create index calitas_comments_parent_idx on public.calitas_comments (parent_id);
create index calitas_comments_user_idx on public.calitas_comments (user_id, created_at desc);

create table public.calitas_votes (
  comment_id uuid not null references public.calitas_comments (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index calitas_votes_user_idx on public.calitas_votes (user_id);

-- El filtro vale para cualquier escritura del texto, también las del equipo.
create function private.calitas_text_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if tg_op = 'INSERT' or new.body is distinct from old.body then
    problem := private.comment_text_problem(new.body);
    if problem is not null then
      raise exception 'text_%', problem using detail = 'El comentario no pasa el filtro.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.calitas_text_guard() from public;

create trigger calitas_comments_text_guard before insert or update of body
  on public.calitas_comments
  for each row execute function private.calitas_text_guard();

-- Se leen los visibles (y los propios y, para el equipo, todos); nadie
-- escribe a mano: comentar, votar y moderar van por las RPC de abajo.
alter table public.calitas_comments enable row level security;
alter table public.calitas_votes enable row level security;
revoke all on public.calitas_comments from anon, authenticated, service_role;
revoke all on public.calitas_votes from anon, authenticated, service_role;
grant select on public.calitas_comments to anon, authenticated;
grant select on public.calitas_votes to authenticated;
grant select, insert, update, delete on public.calitas_comments to service_role;
grant select, insert, update, delete on public.calitas_votes to service_role;
create policy calitas_comments_read on public.calitas_comments
  for select to anon, authenticated
  using (hidden_at is null
         or user_id = (select auth.uid())
         or (select private.has_staff_role('admin')));
create policy calitas_votes_read on public.calitas_votes
  for select to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Leer: los últimos comentarios visibles (hasta 100) con sus respuestas
-- visibles, el apodo del autor, la puntuación y el voto de quien lee.

create function private.calitas_json(c public.calitas_comments, p_viewer uuid) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id,
    'parent_id', c.parent_id,
    'body', c.body,
    'author_nickname', (select k.nickname from public.carnets k where k.user_id = c.user_id),
    'is_mine', coalesce(c.user_id = p_viewer, false),
    'score', coalesce((select sum(v.value) from public.calitas_votes v where v.comment_id = c.id), 0),
    'my_vote', coalesce((select v.value from public.calitas_votes v
                         where v.comment_id = c.id and v.user_id = p_viewer), 0),
    'created_at', c.created_at,
    'hidden_at', c.hidden_at,
    'hidden_reason', c.hidden_reason)
$$;

create function private.calitas_list(p_viewer uuid, p_limit integer) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with tops as (
    select c from public.calitas_comments c
    where c.parent_id is null and c.hidden_at is null
    order by c.created_at desc, c.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ), picked as (
    select t.c from tops t
    union all
    select r from public.calitas_comments r
    join tops t on (t.c).id = r.parent_id
    where r.hidden_at is null
  )
  select coalesce(jsonb_agg(private.calitas_json(x.c, p_viewer) - 'hidden_at' - 'hidden_reason'
                            order by (x.c).created_at, (x.c).id), '[]'::jsonb)
  from picked x
$$;

-- ---------------------------------------------------------------------------
-- Comentar (o responder): cuenta con Carnet, el filtro, y un límite de
-- 5 cada 10 minutos y 30 al día por cuenta.

create function private.calitas_post(p_user uuid, p_body text, p_parent uuid) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg text := btrim(coalesce(p_body, ''));
  parent public.calitas_comments;
  c public.calitas_comments;
  problem text;
begin
  if not exists (select 1 from public.carnets where user_id = p_user) then
    raise exception 'carnet_required' using detail = 'Comentar pide tener Carnet.';
  end if;
  if char_length(msg) not between 1 and 280 then
    raise exception 'invalid_message' using detail = 'El comentario tiene de 1 a 280 caracteres.';
  end if;
  problem := private.comment_text_problem(msg);
  if problem is not null then
    raise exception 'text_%', problem using detail = 'El comentario no pasa el filtro.';
  end if;
  if p_parent is not null then
    select * into parent from public.calitas_comments
    where id = p_parent and hidden_at is null and parent_id is null;
    if not found then
      raise exception 'unknown_comment' using detail = 'Ese comentario ya no está.';
    end if;
  end if;
  perform private.lock_account(p_user);
  if (select count(*) from public.calitas_comments
      where user_id = p_user and created_at > now() - interval '10 minutes') >= 5 then
    raise exception 'limit_action' using detail = 'Cinco comentarios cada diez minutos como mucho.';
  end if;
  if (select count(*) from public.calitas_comments
      where user_id = p_user and created_at >= private.madrid_day_start(now())) >= 30 then
    raise exception 'limit_daily' using detail = 'Treinta comentarios al día como mucho.';
  end if;
  insert into public.calitas_comments (user_id, parent_id, body)
  values (p_user, p_parent, msg)
  returning * into c;
  return private.calitas_json(c, p_user) - 'hidden_at' - 'hidden_reason';
end;
$$;

-- Votar: 1 (arriba), -1 (abajo) o 0 (quitar el voto). Un voto por persona y
-- comentario; el propio no se vota.
create function private.calitas_vote(p_user uuid, p_comment uuid, p_value integer) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.calitas_comments;
begin
  if p_value is null or p_value not in (-1, 0, 1) then
    raise exception 'invalid_input' using detail = 'El voto es 1, -1 o 0.';
  end if;
  if not exists (select 1 from public.carnets where user_id = p_user) then
    raise exception 'carnet_required' using detail = 'Votar pide tener Carnet.';
  end if;
  select * into c from public.calitas_comments where id = p_comment and hidden_at is null;
  if not found then
    raise exception 'unknown_comment' using detail = 'Ese comentario ya no está.';
  end if;
  if c.user_id = p_user then
    raise exception 'own_comment' using detail = 'Tu propio comentario no se vota.';
  end if;
  if p_value = 0 then
    delete from public.calitas_votes where comment_id = c.id and user_id = p_user;
  else
    insert into public.calitas_votes (comment_id, user_id, value)
    values (c.id, p_user, p_value)
    on conflict (comment_id, user_id) do update set value = excluded.value, created_at = now();
  end if;
  return private.calitas_json(c, p_user) - 'hidden_at' - 'hidden_reason';
end;
$$;

-- ---------------------------------------------------------------------------
-- El Admin: todos los comentarios (también los ocultos) y ocultar o
-- devolver uno. Ocultar pide motivo; las respuestas de un comentario oculto
-- dejan de leerse con él.

create function private.admin_calitas_list(p_limit integer) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
begin
  return (
    select coalesce(jsonb_agg(private.calitas_json(x.c, actor)
                              order by (x.c).created_at desc, (x.c).id), '[]'::jsonb)
    from (select c from public.calitas_comments c
          order by c.created_at desc, c.id
          limit least(greatest(coalesce(p_limit, 200), 1), 500)) x
  );
end;
$$;

create function private.admin_moderate_comment(p_comment uuid, p_action text, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  c public.calitas_comments;
  after public.calitas_comments;
begin
  if p_action is null or p_action not in ('hide', 'show') then
    raise exception 'invalid_action' using detail = format('Acción desconocida: %s', p_action);
  end if;
  if p_action = 'hide' and char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Ocultar un comentario pide un motivo.';
  end if;
  select * into c from public.calitas_comments where id = p_comment for update;
  if not found then
    raise exception 'unknown_comment' using detail = 'Ese comentario no existe.';
  end if;
  update public.calitas_comments
  set hidden_at = case when p_action = 'hide' then coalesce(c.hidden_at, now()) end,
      hidden_by = case when p_action = 'hide' then actor end,
      hidden_reason = case when p_action = 'hide' then why end
  where id = c.id
  returning * into after;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (actor, 'authenticated', 'moderate_comment:' || p_action, 'calitas_comments', c.id::text,
          nullif(why, ''),
          jsonb_build_object('hidden', c.hidden_at is not null, 'body', c.body),
          jsonb_build_object('hidden', after.hidden_at is not null));
  return private.calitas_json(after, actor);
end;
$$;

-- ---------------------------------------------------------------------------
-- Las RPC públicas: envolturas SECURITY INVOKER que llaman a las privadas.

create function public.calitas_list(p_limit integer default 50) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.calitas_list((select auth.uid()), p_limit)
$$;

create function public.calitas_post(p_body text, p_parent uuid default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.calitas_post(private.require_member(), p_body, p_parent)
$$;

create function public.calitas_vote(p_comment uuid, p_value integer) returns jsonb
language sql
set search_path = ''
as $$
  select private.calitas_vote(private.require_member(), p_comment, p_value)
$$;

create function public.admin_calitas_list(p_limit integer default 200) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_calitas_list(p_limit)
$$;

create function public.admin_moderate_comment(p_comment uuid, p_action text, p_reason text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_moderate_comment(p_comment, p_action, p_reason)
$$;

-- ---------------------------------------------------------------------------
-- Permisos

revoke all on function private.squeeze_letters(text) from public;
revoke all on function private.join_spelled(text) from public;
revoke all on function private.comment_text_problem(text) from public;
revoke all on function private.calitas_json(public.calitas_comments, uuid) from public;
revoke all on function private.calitas_list(uuid, integer) from public;
revoke all on function private.calitas_post(uuid, text, uuid) from public;
revoke all on function private.calitas_vote(uuid, uuid, integer) from public;
revoke all on function private.admin_calitas_list(integer) from public;
revoke all on function private.admin_moderate_comment(uuid, text, text) from public;

grant execute on function private.calitas_list(uuid, integer) to anon, authenticated;
grant execute on function private.calitas_post(uuid, text, uuid) to authenticated;
grant execute on function private.calitas_vote(uuid, uuid, integer) to authenticated;
grant execute on function private.admin_calitas_list(integer) to authenticated;
grant execute on function private.admin_moderate_comment(uuid, text, text) to authenticated;

revoke all on function public.calitas_list(integer) from public;
revoke all on function public.calitas_post(text, uuid) from public, anon;
revoke all on function public.calitas_vote(uuid, integer) from public, anon;
revoke all on function public.admin_calitas_list(integer) from public, anon;
revoke all on function public.admin_moderate_comment(uuid, text, text) from public, anon;
grant execute on function public.calitas_list(integer) to anon, authenticated;
grant execute on function public.calitas_post(text, uuid) to authenticated;
grant execute on function public.calitas_vote(uuid, integer) to authenticated;
grant execute on function public.admin_calitas_list(integer) to authenticated;
grant execute on function public.admin_moderate_comment(uuid, text, text) to authenticated;
