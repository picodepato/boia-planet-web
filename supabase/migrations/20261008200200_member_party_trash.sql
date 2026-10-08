-- Papelera de 30 días para los datos reales (plan 020 T230, decisión 6):
-- borrar un socio o una fiesta desde el Admin con cuentas ya no es
-- definitivo. Lo borrado deja de verse en todas partes, la papelera del
-- Admin lo lista y lo devuelve, y a los 30 días se purga.
-- Escrita y probada como texto en local, NO aplicada a ningún proyecto (la
-- aplica Hernán en boia-planet-dev, detrás de las de los planes 017–019 y de
-- 20261008200100). Convenciones: las de 20261003100000_accounts.sql. Todo
-- lo del Admin pide rol admin con segundo factor (aal2) y deja su fila en
-- audit_log con el motivo.
--
-- Un socio borrado:
--   - su Carnet (con sus respuestas y lo de su moderación) sale de
--     public.carnets y se guarda entero en public.member_trash. Todo lo que
--     lee el Carnet (perfil público, rankings, botellas, artistas, la puerta)
--     deja de verlo sin tocar cada lectura;
--   - su cuenta queda bloqueada (auth.users.banned_until) y sin sesiones:
--     no entra; y `is_member()` le dice que no aunque le quede un token;
--   - sale de «Socios y emails» y del CSV de noticias, y sus botellas,
--     comentarios de Las Calitas y tiempos dejan de leerse;
--   - devolverlo lo pone todo como estaba (si su apodo o su número no se los
--     ha quedado otra persona entretanto).
-- Una fiesta borrada:
--   - queda marcada (deleted_at) y archivada (archived_at): la web, el mapa,
--     el sello del QR y la puerta ya no la ven, y el equipo tampoco fuera de
--     la papelera;
--   - devolverla le quita las dos marcas (el archivo, sólo si lo puso el
--     borrado).
-- La purga (cada día, desde el flujo de copias, después de la copia; y
-- también al borrar o devolver algo y con «Purgar lo caducado» del Admin):
--   - un socio con más de 30 días en la papelera se borra de verdad
--     (`private.delete_account`, en cascada todo lo suyo);
--   - una fiesta con más de 30 días se borra de verdad si nadie la tiene en
--     su historial (compras, sellos, libro de puntos); si alguien la tiene,
--     se queda borrada (oculta) para siempre: el libro es de sólo altas y los
--     sellos son de sus dueños.
-- El plan gratuito de Supabase no garantiza pg_cron: la purga diaria la
-- lanza el flujo de GitHub `supabase-backup` con `select
-- public.purge_expired_trash()`.

-- ---------------------------------------------------------------------------
-- Plazo: el mismo de la papelera de moderación (20261008200100).

create function private.trash_days() returns integer
language sql stable
set search_path = ''
as $$
  select private.moderation_trash_days()
$$;

-- ---------------------------------------------------------------------------
-- Socios en la papelera. Sólo la leen las RPC del Admin y service_role
-- (las pruebas la usan para adelantar el reloj); ningún cliente.

create table public.member_trash (
  user_id uuid primary key references auth.users (id) on delete cascade,
  deleted_at timestamptz not null default now(),
  deleted_by uuid references auth.users (id) on delete set null,
  reason text not null check (char_length(reason) between 3 and 500),
  -- La fila de public.carnets tal cual (null: no tenía Carnet).
  carnet jsonb check (carnet is null or jsonb_typeof(carnet) = 'object'),
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  -- private.carnet_moderation y private.carnet_moderation_trash (T229).
  moderation jsonb check (moderation is null or jsonb_typeof(moderation) = 'object'),
  moderation_trash jsonb not null default '[]'::jsonb
    check (jsonb_typeof(moderation_trash) = 'array'),
  -- El bloqueo que tenía la cuenta antes del borrado (vuelve al devolverla).
  banned_until_before timestamptz
);
create index member_trash_deleted_idx on public.member_trash (deleted_at);

alter table public.member_trash enable row level security;
revoke all on public.member_trash from anon, authenticated, service_role;
grant select, update, delete on public.member_trash to service_role;

-- ¿Está esta cuenta en la papelera? (para la RLS y is_member).
create function private.account_in_trash(p_user uuid) returns boolean
language sql stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists (select 1 from public.member_trash t where t.user_id = p_user)
$$;

-- Una cuenta en la papelera no es miembro aunque le quede un token vivo:
-- todas las RPC de socio (require_member) la rechazan.
create or replace function private.is_member() returns boolean
language sql stable
set search_path = ''
as $$
  select (select auth.uid()) is not null
     and coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) = false
     and not private.account_in_trash((select auth.uid()))
