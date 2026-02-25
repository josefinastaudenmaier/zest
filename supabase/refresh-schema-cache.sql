-- Si la API sigue diciendo "Could not find the table 'public.favoritos' in the schema cache",
-- ejecutá este script en Supabase → SQL Editor → New query.

-- Opción 1: Recarga estándar
notify pgrst, 'reload schema';

-- Si no alcanza, ejecutá también (en la misma u otra query) la opción 2:

-- Opción 2: Refrescar cola de notificaciones y volver a avisar
-- select pg_notification_queue_usage();
-- notify pgrst, 'reload schema';

-- Después de Run, esperá 10–15 segundos y probá de nuevo guardar un favorito.
-- Si sigue fallando: Dashboard → Settings → General → Restart project (reiniciar el proyecto).