-- Ejecutá este script en el SQL Editor de tu proyecto Supabase
-- Dashboard → SQL Editor → New query → Pegar y Run

create table if not exists public.lugares (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  direccion text,
  ciudad text,
  pais text,
  lat numeric,
  lng numeric,
  google_maps_url text,
  five_star_rating_published integer,
  tipo_comida text,
  questions jsonb default '[]'::jsonb,
  review_text_published text,
  fecha_resena timestamptz,
  created_at timestamptz default now()
);

grant usage on schema public to anon, authenticated, service_role;
grant all on public.lugares to anon, authenticated, service_role;

notify pgrst, 'reload schema';

-- Si ya tenés la tabla sin alguna columna, ejecutá:
-- alter table public.lugares add column if not exists tipo_comida text;
-- alter table public.lugares add column if not exists lat numeric;
-- alter table public.lugares add column if not exists lng numeric;
-- alter table public.lugares add column if not exists questions jsonb default '[]'::jsonb;
