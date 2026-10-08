-- Clips de la Galería (plan 019 T216, decisión 8; REQ-COM-031, REQ-COM-032,
-- REQ-ADM-019). Sobre las fotos de las islas (20261007100100_event_photos).
--
-- La Galería es un collage de fotos y clips cortos (mp4, siempre sin
-- sonido). El Admin los sube como las fotos: elige isla y evento. El clip
-- se guarda tal cual en su propio bucket (`event-clips`, mp4 de 20 MB como
-- mucho); su póster (un fotograma, en WebP o JPEG como las fotos) va al
-- bucket de las fotos. Lectura pública; escritura sólo del equipo (admin u
-- owner con segundo factor), como las fotos.

-- ---------------------------------------------------------------------------
-- Cada pieza dice si es foto o clip; un clip lleva su póster.

alter table public.event_photos
  add column kind text not null default 'image' check (kind in ('image', 'video')),
  add column poster_url text
    check (poster_url ~ '^https://[^/\s]+/storage/v1/object/public/event-photos/[A-Za-z0-9._/-]+$');

-- La URL, del bucket que toca: las fotos en `event-photos`, los clips en `event-clips`.
alter table public.event_photos drop constraint event_photos_url_check;
alter table public.event_photos add constraint event_photos_url_check check (
  (kind = 'image' and url ~ '^https://[^/\s]+/storage/v1/object/public/event-photos/[A-Za-z0-9._/-]+$')
  or (kind = 'video' and url ~ '^https://[^/\s]+/storage/v1/object/public/event-clips/[A-Za-z0-9._/-]+$')
);

-- Un clip, con póster; una foto, sin.
alter table public.event_photos add constraint event_photos_poster_check check (
  (kind = 'video') = (poster_url is not null)
);

-- Tamaño: la copia de una foto, 1600 px como mucho; un clip no se recodifica (hasta 4K).
alter table public.event_photos drop constraint event_photos_width_check;
alter table public.event_photos drop constraint event_photos_height_check;
alter table public.event_photos add constraint event_photos_width_check
  check (width between 1 and case when kind = 'video' then 3840 else 1600 end);
alter table public.event_photos add constraint event_photos_height_check
  check (height between 1 and case when kind = 'video' then 3840 else 1600 end);

grant insert (kind, poster_url) on public.event_photos to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: bucket público de clips, mp4 de 20 MB como mucho, escritura sólo
-- del equipo con aal2. Sin el esquema storage (el PostgreSQL local de
-- `pnpm db:test`) esta parte no se aplica.

do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('event-clips', 'event-clips', true, 20971520, array['video/mp4'])
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

  execute $p$create policy event_clips_staff_read on storage.objects
    for select to authenticated
    using (bucket_id = 'event-clips' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_clips_staff_insert on storage.objects
    for insert to authenticated
    with check (bucket_id = 'event-clips' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_clips_staff_update on storage.objects
    for update to authenticated
    using (bucket_id = 'event-clips' and (select private.has_staff_role('admin')))
    with check (bucket_id = 'event-clips' and (select private.has_staff_role('admin')))$p$;
  execute $p$create policy event_clips_staff_delete on storage.objects
    for delete to authenticated
    using (bucket_id = 'event-clips' and (select private.has_staff_role('admin')))$p$;
end
$$;
