export interface PlaceResult {
  place_id: string;
  name: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  price_level?: number;
  opening_hours?: { open_now?: boolean };
  photos?: Array<{ photo_reference: string; width: number; height: number }>;
  /** URL lista para mostrar (generada en servidor); evita depender de la API key en el cliente. */
  photoUrl?: string;
  types?: string[];
  geometry?: { location: { lat: number; lng: number } };
  vicinity?: string;
  /** Reseña personal (Supabase lugares); usada para filtros semánticos. */
  resena_personal?: string;
  /** Chips extraídos de questions (tipo comida, ruido, reserva). */
  chips?: Array<{ label: string; icon: string }>;
  /** Enlace a Google Maps; al tocar la card se abre en nueva pestaña. */
  google_maps_url?: string;
  ciudad?: string;
  pais?: string;
}

export interface PlaceDetail extends PlaceResult {
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  url?: string;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
    relative_time_description: string;
  }>;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
}
