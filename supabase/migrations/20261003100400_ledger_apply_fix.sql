-- Arreglo de private.ledger_apply (20260928100500_progress.sql): con
-- `insert … on conflict do update`, Postgres comprueba los CHECK de la fila
-- propuesta antes de ver el conflicto, así que gastar monedas (coins_delta
-- negativo, la compra de un cosmético) fallaba siempre con
-- coin_balances_coins_check aunque hubiera saldo; igual con una compensación
-- de puntos. Ahora se actualiza la fila y sólo se inserta si no existe. Lo
-- encontraron las pruebas de `pnpm test:supabase` (plan 008, T86).

create or replace function private.ledger_apply() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  orig public.ledger_transactions;
begin
  if new.points_delta <> 0 then
    update public.point_balances
    set points = points + new.points_delta, updated_at = now()
    where user_id = new.user_id;
    if not found then
      insert into public.point_balances (user_id, points) values (new.user_id, new.points_delta);
    end if;
    if new.season_id is not null then
      update public.season_points
      set points = points + new.points_delta, updated_at = now()
      where season_id = new.season_id and user_id = new.user_id;
      if not found then
        insert into public.season_points (season_id, user_id, points)
        values (new.season_id, new.user_id, new.points_delta);
      end if;
    end if;
  end if;

  if new.coins_delta <> 0 then
    update public.coin_balances
    set coins = coins + new.coins_delta, updated_at = now()
    where user_id = new.user_id;
    if not found then
      insert into public.coin_balances (user_id, coins) values (new.user_id, new.coins_delta);
    end if;
  end if;

  case new.kind
    when 'achievement' then
      insert into public.user_achievements (tx_id, user_id, achievement_id)
      values (new.id, new.user_id, new.achievement_id);
    when 'stamp' then
      insert into public.stamps (tx_id, user_id, event_id, purchase_id)
      values (new.id, new.user_id, new.event_id, new.purchase_id);
    when 'cosmetic' then
      insert into public.user_cosmetics (tx_id, user_id, cosmetic_key)
      values (new.id, new.user_id, new.cosmetic_key);
    when 'compensation' then
      select * into orig from public.ledger_transactions where id = new.compensates_id;
      update public.user_achievements set revoked_at = now(), revoked_by_tx = new.id
        where tx_id = orig.id;
      update public.stamps set revoked_at = now(), revoked_by_tx = new.id
        where tx_id = orig.id;
      update public.user_cosmetics set revoked_at = now(), revoked_by_tx = new.id
        where tx_id = orig.id;
    else
      null;
  end case;
  return null;
end;
$$;

revoke all on function private.ledger_apply() from public;
