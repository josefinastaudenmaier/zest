-- Si la tabla lugares ya existe pero le faltan columnas, ejecutá esto en Supabase (SQL Editor).
-- Después ejecutá: npm run importar-resenas

alter table public.lugares add column if not exists nombre text;
alter table public.lugares add column if not exists direccion text;
alter table public.lugares add column if not exists ciudad text;
alter table public.lugares add column if not exists pais text;
alter table public.lugares add column if not exists lat numeric;
alter table public.lugares add column if not exists lng numeric;
alter table public.lugares add column if not exists google_maps_url text;
alter table public.lugares add column if not exists five_star_rating_published integer;
alter table public.lugares add column if not exists tipo_comida text;
alter table public.lugares add column if not exists questions jsonb default '[]'::jsonb;
alter table public.lugares add column if not exists review_text_published text;
alter table public.lugares add column if not exists fecha_resena timestamptz;

notify pgrst, 'reload schema';
