-- «Sácate el Carnet» (plan 030 T288): el bloque nuevo de la home, después de
-- «Próximos eventos». Mismos tipos y orden que HOME_BLOCK_TYPES de
-- @boia/contracts (packages/db/src/schema.test.ts lo exige).
alter type public.home_block_type add value if not exists 'carnet' after 'upcoming_events';
