/**
 * Las variables de Supabase y la salvaguarda de `pnpm db:migrate:dev`: nunca
 * toca una base que no sea del proyecto de NEXT_PUBLIC_SUPABASE_URL.
 */
import { describe, expect, it } from 'vitest';
import { parseEnvFile, projectRefFromDbUrl, projectRefFromUrl, readSupabaseEnv } from './env.ts';

const REF = 'abcdefghijklmnopqrst';
const OTHER = 'zyxwvutsrqponmlkjihg';
const base = {
  NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_x',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_x',
  SUPABASE_DB_URL: `postgresql://postgres.${REF}:clave@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`,
};

describe('variables de Supabase', () => {
  it('lee CLAVE=valor, sin comentarios y sin comillas', () => {
    expect(parseEnvFile('# nada\nA=1\r\nB="dos"\n  C = tres \nexport D=4\nmal')).toEqual({
      A: '1',
      B: 'dos',
      C: 'tres',
      D: '4',
    });
  });

  it('saca la referencia del proyecto de la URL y de la cadena de conexión', () => {
    expect(projectRefFromUrl(base.NEXT_PUBLIC_SUPABASE_URL)).toBe(REF);
    expect(projectRefFromUrl('https://example.com')).toBeNull();
    expect(projectRefFromDbUrl(base.SUPABASE_DB_URL)).toBe(REF);
    expect(projectRefFromDbUrl(`postgresql://postgres:x@db.${REF}.supabase.co:5432/postgres`)).toBe(
      REF,
    );
    expect(projectRefFromDbUrl('postgresql://postgres@localhost:5432/postgres')).toBeNull();
  });

  it('vacía cuenta como ausente', () => {
    const r = readSupabaseEnv({ ...base, SUPABASE_DB_URL: '  ' });
    expect(r).toEqual({ ok: false, missing: ['SUPABASE_DB_URL'] });
  });

  it('se niega si la base es de otro proyecto o no es de Supabase', () => {
    const other = readSupabaseEnv({
      ...base,
      SUPABASE_DB_URL: base.SUPABASE_DB_URL.replace(REF, OTHER),
    });
    expect(other.ok).toBe(false);
    expect(!other.ok && other.problem).toMatch(/mismo proyecto/);
    const local = readSupabaseEnv({
      ...base,
      SUPABASE_DB_URL: 'postgresql://postgres@localhost:5432/postgres',
    });
    expect(local.ok).toBe(false);
  });

  it('con todo en orden da el proyecto', () => {
    const r = readSupabaseEnv(base);
    expect(r.ok && r.env.ref).toBe(REF);
  });
});