$$;

-- Lo suyo que se lee directamente de una tabla tampoco se ve.
drop policy bottles_read_active on public.bottles;
create policy bottles_read_active on public.bottles
  for select to anon, authenticated
  using (status = 'active' and not private.account_in_trash(user_id));

drop policy race_times_read on public.race_times;
create policy race_times_read on public.race_times
  for select to anon, authenticated
  using ((voided_at is null and not private.account_in_trash(user_id))
         or user_id = (select auth.uid()));

drop policy canon_scores_read on public.canon_scores;
create policy canon_scores_read on public.canon_scores
  for select to anon, authenticated
  using ((voided_at is null and not private.account_in_trash(user_id))
         or user_id = (select auth.uid()));

drop policy castle_scores_read on public.castle_scores;
create policy castle_scores_read on public.castle_scores
  for select to anon, authenticated
  using ((voided_at is null and not private.account_in_trash(user_id))
         or user_id = (select auth.uid()));

-- Las Calitas: los comentarios de quien no tiene Carnet (está en la
-- papelera: comentar pide Carnet) no salen. Igual que la de
-- 20261008100500_calitas.sql con ese filtro.
create or replace function private.calitas_list(p_viewer uuid, p_limit integer) returns jsonb
language sql stable
security definer
set search_path = ''
as $$
  with tops as (
    select c from public.calitas_comments c
    where c.parent_id is null and c.hidden_at is null
      and not private.account_in_trash(c.user_id)
    order by c.created_at desc, c.id
    limit least(greatest(coalesce(p_limit, 50), 1), 100)
  ), picked as (
    select t.c from tops t
    union all
    select r from public.calitas_comments r
    join tops t on (t.c).id = r.parent_id
    where r.hidden_at is null and not private.account_in_trash(r.user_id)
  )
  select coalesce(jsonb_agg(private.calitas_json(x.c, p_viewer) - 'hidden_at' - 'hidden_reason'
                            order by (x.c).created_at, (x.c).id), '[]'::jsonb)
  from picked x
$$;

-- ---------------------------------------------------------------------------
-- Fiestas borradas: marca, quién y por qué. Ningún cliente las escribe.

alter table public.events
  add column deleted_at timestamptz,
  add column deleted_by uuid references auth.users (id) on delete set null,
  add column delete_reason text check (delete_reason is null or char_length(delete_reason) <= 500);
create index events_deleted_idx on public.events (deleted_at) where deleted_at is not null;

drop policy events_read_public on public.events;
create policy events_read_public on public.events
  for select to anon, authenticated
  using (published_at is not null and state <> 'draft' and archived_at is null
         and deleted_at is null);

-- El equipo tampoco la ve ni la edita fuera de la papelera (las listas del
-- Admin, la puerta).
drop policy events_read_staff on public.events;
create policy events_read_staff on public.events
  for select to authenticated
  using ((select private.has_staff_role('editor')) and deleted_at is null);

drop policy events_update_staff on public.events;
create policy events_update_staff on public.events
  for update to authenticated
  using ((select private.has_staff_role('editor')) and deleted_at is null)
  with check ((select private.has_staff_role('editor')));

-- ---------------------------------------------------------------------------
-- Purga: lo que pasó su plazo se borra de verdad. Devuelve cuánto.

create function private.purge_expired_trash() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  cutoff timestamptz := now() - make_interval(days => private.trash_days());
  m record;
  n_members integer := 0;
  n_events integer := 0;
  n_kept integer := 0;
  n_moderation integer;
begin
  for m in
    select t.user_id from public.member_trash t where t.deleted_at < cutoff order by t.deleted_at
  loop
    perform private.delete_account(m.user_id, null, 'papelera: plazo cumplido');
    n_members := n_members + 1;
  end loop;

  perform set_config('boia.audit_reason', 'papelera: plazo cumplido', true);
  with gone as (
    delete from public.events e
    where e.deleted_at < cutoff
      and not exists (select 1 from public.purchases p where p.event_id = e.id)
      and not exists (select 1 from public.stamps s where s.event_id = e.id)
      and not exists (select 1 from public.ledger_transactions l where l.event_id = e.id)
    returning e.id
  )
  select count(*) into n_events from gone;
  perform set_config('boia.audit_reason', '', true);
  select count(*) into n_kept from public.events e where e.deleted_at < cutoff;

  n_moderation := private.purge_moderation_trash();
  return jsonb_build_object('members', n_members, 'events', n_events, 'events_kept', n_kept,
                            'moderation', n_moderation);
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrar un socio: a la papelera (antes se borraba la cuenta en el acto).
-- La misma firma y las mismas reglas: motivo y nunca una cuenta del equipo.

