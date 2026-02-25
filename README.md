# dondecomo

Asistente de recomendaciones de restaurantes para Buenos Aires. Next.js 14 + TypeScript + Tailwind + Supabase + Google Places API.

## Requisitos

- Node.js 18+
- Cuenta Supabase con Google Auth habilitado
- Google Cloud: Places API (Text Search y Place Details) habilitadas y API key

## Configuración

1. **Variables de entorno**  
   Ya está creado `.env.local` con tus claves. Si la clave anónima de Supabase está cortada, pegá la completa desde el dashboard de Supabase (Settings → API).

2. **Supabase – Login con Google**  
   En el dashboard: Authentication → Providers → Google. Activá Google y configurá Client ID y Client Secret de Google Cloud (tipo “Web application”, URL de autorizado: `https://<tu-proyecto>.supabase.co/auth/v1/callback`).

3. **Tabla de favoritos**  
   En Supabase: SQL Editor → New query. Pegá y ejecutá el contenido de `supabase/favoritos.sql`.

4. **Google Cloud**  
   En APIs & Services habilitá “Places API” (y “Maps” si usás mapa). La API key debe tener permisos para Places API.

## Desarrollo

```bash
npm install
npm run dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Rutas

- `/` – Búsqueda en lenguaje natural
- `/restaurante/[placeId]` – Ficha del restaurante
- `/favoritos` – Lista de favoritos (requiere login)
