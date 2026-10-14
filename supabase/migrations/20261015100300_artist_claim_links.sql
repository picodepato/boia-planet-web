-- El enlace personal para reclamar una ficha de artista (plan 031 T296, la
-- vía 1). Detrás de 20261015100200_artist_profile_join.sql. Aplicada sólo a
-- boia-planet-dev; producción la recibe con las demás del plan
-- (docs/propuestas/2026-10-03-produccion-supabase.md).
--
-- - El Admin crea, para una ficha SIN reclamar, un código de un solo uso
--   (`admin_create_artist_claim_link`). El código se devuelve una vez; sólo
--   se guarda su hash (SHA-256, `private.artist_code_hash`), con la ficha, su
--   nombre (para la página del enlace: el nombre es contenido público) y la
--   fecha. Un código nuevo para la misma ficha sustituye al anterior (una
--   fila por ficha). Caduca a los 30 días.
-- - `/artista/reclamar/<código>` pregunta `artist_claim_info(p_code)` (también
--   sin cuenta: sólo dice si vale y de qué ficha es; un código equivocado,
--   gastado o caducado da lo mismo: no vale).
-- - Con el Carnet creado (o al entrar con uno que ya existe), el navegador
--   llama a `claim_artist_profile(p_code)`: el servidor comprueba el código,
--   une el Carnet de la sesión a la ficha (`private.join_artist_profile`, la
--   unión de T295: marca artista y deja auditoría `claim_link`) y gasta el
--   código.
-- - `admin_artist_claim_links()`: el Admin ve, por ficha, cuándo se creó el
--   último enlace, cuándo caduca y si se gastó (nunca el código).
-- Reejecutable.

-- ---------------------------------------------------------------------------
-- La tabla (una fila por ficha; nadie de fuera la lee)

create table if not exists private.artist_claim_links (
  profile_id text primary key
    check (profile_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(profile_id) <= 120),
  profile_name text not null check (char_length(profile_name) between 1 and 120),
  code_hash text not null unique check (code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  created_by uuid,
  spent_at timestamptz,
  spent_by uuid
);
revoke all on private.artist_claim_links from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- El Admin crea el enlace de una ficha

create or replace function private.admin_create_artist_claim_link(
  p_profile text, p_name text, p_reason text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_staff('admin');
  profile text := btrim(coalesce(p_profile, ''));
  pname text := btrim(coalesce(p_name, ''));
  code text := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  before private.artist_claim_links;
  res private.artist_claim_links;
begin
  if profile !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(profile) > 120 then
    raise exception 'invalid_profile' using detail = 'Esa ficha de artista no existe.';
  end if;
  if char_length(pname) not between 1 and 120 then
    raise exception 'invalid_profile' using detail = 'La ficha necesita su nombre.';
  end if;
  if exists (select 1 from public.carnets c where c.artist_profile_id = profile) then
    raise exception 'profile_claimed' using detail = 'Esa ficha ya es de un Carnet.';
  end if;
  select * into before from private.artist_claim_links where profile_id = profile for update;
  insert into private.artist_claim_links as l
    (profile_id, profile_name, code_hash, created_at, expires_at, created_by, spent_at, spent_by)
  values (profile, pname, private.artist_code_hash(code), now(), now() + interval '30 days', actor, null, null)
  on conflict (profile_id) do update
    set profile_name = excluded.profile_name, code_hash = excluded.code_hash,
        created_at = excluded.created_at, expires_at = excluded.expires_at,
        created_by = excluded.created_by, spent_at = null, spent_by = null
  returning * into res;
  -- La auditoría nunca guarda el código.
  insert into public.audit_log (actor_id, actor_role, action, entity_type, entity_id, reason, old_value, new_value)
  values (
    actor, 'authenticated', 'create_artist_claim_link', 'artist_claim_links', profile, p_reason,
    case when before.profile_id is null then null
         else jsonb_build_object('created_at', before.created_at, 'spent_at', before.spent_at) end,
    jsonb_build_object('created_at', res.created_at, 'expires_at', res.expires_at)
  );
  return jsonb_build_object(
    'code', code, 'profile_id', profile, 'created_at', res.created_at, 'expires_at', res.expires_at
  );
end;
$$;

-- Por ficha: el último enlace (sin el código).
create or replace function private.admin_artist_claim_links()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_staff('admin');
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'profile_id', l.profile_id, 'created_at', l.created_at,
      'expires_at', l.expires_at, 'spent_at', l.spent_at
    ) order by l.profile_id)
    from private.artist_claim_links l
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- La página del enlace: ¿vale este código? ¿de qué ficha es?

