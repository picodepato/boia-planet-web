-- Botellas globales (plan 008, decisión 12): todo el mundo ve las 10 más
-- recientes de todas las cuentas, cada cuenta tiene una activa y el texto
-- pasa un filtro en la base (enlaces, emails, teléfonos y palabras
-- ofensivas) aunque el cliente ya lo filtre. Dónde se colocan (fuera del
-- radio de las islas) lo decide el cliente (T88, T93).

-- El filtro vale para cualquier escritura del mensaje, también las directas
-- que la RLS permite al autor.
create function private.bottle_text_guard() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  problem text;
begin
  if tg_op = 'INSERT' or new.message is distinct from old.message then
    problem := private.text_problem(new.message);
    if problem is not null then
      raise exception 'text_%', problem using detail = 'El mensaje no pasa el filtro.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.bottle_text_guard() from public;

create trigger bottles_text_guard before insert or update of message on public.bottles
  for each row execute function private.bottle_text_guard();

create index bottles_recent_idx on public.bottles (created_at desc) where status = 'active';

-- Echa la botella de quien llama (hace falta Carnet): retira la suya activa,
-- si la hay, y deja la nueva.
create function private.place_bottle(p_user uuid, p_message text, p_x double precision, p_y double precision)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  msg text := btrim(coalesce(p_message, ''));
  b public.bottles;
begin
  if not exists (select 1 from public.carnets where user_id = p_user) then
    raise exception 'carnet_required' using detail = 'Echar una botella pide tener Carnet.';
  end if;
  if char_length(msg) not between 1 and 140 then
    raise exception 'invalid_message' using detail = 'El mensaje tiene de 1 a 140 caracteres.';
  end if;
  if p_x is null or p_y is null or p_x = 'NaN'::float8 or p_y = 'NaN'::float8
     or abs(p_x) > 100000 or abs(p_y) > 100000 then
    raise exception 'invalid_position' using detail = 'Posición fuera del mar.';
  end if;
  perform private.lock_account(p_user);
  update public.bottles set status = 'retired' where user_id = p_user and status = 'active';
  insert into public.bottles (user_id, message, x, y)
  values (p_user, msg, p_x, p_y)
  returning * into b;
  return jsonb_build_object('id', b.id, 'message', b.message, 'x', b.x, 'y', b.y,
                            'status', b.status, 'created_at', b.created_at);
end;
$$;

-- Las 10 (o menos) más recientes activas, de cuentas con Carnet.
create function private.latest_bottles(p_limit integer)
returns table (
  id uuid,
  message text,
  x double precision,
  y double precision,
  author_id uuid,
  author_nickname text,
  is_mine boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable
security definer
set search_path = ''
as $$
  select b.id, b.message, b.x, b.y, b.user_id, c.nickname,
         coalesce(b.user_id = (select auth.uid()), false),
         b.created_at, b.updated_at
  from public.bottles b
  join public.carnets c on c.user_id = b.user_id
  where b.status = 'active'
  order by b.created_at desc, b.id
  limit least(greatest(coalesce(p_limit, 10), 1), 10)
$$;

create function public.place_bottle(p_message text, p_x double precision, p_y double precision)
returns jsonb
language sql
set search_path = ''
as $$
  select private.place_bottle(private.require_member(), p_message, p_x, p_y)
$$;

create function public.latest_bottles(p_limit integer default 10)
returns table (
  id uuid,
  message text,
  x double precision,
  y double precision,
  author_id uuid,
  author_nickname text,
  is_mine boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql stable
set search_path = ''
as $$
  select * from private.latest_bottles(p_limit)
$$;

revoke all on function private.place_bottle(uuid, text, double precision, double precision) from public;
revoke all on function private.latest_bottles(integer) from public;
grant execute on function private.place_bottle(uuid, text, double precision, double precision) to authenticated;
grant execute on function private.latest_bottles(integer) to anon, authenticated;

revoke all on function public.place_bottle(text, double precision, double precision) from public, anon;
revoke all on function public.latest_bottles(integer) from public;
grant execute on function public.place_bottle(text, double precision, double precision) to authenticated;
grant execute on function public.latest_bottles(integer) to anon, authenticated;
