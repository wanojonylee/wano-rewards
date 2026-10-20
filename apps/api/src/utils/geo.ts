/** Distance helpers (Haversine, meters). */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const earthRadius = 6_371_000;
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * earthRadius * Math.asin(Math.sqrt(h)));
}

export function parseCoord(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}
