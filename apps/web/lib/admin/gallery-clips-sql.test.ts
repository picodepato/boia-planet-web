import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CLIP_UPLOAD_LIMITS, EVENT_CLIP_BUCKET, EVENT_PHOTO_BUCKET } from './photo-upload';

/**
 * La migración de los clips de la Galería (plan 019 T216), leída como
 * texto: lo que esta máquina puede comprobar sin PostgreSQL. Las pruebas
 * contra la base están en packages/db/src/supabase/gallery-clips.supabase.ts
 * (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261008100400_gallery_clips.sql');
const LONGER = read('supabase/migrations/20261013100100_gallery_clips_longer.sql');
const TYPES = read('packages/db/src/database.types.ts');

describe('clips de la Galería: columnas, comprobaciones y bucket (T216)', () => {
  it('cada pieza es foto o clip, y un clip lleva póster del bucket de las fotos', () => {
    expect(SQL).toContain(
      "add column kind text not null default 'image' check (kind in ('image', 'video'))",
    );
    expect(SQL).toContain(
      `poster_url ~ '^https://[^/\\s]+/storage/v1/object/public/${EVENT_PHOTO_BUCKET}/[A-Za-z0-9._/-]+$'`,
    );
    expect(SQL).toContain("(kind = 'video') = (poster_url is not null)");
    expect(SQL).toContain(
      'grant insert (kind, poster_url) on public.event_photos to authenticated;',
    );
    // anon nunca escribe.
    expect(SQL).not.toMatch(/grant (insert|update|delete)[^;]* to [^;]*anon/);
  });

  it('la URL de un clip es de su bucket y la de una foto, del de las fotos', () => {
    expect(SQL).toContain('drop constraint event_photos_url_check;');
    expect(SQL).toContain(
      `(kind = 'image' and url ~ '^https://[^/\\s]+/storage/v1/object/public/${EVENT_PHOTO_BUCKET}/`,
    );
    expect(SQL).toContain(
      `(kind = 'video' and url ~ '^https://[^/\\s]+/storage/v1/object/public/${EVENT_CLIP_BUCKET}/`,
    );
    expect(SQL).toContain(
      `check (width between 1 and case when kind = 'video' then ${CLIP_UPLOAD_LIMITS.maxSide} else 1600 end)`,
    );
  });

  it('el bucket de clips es público, mp4 del tope de la subida, y sólo lo escribe el equipo', () => {
    // El bucket nace con 20 MB (T216) y la migración de T277 sube el tope al de la subida.
    expect(SQL).toContain(
      `values ('${EVENT_CLIP_BUCKET}', '${EVENT_CLIP_BUCKET}', true, 20971520, array['${CLIP_UPLOAD_LIMITS.types.join("', '")}'])`,
    );
    expect(LONGER).toContain(`set file_size_limit = ${CLIP_UPLOAD_LIMITS.maxBytes}`);
    expect(LONGER).toContain(`where id = '${EVENT_CLIP_BUCKET}'`);
    expect(LONGER).toContain("if to_regclass('storage.buckets') is null then");
    for (const op of ['insert', 'update', 'delete']) {
      expect(SQL).toMatch(
        new RegExp(
          `create policy event_clips_staff_${op} on storage\\.objects\\s+for ${op} to authenticated[^$]*bucket_id = '${EVENT_CLIP_BUCKET}' and \\(select private\\.has_staff_role\\('admin'\\)\\)`,
        ),
      );
    }
    expect(SQL).toContain("if to_regclass('storage.buckets') is null then");
  });

  it('los tipos de la base tienen las columnas nuevas', () => {
    const photos = TYPES.slice(TYPES.indexOf('event_photos: {'));
    const row = photos.slice(0, photos.indexOf('Insert:'));
    expect(row).toContain('kind: string;');
    expect(row).toContain('poster_url: string | null;');
  });
});
