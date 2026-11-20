import type { Boundary, LatLng } from "./types.js";

const EARTH_RADIUS_M = 6371008.8;

/** Great-circle distance in metres. */
export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point in polygon using ray casting. Polygon points are {lat,lng} in order. */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Shortest distance in metres from a point to a polygon's edges. */
export function distanceToPolygonEdge(point: LatLng, polygon: LatLng[]): number {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    min = Math.min(min, distanceToSegmentM(point, polygon[j], polygon[i]));
  }
  return min;
}

function distanceToSegmentM(p: LatLng, a: LatLng, b: LatLng): number {
  // Project on a local equirectangular plane; accurate over short distances.
  const latRef = (p.lat * Math.PI) / 180;
  const mPerDegLat = 111132.92;
  const mPerDegLng = 111412.84 * Math.cos(latRef);
  const ax = (a.lng - p.lng) * mPerDegLng;
  const ay = (a.lat - p.lat) * mPerDegLat;
  const bx = (b.lng - p.lng) * mPerDegLng;
  const by = (b.lat - p.lat) * mPerDegLat;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = 0;
  if (lenSq > 0) t = Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(cx, cy);
}

/**
 * How far outside the boundary a point is, in metres. 0 means inside.
 * Uses the reported GPS accuracy as slack so jitter cannot eliminate players.
 */
export function outsideByM(point: LatLng, boundary: Boundary): number {
  if (boundary.type === "circle") {
    return Math.max(0, haversineM(boundary.center, point) - boundary.radiusM);
  }
  if (pointInPolygon(point, boundary.points)) return 0;
  return distanceToPolygonEdge(point, boundary.points);
}

export function withinCircle(point: LatLng, center: LatLng, radiusM: number): boolean {
  return haversineM(point, center) <= radiusM;
}

/** Rough polygon centroid, used to centre host maps. */
export function polygonCenter(points: LatLng[]): LatLng {
  const sum = points.reduce(
    (acc, p) => ({ lat: acc.lat + p.lat, lng: acc.lng + p.lng }),
    { lat: 0, lng: 0 },
  );
  return { lat: sum.lat / points.length, lng: sum.lng / points.length };
}