create or replace function private.admin_delete_member(p_user uuid, p_reason text) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  c public.carnets;
  banned timestamptz;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Borrar una cuenta pide un motivo.';
  end if;
  if exists (select 1 from public.staff_roles where user_id = p_user) then
    raise exception 'forbidden' using errcode = '42501',
      detail = 'Una cuenta del equipo no se borra desde aquí.';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user)
     or private.account_in_trash(p_user) then
    raise exception 'unknown_member' using detail = 'Esa cuenta no existe o ya está en la papelera.';
  end if;
  perform private.purge_expired_trash();
  perform private.lock_account(p_user);

  select * into c from public.carnets where user_id = p_user for update;
  select u.banned_until into banned from auth.users u where u.id = p_user;
  insert into public.member_trash
    (user_id, deleted_by, reason, carnet, answers, moderation, moderation_trash, banned_until_before)
  values (
    p_user, actor, left(why, 500),
    case when c.user_id is null then null else to_jsonb(c) end,
    coalesce((select jsonb_agg(to_jsonb(a) order by a.question_id)
              from public.carnet_answers a where a.user_id = p_user), '[]'::jsonb),
    (select to_jsonb(m) from private.carnet_moderation m where m.user_id = p_user),
    coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at)
              from private.carnet_moderation_trash x where x.user_id = p_user), '[]'::jsonb),
    banned
  );
  -- Sin Carnet (en cascada sus respuestas y lo de su moderación, guardados arriba).
  delete from public.carnets where user_id = p_user;
  -- Sin entrar: bloqueada 100 años (como `ban_duration` de Supabase Auth) y sin sesiones.
  update auth.users set banned_until = now() + interval '100 years' where id = p_user;
  if to_regclass('auth.sessions') is not null then
    execute 'delete from auth.sessions where user_id = $1' using p_user;
  end if;
  if to_regclass('auth.refresh_tokens') is not null then
    execute 'delete from auth.refresh_tokens where user_id = $1' using p_user::text;
  end if;

  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value)
  values (actor, 'authenticated', 'trash_member', 'account', p_user::text, why,
          case when c.user_id is null then null
               else jsonb_build_object('nickname', c.nickname, 'member_number', c.member_number) end);
end;
$$;

-- Devolver un socio de la papelera: su Carnet, sus respuestas, lo de su
-- moderación y su acceso, como estaban.
create function private.admin_restore_member(p_user uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  t public.member_trash;
  cname text;
begin
  perform private.purge_expired_trash();
  select * into t from public.member_trash where user_id = p_user for update;
  if not found then
    raise exception 'unknown_trash' using detail = 'Esa cuenta no está en la papelera o ya pasó su plazo.';
  end if;
  if t.carnet is not null then
    begin
      insert into public.carnets
      select * from jsonb_populate_record(null::public.carnets, t.carnet);
    exception when unique_violation then
      get stacked diagnostics cname = constraint_name;
      if cname = 'carnets_member_number_key' then
        raise exception 'number_taken' using detail = 'Su número de socio ya es de otra persona.';
      end if;
      raise exception 'nickname_taken' using detail = 'Su apodo ya es de otra persona.';
    end;
    insert into public.carnet_answers
    select * from jsonb_populate_recordset(null::public.carnet_answers, t.answers);
    if t.moderation is not null then
      insert into private.carnet_moderation
      select * from jsonb_populate_record(null::private.carnet_moderation, t.moderation);
    end if;
    -- Quien moderó puede ya no existir: su id vuelve como null (on delete set null).
    insert into private.carnet_moderation_trash
      (id, user_id, kind, question_id, before, after, reason, actor_id, created_at, undone_at, undone_by)
    select r.id, r.user_id, r.kind, r.question_id, r.before, r.after, r.reason,
           (select u.id from auth.users u where u.id = r.actor_id), r.created_at, r.undone_at,
           (select u.id from auth.users u where u.id = r.undone_by)
    from jsonb_populate_recordset(null::private.carnet_moderation_trash, t.moderation_trash) r;
  end if;
  update auth.users set banned_until = t.banned_until_before where id = p_user;
  delete from public.member_trash where user_id = p_user;
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, new_value)
  values (actor, 'authenticated', 'restore_member', 'account', p_user::text, why,
          case when t.carnet is null then null
               else jsonb_build_object('nickname', t.carnet ->> 'nickname',
                                       'member_number', (t.carnet ->> 'member_number')::bigint) end);
  return jsonb_build_object('user_id', p_user, 'restored', true,
                            'nickname', t.carnet ->> 'nickname');
