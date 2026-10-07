import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { EVENT_PHOTO_BUCKET, PHOTO_UPLOAD_LIMITS } from './photo-upload';

/**
 * La migración de las fotos de las islas (plan 017 T189), leída como texto:
 * lo que esta máquina puede comprobar sin PostgreSQL. Las pruebas contra la
 * base están en packages/db/src/supabase/event-photos.supabase.ts
 * (`pnpm test:supabase`).
 */
const read = (path: string) =>
  readFileSync(new URL(`../../../../${path}`, import.meta.url), 'utf8');
const SQL = read('supabase/migrations/20261007100100_event_photos.sql');
const TYPES = read('packages/db/src/database.types.ts');
const TABLES = ['event_albums', 'event_photos'] as const;

describe('fotos de las islas: tablas, RLS y bucket (T189)', () => {
  it('cada tabla tiene RLS, lectura pública y escritura sólo del equipo con aal2', () => {
    for (const table of TABLES) {
      expect(SQL).toContain(`alter table public.${table} enable row level security;`);
      expect(SQL).toContain(
        `revoke all on public.${table} from anon, authenticated, service_role;`,
      );
      expect(SQL).toContain(`grant select on public.${table} to anon, authenticated;`);
      for (const op of ['insert', 'update', 'delete']) {
        const policy = new RegExp(
          `create policy ${table}_staff_${op} on public\\.${table}\\s+for ${op} to authenticated[^;]*has_staff_role\\('admin'\\)`,
        );
        expect(SQL, `${table} ${op}`).toMatch(policy);
      }
      expect(SQL).toMatch(
        new RegExp(`create trigger ${table}_audit after insert or update or delete`),
      );
    }
    // anon nunca escribe.
    expect(SQL).not.toMatch(/grant (insert|update|delete)[^;]* to [^;]*anon/);
  });

  it('las fotos son copias del bucket, con texto alternativo y tamaño de la copia', () => {
    expect(SQL).toContain(
      `url ~ '^https://[^/\\s]+/storage/v1/object/public/${EVENT_PHOTO_BUCKET}/[A-Za-z0-9._/-]+$'`,
    );
    expect(SQL).toContain('alt text not null check (char_length(btrim(alt)) between 1 and 300)');
    expect(SQL).toContain(
      `width integer not null check (width between 1 and ${PHOTO_UPLOAD_LIMITS.maxSide})`,
    );
    expect(SQL).toContain('references public.event_albums (id) on delete cascade');
    expect(SQL).toContain(
      'create unique index event_albums_one_per_event on public.event_albums (event_id);',
    );
  });

  it('el bucket es público, del tamaño y los tipos de la copia, y sólo lo escribe el equipo', () => {
    expect(SQL).toContain(
      `values ('${EVENT_PHOTO_BUCKET}', '${EVENT_PHOTO_BUCKET}', true, ${PHOTO_UPLOAD_LIMITS.maxStoredBytes}, array['image/webp', 'image/jpeg'])`,
    );
    for (const op of ['insert', 'update', 'delete']) {
      expect(SQL).toMatch(
        new RegExp(
          `create policy event_photos_staff_${op} on storage\\.objects\\s+for ${op} to authenticated[^$]*bucket_id = '${EVENT_PHOTO_BUCKET}' and \\(select private\\.has_staff_role\\('admin'\\)\\)`,
        ),
      );
    }
  });

  it('los tipos de la base conocen las dos tablas', () => {
    for (const table of TABLES) expect(TYPES).toContain(`      ${table}: {`);
  });
});
