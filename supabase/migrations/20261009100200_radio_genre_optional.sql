-- Radio: canciones sin género y borrar géneros (plan 023 T255, Hernán
-- 2026-10-09). Detrás de 20261009100100_radio.sql. Escrita y probada como
-- texto en local, NO aplicada a ningún proyecto (la aplica T253 en
-- boia-planet-dev).
--
-- - Una canción puede no tener género (`genre_id` null): sólo suena en
--   «Todos» del reproductor.
-- - Borrar un género deja sus canciones sin género (`on delete set null`);
--   nunca borra canciones. Antes la clave ajena lo impedía (`restrict`).
-- - Borrar géneros ya lo podía el equipo (política `radio_genres_staff_delete`
--   y `grant delete` de la migración anterior); cambiar el género de una
--   canción, también (`update (title, artist, genre_id)`). No hacen falta
--   permisos nuevos: aquí sólo cambia la columna y su clave ajena.
--
-- Mismas reglas que packages/contracts/src/radio.ts (`deleteRadioGenre`).

alter table public.radio_songs alter column genre_id drop not null;

alter table public.radio_songs drop constraint radio_songs_genre_id_fkey;

alter table public.radio_songs
  add constraint radio_songs_genre_id_fkey
  foreign key (genre_id) references public.radio_genres (id) on delete set null;
