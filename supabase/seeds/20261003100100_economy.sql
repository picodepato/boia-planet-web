-- Muestra del plan 008 (REQ-ARQ-006): las fiestas, los cosméticos y los
-- descuentos escondidos que usa hoy la web (packages/store/src/sample), para
-- que las RPC de valor tengan contra qué validar. Todo lleva is_sample = true
-- y se retira con supabase/sample/remove-sample.sql. Reejecutable.
--
-- Las fiestas usan como slug el id del contenido de la web (halloween-2026…):
-- es lo que lleva el QR del sello, /sello?e=<slug>&c=<código>.

insert into public.events (
  id, slug, title, state, published_at, starts_at, ends_at, description, venue_public, is_sample
) values
  ('a2000000-0000-4000-8000-000000000011', 'halloween-2026', 'BOIA Halloween', 'on_sale',
   '2026-09-01T10:00:00Z', '2026-10-31T23:00:00+01:00', null,
   'Fiesta de muestra.', 'Alicante', true),
  ('a2000000-0000-4000-8000-000000000012', 'sonido-2026', 'SONIDO', 'on_sale',
   '2026-09-01T10:00:00Z', '2026-12-05T12:00:00+01:00', '2026-12-06T02:00:00+01:00',
   'Fiesta de muestra.', 'Alicante', true),
  ('a2000000-0000-4000-8000-000000000013', 'nochevieja-2026', 'BOIA Nochevieja', 'on_sale',
   '2026-09-01T10:00:00Z', '2026-12-31T23:00:00+01:00', '2027-01-01T08:00:00+01:00',
   'Fiesta de muestra.', 'Alicante', true),
  ('a2000000-0000-4000-8000-000000000014', 'all-day-boia-2026', 'All Day BOIA 2026', 'finished',
   '2026-05-01T10:00:00Z', '2026-06-20T12:00:00+02:00', null,
   'Fiesta de muestra ya celebrada.', 'Alicante', true),
  ('a2000000-0000-4000-8000-000000000015', 'borrador', 'Evento en borrador', 'draft',
   null, '2027-09-01T23:00:00+02:00', null, 'Evento de muestra sin publicar.', null, true)
on conflict (id) do nothing;

-- Un código por fiesta publicada, válido de 2 h antes a 6 h después (sin
-- hora de fin, 10 h de fiesta). El código se genera al sembrar: no está en
-- el repositorio. Lo enseña y lo regenera el Admin (T94).
insert into public.event_stamp_codes (event_id, code, valid_from, valid_until)
select e.id, private.new_stamp_code(), e.starts_at - interval '2 hours',
       coalesce(e.ends_at, e.starts_at + interval '10 hours') + interval '6 hours'
from public.events e
where e.is_sample and e.published_at is not null and e.starts_at is not null
on conflict (event_id) do nothing;

-- Cosméticos de la tienda «Barco» (SAMPLE_COSMETICS). Precios y umbrales muestra.
insert into public.cosmetics
  (id, name, slot, price_coins, unlock_points, unlock_achievement, unlock_mission, for_ship, base, is_sample)
values
  ('bandera-boia', 'Bandera BOIA', 'flag', 20, null, null, null, null, false, true),
  ('estela-naranja', 'Estela naranja', 'wake', 30, null, null, null, null, false, true),
  ('farolillo', 'Farolillo de proa', 'accessory', 25, null, null, null, null, false, true),
  ('bandera-fiestera', 'Bandera de la Fiestera', 'flag', null, null, 'fiestera-entregada', null, null, false, true),
  ('bandera-cuadros', 'Bandera a cuadros', 'flag', null, null, 'circuito-atajo', null, null, false, true),
  ('estela-burbujas', 'Estela de burbujas', 'wake', null, null, 'delfin', null, null, false, true),
  ('estela-rayo', 'Estela de rayo', 'wake', null, null, 'circuito-rapido', null, null, false, true),
  ('bandera-fantasma', 'Bandera fantasma', 'flag', null, null, 'canon-fantasma', null, null, false, true),
  ('mascota-minikraken', 'Minikraken', 'mascot', null, null, 'canon-kraken', null, null, false, true),
  ('barco-cel-shaded', 'Cel-shaded cómic', 'ship', null, null, 'guardacostas', null, null, false, true),
  ('barco-boceto-lapiz', 'Boceto a lápiz', 'ship', null, null, 'secretos', null, null, false, true),
  ('barco-pixel-art', 'Pixel art', 'ship', null, null, 'minutos-60', null, null, false, true),
  ('barco-fiestera', 'La Fiestera', 'ship', null, null, null, 'fiestera', null, false, true),
  ('barco-arcilla', 'Arcilla, maqueta', 'ship', null, null, null, null, null, true, true),
  ('barco-acuarela', 'Acuarela ilustrada', 'ship', null, null, null, null, null, true, true),
  ('barco-low-poly', 'Low-poly', 'ship', null, null, 'carnet', null, null, false, true),
  ('barco-cartoon-30', 'Cartoon años 30', 'ship', 120, null, null, null, null, false, true),
  ('barco-semi-realista', 'Semi-realista «El Veterano»', 'ship', null, 600, null, null, null, false, true)
on conflict (id) do nothing;

-- Skins noche y fiesta de cada barco con skins, a 50 monedas.
insert into public.cosmetics (id, name, slot, price_coins, for_ship, is_sample)
select 'skin-' || s.style || '-' || k.skin, s.label || ' · ' || k.label, 'skin', 50, s.ship, true
from (values
  ('barco-arcilla', 'arcilla', 'Arcilla'),
  ('barco-acuarela', 'acuarela', 'Acuarela'),
  ('barco-low-poly', 'low-poly', 'Low-poly'),
  ('barco-semi-realista', 'semi-realista', 'Semi-realista'),
  ('barco-cartoon-30', 'cartoon-30', 'Cartoon años 30'),
  ('barco-cel-shaded', 'cel-shaded', 'Cel-shaded'),
  ('barco-pixel-art', 'pixel-art', 'Pixel art')
) as s (ship, style, label)
cross join (values ('noche', 'Noche'), ('fiesta', 'Fiesta')) as k (skin, label)
on conflict (id) do nothing;

-- Descuentos escondidos en el mundo (SAMPLE_DISCOUNTS). El código y el valor
-- los enseña la web; aquí sólo lo que hace falta para validar su uso.
insert into public.discounts (id, event_ref, scope, starts_at, ends_at, is_sample) values
  ('dto-naufrago', 'sonido-2026', 'event', null, '2026-12-04T23:59:00+01:00', true),
  ('dto-cofre', 'nochevieja-2026', 'event', null, '2026-12-30T23:59:00+01:00', true),
  ('dto-fiestera', null, 'event', null, '2027-12-31T23:59:00+01:00', true)
on conflict (id) do nothing;
