-- La mascota de cubierta (plan 013 T154): la ranura `mascot` también se
-- equipa en una cuenta. Escrita y probada en local; NO aplicada a ningún
-- proyecto (lo hace Hernán).
--
-- `20261005100000_canon_launch.sql` (T153) ya deja la ranura en el catálogo
-- (`cosmetics.slot`) y el logro `canon-kraken` da la mascota minikraken. Aquí:
-- 1. `equipped_cosmetics.slot` acepta `mascot`.
-- 2. `private.equip_cosmetic` (la de `equip_cosmetic` y la de `merge_guest`)
--    acepta la ranura `mascot`; lo demás no cambia: sólo lo que se tiene y en
--    su ranura. Las mismas ranuras que `COSMETIC_SLOTS` de @boia/store.

alter table public.equipped_cosmetics drop constraint if exists equipped_cosmetics_slot_check;
alter table public.equipped_cosmetics add constraint equipped_cosmetics_slot_check
  check (slot in ('flag', 'accessory', 'skin', 'wake', 'ship', 'mascot'));

create or replace function private.equip_cosmetic(p_user uuid, p_slot text, p_cosmetic text) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.cosmetics;
begin
  if p_slot is null or p_slot not in ('flag', 'accessory', 'skin', 'wake', 'ship', 'mascot') then
    raise exception 'invalid_slot' using detail = format('Ranura desconocida: %s', p_slot);
  end if;
  perform private.lock_account(p_user);
  if p_cosmetic is null then
    delete from public.equipped_cosmetics where user_id = p_user and slot = p_slot;
    return private.equipped_json(p_user);
  end if;
  select * into c from public.cosmetics where id = p_cosmetic;
  if not found then
    raise exception 'unknown_cosmetic' using detail = format('Cosmético desconocido: %s', p_cosmetic);
  end if;
  if c.slot <> p_slot then
    raise exception 'wrong_slot' using detail = format('%s va en %s, no en %s.', c.id, c.slot, p_slot);
  end if;
  if not private.owns_cosmetic(p_user, c.id) then
    raise exception 'not_owned' using detail = format('No tienes %s.', c.id);
  end if;
  insert into public.equipped_cosmetics as e (user_id, slot, cosmetic_id)
  values (p_user, p_slot, c.id)
  on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, updated_at = now();
  -- Una skin lleva su barco; un barco nuevo no se queda con la skin de otro.
  if p_slot = 'skin' and c.for_ship is not null then
    insert into public.equipped_cosmetics as e (user_id, slot, cosmetic_id)
    values (p_user, 'ship', c.for_ship)
    on conflict (user_id, slot) do update set cosmetic_id = excluded.cosmetic_id, updated_at = now();
  elsif p_slot = 'ship' then
    delete from public.equipped_cosmetics e
    using public.cosmetics s
    where e.user_id = p_user and e.slot = 'skin' and s.id = e.cosmetic_id
      and s.for_ship is distinct from c.id;
  end if;
  return private.equipped_json(p_user);
end;
$$;