create or replace function private.artist_claim_info(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select jsonb_build_object('valid', true, 'profile_id', l.profile_id, 'profile_name', l.profile_name)
     from private.artist_claim_links l
     where btrim(coalesce(p_code, '')) <> ''
       and l.code_hash = private.artist_code_hash(p_code)
       and l.spent_at is null
       and l.expires_at > now()
       and not exists (select 1 from public.carnets c where c.artist_profile_id = l.profile_id)),
    jsonb_build_object('valid', false)
  )
$$;

-- ---------------------------------------------------------------------------
-- Reclamar: el Carnet de la sesión se une a la ficha y el código se gasta

-- La cuenta sale de la sesión (`private.require_member`), nunca de un parámetro.
create or replace function private.claim_artist_profile(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  p_user uuid := private.require_member();
  link private.artist_claim_links;
  res jsonb;
begin
  select * into link from private.artist_claim_links l
  where btrim(coalesce(p_code, '')) <> ''
    and l.code_hash = private.artist_code_hash(p_code)
  for update;
  if not found or link.spent_at is not null or link.expires_at <= now() then
    raise exception 'claim_invalid'
      using detail = 'Este enlace no vale: puede que ya se usara, que caducara o que haya otro más nuevo.';
  end if;
  res := private.join_artist_profile(p_user, link.profile_id, p_user, 'claim_link', 'enlace para reclamar');
  update private.artist_claim_links
  set spent_at = now(), spent_by = p_user
  where profile_id = link.profile_id;
  return res || jsonb_build_object('profile_name', link.profile_name);
end;
$$;

create or replace function public.admin_create_artist_claim_link(
  p_profile text, p_name text, p_reason text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.admin_create_artist_claim_link(p_profile, p_name, p_reason)
$$;

create or replace function public.admin_artist_claim_links()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_artist_claim_links()
$$;

create or replace function public.artist_claim_info(p_code text)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.artist_claim_info(p_code)
$$;

create or replace function public.claim_artist_profile(p_code text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.claim_artist_profile(p_code)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: crear y listar, sólo authenticated (el rol lo comprueba la
-- privada, con segundo factor); reclamar, quien tiene sesión; la información
-- del enlace, también sin cuenta (sólo dice si vale y el nombre de la ficha).

revoke all on function private.admin_create_artist_claim_link(text, text, text) from public, anon, authenticated;
revoke all on function private.admin_artist_claim_links() from public, anon, authenticated;
revoke all on function private.artist_claim_info(text) from public, anon, authenticated;
revoke all on function private.claim_artist_profile(text) from public, anon, authenticated;
grant execute on function private.admin_create_artist_claim_link(text, text, text) to authenticated;
grant execute on function private.admin_artist_claim_links() to authenticated;
grant execute on function private.artist_claim_info(text) to anon, authenticated;
grant execute on function private.claim_artist_profile(text) to authenticated;

revoke all on function public.admin_create_artist_claim_link(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_artist_claim_links() from public, anon, authenticated;
revoke all on function public.artist_claim_info(text) from public, anon, authenticated;
revoke all on function public.claim_artist_profile(text) from public, anon, authenticated;
grant execute on function public.admin_create_artist_claim_link(text, text, text) to authenticated;
grant execute on function public.admin_artist_claim_links() to authenticated;
grant execute on function public.artist_claim_info(text) to anon, authenticated;
grant execute on function public.claim_artist_profile(text) to authenticated;
