const GOOGLE_PLACES_PHOTO =
  "https://maps.googleapis.com/maps/api/place/photo";

export function getPlacePhotoUrl(
  photoReference: string,
  maxWidth = 400
): string {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
  return `${GOOGLE_PLACES_PHOTO}?maxwidth=${maxWidth}&photo_reference=${encodeURIComponent(photoReference)}&key=${key}`;
}
