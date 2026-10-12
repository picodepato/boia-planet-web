-- Clips de la Galería más largos (plan 029 T277). El Admin pasa de clips de
-- 30 s / 20 MB a 60 s / 50 MB (50 MB es el tope por archivo del plan gratuito
-- de Supabase). La duración la vigila el Admin al subir; aquí sólo cambia el
-- peso máximo del bucket `event-clips` (20971520 -> 52428800 bytes).
-- Sin el esquema storage (el PostgreSQL local de `pnpm db:test`) no se aplica.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  update storage.buckets
    set file_size_limit = 52428800
    where id = 'event-clips';
end
$$;
