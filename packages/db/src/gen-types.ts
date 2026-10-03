/**
 * Genera los tipos TypeScript del esquema public con la misma forma que
 * `supabase gen types typescript` (Database['public']['Tables'][t]['Row'|
 * 'Insert'|'Update'|'Relationships'], Enums y Constants), leyendo el
 * catálogo de una base con todas las migraciones aplicadas. Así supabase-js
 * los acepta tal cual y no hace falta la CLI (D-17).
 */
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import * as prettier from 'prettier';

interface ColumnRow {
  table_name: string;
  relkind: string;
  column_name: string;
  typname: string;
  typtype: string;
  typcategory: string;
  elem_typname: string | null;
  elem_typtype: string | null;
  nullable: boolean;
  has_default: boolean;
  identity: string;
  generated: string;
}

interface FkRow {
  conname: string;
  table_name: string;
  columns: string[];
  referenced: string;
  referenced_columns: string[];
  one_to_one: boolean;
}

const SCALARS: Record<string, string> = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  json: 'Json',
  jsonb: 'Json',
};
const STRINGS = new Set([
  'text',
  'varchar',
  'bpchar',
  'uuid',
  'date',
  'time',
  'timetz',
  'timestamp',
  'timestamptz',
  'interval',
  'bytea',
  'inet',
  'citext',
]);

function scalar(typname: string, typtype: string | null, enums: Set<string>): string {
  if (typtype === 'e' && enums.has(typname)) return `Database['public']['Enums']['${typname}']`;
  if (SCALARS[typname]) return SCALARS[typname];
  if (STRINGS.has(typname)) return 'string';
  return 'unknown';
}

function tsType(c: ColumnRow, enums: Set<string>): string {
  if (c.typcategory === 'A' && c.elem_typname) {
    return `${scalar(c.elem_typname, c.elem_typtype, enums)}[]`;
  }
  return scalar(c.typname, c.typtype, enums);
}

const key = (name: string) => (/^[a-z_][a-z0-9_]*$/.test(name) ? name : `'${name}'`);

interface FunctionRow {
  name: string;
  arg_types: number[];
  all_arg_types: number[] | null;
  arg_modes: string[] | null;
  arg_names: string[] | null;
  n_defaults: number;
  ret_type: number;
  ret_set: boolean;
}

interface TypeRow {
  oid: number;
  typname: string;
  typtype: string;
  typcategory: string;
  elem_typname: string | null;
  elem_typtype: string | null;
}

/**
 * Funciones de public como las escribe la CLI de Supabase (lo que acepta
 * `supabase.rpc`): Args con los parámetros de entrada (opcionales los que
 * tienen valor por defecto) y Returns con el tipo devuelto; una función
 * `returns table (...)` devuelve una lista de filas. Sin las de disparador.
 */
async function functionTypes(client: pg.Client, enums: Set<string>): Promise<string[]> {
  const { rows: fns } = await client.query<FunctionRow>(`
    select p.proname as name, p.proargtypes::oid[]::int8[] as arg_types,
           p.proallargtypes::int8[] as all_arg_types, p.proargmodes::text[] as arg_modes,
           p.proargnames as arg_names, p.pronargdefaults::int as n_defaults,
           p.prorettype::int8 as ret_type, p.proretset as ret_set
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.prorettype <> 'trigger'::regtype
    order by p.proname, p.oid`);
  if (fns.length === 0) return [];
  const oids = [
    ...new Set(fns.flatMap((f) => [...(f.all_arg_types ?? f.arg_types), f.ret_type].map(Number))),
  ];
  const { rows: types } = await client.query<TypeRow>(
    `select t.oid::int8 as oid, t.typname, t.typtype::text as typtype,
            t.typcategory::text as typcategory, et.typname as elem_typname,
            et.typtype::text as elem_typtype
     from pg_type t
     left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
     where t.oid = any($1::oid[])`,
    [oids],
  );
  const byOid = new Map(types.map((t) => [Number(t.oid), t]));
  const ts = (oid: number): string => {
    const t = byOid.get(Number(oid));
    if (!t) return 'unknown';
    if (t.typcategory === 'A' && t.elem_typname) {
      return `${scalar(t.elem_typname, t.elem_typtype, enums)}[]`;
    }
    if (t.typname === 'void') return 'undefined';
    return scalar(t.typname, t.typtype, enums);
  };

  return fns.map((f) => {
    const all = (f.all_arg_types ?? f.arg_types).map(Number);
    const modes = f.arg_modes ?? all.map(() => 'i');
    const names = f.arg_names ?? [];
    const inputs = all.flatMap((oid, i) =>
      modes[i] === 'i' || modes[i] === 'b' || modes[i] === 'v'
        ? [{ name: names[i] ?? '', oid }]
        : [],
    );
    const firstDefault = inputs.length - f.n_defaults;
    const args = inputs.length
      ? `{\n${inputs.map((a, i) => `${key(a.name)}${i >= firstDefault ? '?' : ''}: ${ts(a.oid)}`).join('\n')}\n}`
      : 'Record<PropertyKey, never>';
    const outCols = all.flatMap((oid, i) =>
      modes[i] === 't' ? [`${key(names[i] ?? '')}: ${ts(oid)}`] : [],
    );
    const returns = outCols.length
      ? `{\n${outCols.join('\n')}\n}[]`
      : `${ts(f.ret_type)}${f.ret_set ? '[]' : ''}`;
    return `${f.name}: {\n Args: ${args}\n Returns: ${returns}\n}`;
  });
}

