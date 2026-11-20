export const TILE_URL =
  import.meta.env.VITE_MAP_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Reasonable zoom for a neighbourhood-sized play area. */
export function zoomForRadius(radiusM: number): number {
  if (radiusM > 8000) return 11;
  if (radiusM > 3000) return 12;
  if (radiusM > 1500) return 13;
  if (radiusM > 600) return 14;
  if (radiusM > 250) return 15;
  return 16;
}