end;
$$;

-- «Socios y emails» y el CSV de noticias, sin los de la papelera. Igual que
-- la de 20261003100000_accounts.sql con ese filtro.
create or replace function private.admin_list_members(
  p_search text, p_news_only boolean, p_limit integer, p_offset integer
) returns table (
  user_id uuid,
  email text,
  nickname text,
  member_number bigint,
  member_since timestamptz,
  signed_up_at timestamptz,
  is_artist boolean,
  news boolean,
  news_at timestamptz,
  news_version text,
  privacy_version text,
  privacy_at timestamptz,
  total bigint
)
language plpgsql stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_staff('admin');
  return query
  with m as (
    select u.id as user_id, u.email::text as email, c.nickname, c.member_number, c.member_since,
           u.created_at as signed_up_at, coalesce(c.is_artist, false) as is_artist,
           n.granted as news, n.created_at as news_at, n.policy_version as news_version,
           p.policy_version as privacy_version, p.created_at as privacy_at
    from auth.users u
    left join public.carnets c on c.user_id = u.id
    left join lateral (select * from private.current_consent(u.id, 'news')) n on true
    left join lateral (select * from private.current_consent(u.id, 'privacy')) p on true
    where coalesce(u.is_anonymous, false) = false
      and not exists (select 1 from public.member_trash t where t.user_id = u.id)
  ), f as (
    select * from m
    where (not coalesce(p_news_only, false) or m.news is true)
      and (p_search is null or btrim(p_search) = ''
           or m.email ilike '%' || btrim(p_search) || '%'
           or m.nickname ilike '%' || btrim(p_search) || '%')
  )
  select f.user_id, f.email, f.nickname, f.member_number, f.member_since, f.signed_up_at,
         f.is_artist, coalesce(f.news, false), f.news_at, f.news_version, f.privacy_version,
         f.privacy_at, count(*) over ()
  from f
  order by f.signed_up_at, f.user_id
  limit least(greatest(coalesce(p_limit, 100), 1), 1000)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

-- ---------------------------------------------------------------------------
-- Borrar y devolver una fiesta.

create function private.admin_delete_event(p_event text, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  why text := btrim(coalesce(p_reason, ''));
  ev public.events;
begin
  if char_length(why) < 3 then
    raise exception 'reason_required' using detail = 'Borrar una fiesta pide un motivo.';
  end if;
  select * into ev from public.events where slug = p_event and deleted_at is null for update;
  if not found then
    raise exception 'unknown_event' using detail = format('Fiesta desconocida: %s', p_event);
  end if;
  perform private.purge_expired_trash();
  perform set_config('boia.audit_reason', 'papelera: ' || left(why, 480), true);
  -- now() es el mismo en toda la transacción: archived_at = deleted_at dice
  -- que el archivo lo puso el borrado.
  update public.events
  set deleted_at = now(), deleted_by = actor, delete_reason = left(why, 500),
      archived_at = coalesce(archived_at, now())
  where id = ev.id;
  perform set_config('boia.audit_reason', '', true);
  return jsonb_build_object('id', ev.id, 'slug', ev.slug, 'deleted', true);
end;
$$;

create function private.admin_restore_event(p_id uuid, p_reason text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  why text := nullif(btrim(coalesce(p_reason, '')), '');
  ev public.events;
begin
  perform private.require_staff('admin');
  perform private.purge_expired_trash();
  select * into ev from public.events where id = p_id and deleted_at is not null for update;
  if not found then
    raise exception 'unknown_trash' using detail = 'Esa fiesta no está en la papelera.';
  end if;
  perform set_config('boia.audit_reason', coalesce('papelera: devuelta · ' || why, 'papelera: devuelta'), true);
  update public.events
  set archived_at = case when archived_at = deleted_at then null else archived_at end,
      deleted_at = null, deleted_by = null, delete_reason = null
  where id = ev.id;
  perform set_config('boia.audit_reason', '', true);
  return jsonb_build_object('id', ev.id, 'slug', ev.slug, 'restored', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- La papelera del Admin: socios y fiestas borrados, lo más nuevo primero,
-- con la fecha en que se purgan.

create function private.admin_list_trash(p_limit integer) returns jsonb
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  lim integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  n_days integer := private.trash_days();
  members jsonb;
  parties jsonb;
begin
  perform private.require_staff('admin');
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', x.user_id, 'email', x.email, 'nickname', x.carnet ->> 'nickname',
    'member_number', (x.carnet ->> 'member_number')::bigint,
    'reason', x.reason, 'deleted_at', x.deleted_at,
    'expires_at', x.deleted_at + make_interval(days => n_days))
    order by x.deleted_at desc), '[]'::jsonb)
  into members
  from (
    select t.*, u.email::text as email
    from public.member_trash t
    join auth.users u on u.id = t.user_id
    order by t.deleted_at desc
    limit lim
  ) x;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', e.id, 'slug', e.slug, 'title', e.title, 'starts_at', e.starts_at,
    'reason', e.delete_reason, 'deleted_at', e.deleted_at,
    'expires_at', e.deleted_at + make_interval(days => n_days),
    'kept', e.has_history)
    order by e.deleted_at desc), '[]'::jsonb)
  into parties
  from (
    select ev.*,
           (exists (select 1 from public.purchases p where p.event_id = ev.id)
            or exists (select 1 from public.stamps s where s.event_id = ev.id)
            or exists (select 1 from public.ledger_transactions l where l.event_id = ev.id))
             as has_history
    from public.events ev
    where ev.deleted_at is not null
    order by ev.deleted_at desc
    limit lim
  ) e;

  return jsonb_build_object('days', n_days, 'members', members, 'events', parties);
