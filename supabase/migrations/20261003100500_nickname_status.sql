-- ¿Se puede usar este apodo? (plan 008, T89, decisión 5). La hoja de acceso
-- lo comprueba mientras se escribe la cuenta nueva (400 ms después de dejar
-- de escribir) y otra vez al enviar, sin crear nada: mismo criterio que
-- save_profile (de 2 a 30 caracteres, el filtro de texto y único sin
-- distinguir mayúsculas), pero devuelve el motivo en vez de fallar.
--
-- Devuelve 'ok' o la misma clave con la que save_profile rechazaría:
-- 'nickname_invalid', 'text_link', 'text_email', 'text_phone',
-- 'text_offensive' o 'nickname_taken'. El apodo propio cuenta como libre.
-- Sólo para cuentas con email (la hoja ya ha verificado el código); no dice
-- nada que no se vea ya en los Carnets públicos, ni qué palabra falla.

create function private.nickname_status(p_user uuid, p_nickname text) returns text
language plpgsql stable
security definer
set search_path = ''
as $$
declare
  nick text := btrim(coalesce(p_nickname, ''));
  problem text;
begin
  if char_length(nick) not between 2 and 30 then
    return 'nickname_invalid';
  end if;
  problem := private.text_problem(nick);
  if problem is not null then
    return 'text_' || problem;
  end if;
  if exists (
    select 1 from public.carnets c
    where lower(c.nickname) = lower(nick) and c.user_id <> p_user
  ) then
    return 'nickname_taken';
  end if;
  return 'ok';
end;
$$;

create function public.nickname_status(p_nickname text) returns text
language sql stable
set search_path = ''
as $$
  select private.nickname_status(private.require_member(), p_nickname)
$$;

revoke all on function private.nickname_status(uuid, text) from public;
grant execute on function private.nickname_status(uuid, text) to authenticated;

revoke all on function public.nickname_status(text) from public, anon;
grant execute on function public.nickname_status(text) to authenticated;
