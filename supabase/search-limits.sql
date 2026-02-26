-- Ejecutar en Supabase SQL Editor
-- Crea un contador histórico de búsquedas por usuario.

create table if not exists public.user_search_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  search_count integer not null default 0,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.user_search_limits enable row level security;

-- Lectura propia opcional para debugging desde el cliente autenticado.
drop policy if exists "read_own_search_limits" on public.user_search_limits;
create policy "read_own_search_limits"
  on public.user_search_limits
  for select
  using (auth.uid() = user_id);

-- Escritura directa desde cliente bloqueada; los updates los hace el backend con service role.
drop policy if exists "no_client_write_search_limits" on public.user_search_limits;
create policy "no_client_write_search_limits"
  on public.user_search_limits
  for all
  using (false)
  with check (false);

notify pgrst, 'reload schema';

