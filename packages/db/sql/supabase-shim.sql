-- Shim compatible con Supabase para probar migraciones y RLS contra un
-- PostgreSQL 17 local sin Docker (D-17). No es una migración: en un proyecto
-- Supabase real todo esto ya existe. Se aplica a una base de pruebas vacía
-- antes de `supabase/migrations/`.
--
-- Reproduce lo que las migraciones usan de Supabase:
--   - los roles anon, authenticated y service_role (este último con BYPASSRLS);
--   - el esquema auth con auth.users (sólo las columnas que referenciamos),
--     auth.uid(), auth.jwt() y auth.role() leyendo request.jwt.claims, como
--     hace PostgREST;
--   - los privilegios por defecto del esquema public, que en Supabase conceden
--     todo a anon, authenticated y service_role. Así las pruebas comprueban
--     que cada migración revoca y concede de forma explícita.
--
-- Los roles son globales del servidor: se crean si faltan y no se borran
-- (NOLOGIN, sin objetos propios). Nada de esto toca otras bases.

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated', 'service_role'] loop
    if not exists (select 1 from pg_roles where rolname = r) then
      begin
        execute format('create role %I nologin noinherit', r);
      exception when duplicate_object or unique_violation then
        null; -- otra ejecución en paralelo lo creó
      end;
    end if;
  end loop;
end
$$;

alter role service_role bypassrls;

create schema if not exists auth;
create schema if not exists extensions;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  is_anonymous boolean not null default false,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
-- El bloqueo de una cuenta (Supabase Auth; la papelera de socios, plan 020 T230).
alter table auth.users add column if not exists banned_until timestamptz;

create or replace function auth.jwt() returns jsonb
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

create or replace function auth.uid() returns uuid
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema extensions to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant all on auth.users to service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