end;
$$;

create function private.admin_purge_expired_trash() returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('admin');
  return private.purge_expired_trash();
end;
$$;

-- ---------------------------------------------------------------------------
-- Las públicas: envoltorios sin más.

create function public.admin_restore_member(p_user uuid, p_reason text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_restore_member(p_user, p_reason)
$$;

create function public.admin_delete_event(p_event text, p_reason text) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_delete_event(p_event, p_reason)
$$;

create function public.admin_restore_event(p_id uuid, p_reason text default null) returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_restore_event(p_id, p_reason)
$$;

create function public.admin_list_trash(p_limit integer default 100) returns jsonb
language sql stable
set search_path = ''
as $$
  select private.admin_list_trash(p_limit)
$$;

create function public.admin_purge_expired_trash() returns jsonb
language sql
set search_path = ''
as $$
  select private.admin_purge_expired_trash()
$$;

-- La purga diaria (el flujo de copias, con la conexión de la base) o
-- service_role. Ningún cliente.
create function public.purge_expired_trash() returns jsonb
language sql
set search_path = ''
as $$
  select private.purge_expired_trash()
$$;

-- ---------------------------------------------------------------------------
-- Permisos: las privadas, sólo para quien tiene sesión (piden rol dentro);
-- las públicas del Admin, nunca para anon; la purga, sólo service_role.

revoke all on function private.trash_days() from public;
revoke all on function private.account_in_trash(uuid) from public;
revoke all on function private.purge_expired_trash() from public;
revoke all on function private.admin_restore_member(uuid, text) from public;
revoke all on function private.admin_delete_event(text, text) from public;
revoke all on function private.admin_restore_event(uuid, text) from public;
revoke all on function private.admin_list_trash(integer) from public;
revoke all on function private.admin_purge_expired_trash() from public;
-- is_member se sustituye: conserva sus permisos; su ayuda, los mismos.
grant execute on function private.account_in_trash(uuid) to anon, authenticated, service_role;
grant execute on function private.trash_days() to authenticated, service_role;
grant execute on function private.purge_expired_trash() to service_role;
grant execute on function private.admin_restore_member(uuid, text) to authenticated;
grant execute on function private.admin_delete_event(text, text) to authenticated;
grant execute on function private.admin_restore_event(uuid, text) to authenticated;
grant execute on function private.admin_list_trash(integer) to authenticated;
grant execute on function private.admin_purge_expired_trash() to authenticated;

revoke all on function public.admin_restore_member(uuid, text) from public, anon;
revoke all on function public.admin_delete_event(text, text) from public, anon;
revoke all on function public.admin_restore_event(uuid, text) from public, anon;
revoke all on function public.admin_list_trash(integer) from public, anon;
revoke all on function public.admin_purge_expired_trash() from public, anon;
revoke all on function public.purge_expired_trash() from public, anon, authenticated;
grant execute on function public.admin_restore_member(uuid, text) to authenticated;
grant execute on function public.admin_delete_event(text, text) to authenticated;
grant execute on function public.admin_restore_event(uuid, text) to authenticated;
grant execute on function public.admin_list_trash(integer) to authenticated;
grant execute on function public.admin_purge_expired_trash() to authenticated;
grant execute on function public.purge_expired_trash() to service_role;
