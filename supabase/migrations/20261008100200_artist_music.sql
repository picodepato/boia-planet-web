-- El enlace a la música de un Carnet de artista (plan 019 T217, decisión 10).
-- Escrita y probada como texto en local, NO aplicada a ningún proyecto (la
-- aplica Hernán en boia-planet-dev).
--
-- Cada artista pone, al crear su Carnet con el enlace de artistas, un enlace
-- a su música: Spotify, SoundCloud, Bandcamp o, en su defecto, Instagram.
-- Se guarda en su Carnet (público, como el resto del Carnet) y la lista de
-- /artistas lo enseña como botón. Sólo un Carnet de artista lo guarda: el
-- de un socio se rechaza (`artist_required`). Nada se carga de esas
-- plataformas: es un enlace sin más.

-- ---------------------------------------------------------------------------
-- Las columnas: las dos o ninguna; https de la plataforma que dicen.

alter table public.carnets
  add column music_platform text
    check (music_platform in ('spotify', 'soundcloud', 'bandcamp', 'instagram')),
  add column music_url text check (char_length(music_url) <= 300);

alter table public.carnets add constraint carnets_music_pair_check check (
  (music_platform is null) = (music_url is null)
);

-- ¿Es `p_url` un enlace https de `p_platform`? (Lo mismo que
-- `musicPlatformOf` de packages/contracts/src/music.ts.)
create function private.music_url_ok(p_platform text, p_url text) returns boolean
language sql immutable
set search_path = ''
as $$
  select case p_platform
    when 'spotify' then p_url ~* '^https://([a-z0-9-]+\.)*(spotify\.com|spotify\.link)(/[^\s]*)?$'
    when 'soundcloud' then p_url ~* '^https://([a-z0-9-]+\.)*soundcloud\.com(/[^\s]*)?$'
    when 'bandcamp' then p_url ~* '^https://([a-z0-9-]+\.)*bandcamp\.com(/[^\s]*)?$'
    when 'instagram' then p_url ~* '^https://([a-z0-9-]+\.)*(instagram\.com|instagr\.am)(/[^\s]*)?$'
    else false
  end
$$;

alter table public.carnets add constraint carnets_music_url_platform_check check (
  music_url is null or private.music_url_ok(music_platform, music_url)
);

-- ---------------------------------------------------------------------------
-- set_artist_music: el propio artista pone (o, con nulos, quita) su enlace.

create function private.set_artist_music(p_user uuid, p_platform text, p_url text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  url text := nullif(btrim(coalesce(p_url, '')), '');
  platform text := nullif(btrim(coalesce(p_platform, '')), '');
  artist boolean;
begin
  select c.is_artist into artist from public.carnets c where c.user_id = p_user;
  if artist is null then
    raise exception 'carnet_required' using detail = 'Primero, el Carnet.';
  end if;
  if not artist then
    raise exception 'artist_required' using detail = 'Sólo un Carnet de artista lleva enlace a su música.';
  end if;
  if (url is null) <> (platform is null) then
    raise exception 'invalid_music' using detail = 'Falta la plataforma o el enlace.';
  end if;
  if url is not null and (char_length(url) > 300 or not private.music_url_ok(platform, url)) then
    raise exception 'invalid_music'
      using detail = 'Un enlace https de Spotify, SoundCloud, Bandcamp o Instagram.';
  end if;
  update public.carnets
  set music_platform = platform, music_url = url
  where user_id = p_user;
  return jsonb_build_object('platform', platform, 'url', url);
end;
$$;

create function public.set_artist_music(p_platform text default null, p_url text default null)
returns jsonb
language sql
set search_path = ''
as $$
  select private.set_artist_music(private.require_member(), p_platform, p_url)
$$;

-- ---------------------------------------------------------------------------
-- Permisos: nada para PUBLIC ni anon. Las columnas no las escribe ningún
-- cliente directamente (los Carnets sólo cambian con las RPC, plan 008).

revoke all on function private.music_url_ok(text, text) from public;
revoke all on function private.set_artist_music(uuid, text, text) from public;
grant execute on function private.music_url_ok(text, text) to authenticated, service_role;
grant execute on function private.set_artist_music(uuid, text, text) to authenticated;

revoke all on function public.set_artist_music(text, text) from public, anon;
grant execute on function public.set_artist_music(text, text) to authenticated;