export async function generateTypes(client: pg.Client): Promise<string> {
  const { rows: enumRows } = await client.query<{ name: string; label: string }>(`
    select t.typname as name, e.enumlabel as label
    from pg_enum e
    join pg_type t on t.oid = e.enumtypid
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
    order by t.typname, e.enumsortorder`);
  const enums = new Map<string, string[]>();
  for (const r of enumRows) enums.set(r.name, [...(enums.get(r.name) ?? []), r.label]);
  const enumNames = new Set(enums.keys());

  const { rows: columns } = await client.query<ColumnRow>(`
    select c.relname as table_name, c.relkind::text as relkind, a.attname as column_name,
           t.typname, t.typtype::text as typtype, t.typcategory::text as typcategory,
           et.typname as elem_typname, et.typtype::text as elem_typtype,
           not a.attnotnull as nullable, a.atthasdef as has_default,
           a.attidentity::text as identity, a.attgenerated::text as generated
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    join pg_type t on t.oid = a.atttypid
    left join pg_type et on et.oid = t.typelem and t.typcategory = 'A'
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
      and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attname`);

  const { rows: fks } = await client.query<FkRow>(`
    select con.conname, cl.relname as table_name,
           array(select att.attname from unnest(con.conkey) with ordinality k(n, i)
                 join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k.n
                 order by k.i)::text[] as columns,
           fcl.relname as referenced,
           array(select att.attname from unnest(con.confkey) with ordinality k(n, i)
                 join pg_attribute att on att.attrelid = con.confrelid and att.attnum = k.n
                 order by k.i)::text[] as referenced_columns,
           exists (
             select 1 from pg_index ix
             where ix.indrelid = con.conrelid and ix.indisunique and ix.indpred is null
               and (select array_agg(x order by x) from unnest(ix.indkey::int2[]) x)
                 = (select array_agg(x order by x) from unnest(con.conkey) x)
           ) as one_to_one
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace n on n.oid = cl.relnamespace
    join pg_class fcl on fcl.oid = con.confrelid
    join pg_namespace fn on fn.oid = fcl.relnamespace
    where con.contype = 'f' and n.nspname = 'public' and fn.nspname = 'public'
    order by cl.relname, con.conname`);

  const tables = new Map<string, ColumnRow[]>();
  const views = new Map<string, ColumnRow[]>();
  for (const c of columns) {
    const target = c.relkind === 'r' ? tables : views;
    target.set(c.table_name, [...(target.get(c.table_name) ?? []), c]);
  }

  const rels = (table: string) =>
    fks
      .filter((f) => f.table_name === table)
      .map(
        (f) => `{
          foreignKeyName: '${f.conname}'
          columns: [${f.columns.map((c) => `'${c}'`).join(', ')}]
          isOneToOne: ${f.one_to_one}
          referencedRelation: '${f.referenced}'
          referencedColumns: [${f.referenced_columns.map((c) => `'${c}'`).join(', ')}]
        }`,
      )
      .join(',\n');

  const tableBlock = (name: string, cols: ColumnRow[]) => {
    const row = cols
      .map((c) => `${key(c.column_name)}: ${tsType(c, enumNames)}${c.nullable ? ' | null' : ''}`)
      .join('\n');
    const insert = cols
      .map((c) => {
        if (c.generated === 's' || c.identity === 'a') return `${key(c.column_name)}?: never`;
        const optional = c.nullable || c.has_default || c.identity === 'd';
        return `${key(c.column_name)}${optional ? '?' : ''}: ${tsType(c, enumNames)}${c.nullable ? ' | null' : ''}`;
      })
      .join('\n');
    const update = cols
      .map((c) => {
        if (c.generated === 's' || c.identity === 'a') return `${key(c.column_name)}?: never`;
        return `${key(c.column_name)}?: ${tsType(c, enumNames)}${c.nullable ? ' | null' : ''}`;
      })
      .join('\n');
    return `${name}: {
      Row: {\n${row}\n}
      Insert: {\n${insert}\n}
      Update: {\n${update}\n}
      Relationships: [\n${rels(name)}\n]
    }`;
  };

  const viewBlock = (name: string, cols: ColumnRow[]) =>
    `${name}: {
      Row: {\n${cols.map((c) => `${key(c.column_name)}: ${tsType(c, enumNames)} | null`).join('\n')}\n}
      Relationships: []
    }`;

  const never = '{ [_ in never]: never }';
  const functions = await functionTypes(client, enumNames);
  const tablesSrc = [...tables].map(([n, c]) => tableBlock(n, c)).join('\n');
  const viewsSrc = [...views].map(([n, c]) => viewBlock(n, c)).join('\n');
  const enumsSrc = [...enums]
    .map(([n, labels]) => `${n}: ${labels.map((l) => `'${l}'`).join(' | ')}`)
    .join('\n');
  const constantsSrc = [...enums]
    .map(([n, labels]) => `${n}: [${labels.map((l) => `'${l}'`).join(', ')}]`)
    .join(',\n');

  const src = `// Generado por \`pnpm db:types\` desde supabase/migrations. No editar a mano.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: ${tables.size ? `{\n${tablesSrc}\n}` : never}
    Views: ${views.size ? `{\n${viewsSrc}\n}` : never}
    Functions: ${functions.length ? `{\n${functions.join('\n')}\n}` : never}
    Enums: ${enums.size ? `{\n${enumsSrc}\n}` : never}
    CompositeTypes: ${never}
  }
};

type PublicSchema = Database['public'];

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
export type TablesInsert<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Update'];
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export const Constants = {
  public: {
    Enums: {
${constantsSrc}
    },
  },
} as const;
`;
  const config = (await prettier.resolveConfig(fileURLToPath(import.meta.url))) ?? {};
  return prettier.format(src, { ...config, parser: 'typescript' });
}
