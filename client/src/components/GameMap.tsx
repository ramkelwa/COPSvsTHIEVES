import { useEffect, useMemo, type ReactNode } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Circle, MapContainer, Marker, Polygon, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import type { Boundary, LatLng, SafeZone } from "../lib/types";
import { TILE_ATTRIBUTION, TILE_URL } from "../lib/mapTiles";
import { formatAgo } from "../utils/time";

export interface MapPlayer {
  id: string;
  username: string;
  avatar?: string;
  lat: number;
  lng: number;
  kind: "self" | "police" | "thief" | "unknown" | "decoy";
  accuracy?: number;
  /** Last-report time, shown as "last known". */
  at?: number;
  stale?: boolean;
  note?: string;
}

interface GameMapProps {
  center: LatLng | null;
  zoom?: number;
  boundary?: Boundary | null;
  safeZones?: SafeZone[];
  players?: MapPlayer[];
  className?: string;
  /** Show a ring around the player's own GPS accuracy. */
  showSelfAccuracy?: boolean;
  onMapClick?: (point: LatLng) => void;
  /** Optional polygon preview (used while drawing a boundary). */
  draftPoints?: LatLng[];
  draftCircle?: { center: LatLng; radiusM: number } | null;
  children?: ReactNode;
}

const GLYPHS: Record<MapPlayer["kind"], string> = {
  self: "📍",
  police: "🚔",
  thief: "🥷",
  unknown: "❓",
  decoy: "🎭",
};

const iconCache = new Map<string, L.DivIcon>();

function markerIcon(kind: MapPlayer["kind"], stale?: boolean): L.DivIcon {
  const key = `${kind}-${stale ? "stale" : "fresh"}`;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const icon = L.divIcon({
    className: "cvt-marker-wrap",
    html: `<div class="cvt-marker cvt-marker--${kind}${stale ? " cvt-marker--stale" : ""}">${GLYPHS[kind]}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
  iconCache.set(key, icon);
  return icon;
}

function Recenter({ center, zoom }: { center: LatLng | null; zoom?: number }) {
  const map = useMap();
  useEffect(() => {
    if (!center) return;
    map.setView([center.lat, center.lng], zoom ?? map.getZoom(), { animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lng, zoom]);
  return null;
}

function ClickCatcher({ onClick }: { onClick: (point: LatLng) => void }) {
  useMapEvents({
    click(event) {
      onClick({ lat: event.latlng.lat, lng: event.latlng.lng });
    },
  });
  return null;
}

export function GameMap({
  center,
  zoom = 15,
  boundary,
  safeZones = [],
  players = [],
  className = "h-72 w-full",
  showSelfAccuracy = true,
  onMapClick,
  draftPoints,
  draftCircle,
  children,
}: GameMapProps) {
  const fallback = useMemo<LatLng>(() => center ?? { lat: 20, lng: 0 }, [center]);
  const self = players.find((p) => p.kind === "self");
  const polygonPoints =
    boundary?.type === "polygon" ? boundary.points.map((p) => [p.lat, p.lng] as [number, number]) : null;

  return (
    <div className={`overflow-hidden rounded-2xl border border-white/10 ${className}`}>
      <MapContainer
        center={[fallback.lat, fallback.lng]}
        zoom={zoom}
        scrollWheelZoom
        className="h-full w-full"
        attributionControl
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <Recenter center={center} zoom={zoom} />
        {onMapClick ? <ClickCatcher onClick={onMapClick} /> : null}

        {boundary?.type === "circle" ? (
          <Circle
            center={[boundary.center.lat, boundary.center.lng]}
            radius={boundary.radiusM}
            pathOptions={{ color: "#22d3ee", weight: 2, fillOpacity: 0.05, dashArray: "7 7" }}
          />
        ) : null}

        {polygonPoints ? (
          <Polygon
            positions={polygonPoints}
            pathOptions={{ color: "#22d3ee", weight: 2, fillOpacity: 0.05, dashArray: "7 7" }}
          />
        ) : null}

        {safeZones.map((zone) => (
          <Circle
            key={zone.id}
            center={[zone.lat, zone.lng]}
            radius={zone.radiusM}
            pathOptions={{ color: "#34d399", weight: 1.5, fillOpacity: 0.1 }}
          >
            <Popup>Safe zone · no captures inside</Popup>
          </Circle>
        ))}

        {draftCircle ? (
          <Circle
            center={[draftCircle.center.lat, draftCircle.center.lng]}
            radius={draftCircle.radiusM}
            pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.06 }}
          />
        ) : null}

        {draftPoints && draftPoints.length > 0 ? (
          <>
            <Polygon
              positions={draftPoints.map((p) => [p.lat, p.lng] as [number, number])}
              pathOptions={{ color: "#f59e0b", weight: 2, fillOpacity: 0.06 }}
            />
            {draftPoints.map((p, index) => (
              <Circle
                key={`${p.lat}-${p.lng}-${index}`}
                center={[p.lat, p.lng]}
                radius={4}
                pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 1 }}
              />
            ))}
          </>
        ) : null}

        {showSelfAccuracy && self?.accuracy ? (
          <Circle
            center={[self.lat, self.lng]}
            radius={Math.min(self.accuracy, 500)}
            pathOptions={{ color: "#22d3ee", weight: 1, opacity: 0.4, fillOpacity: 0.06 }}
          />
        ) : null}

        {players.map((player) => (
          <Marker
            key={`${player.kind}-${player.id}`}
            position={[player.lat, player.lng]}
            icon={markerIcon(player.kind, player.stale)}
          >
            <Popup>
              <strong>
                {player.avatar ? `${player.avatar} ` : ""}
                {player.username}
              </strong>
              <br />
              {player.kind === "self"
                ? "You · live GPS"
                : player.kind === "police"
                  ? "Police · last known"
                  : player.kind === "thief"
                    ? "Thief · last known"
                    : player.kind === "decoy"
                      ? "Decoy signal"
                      : "Unidentified signal"}
              {player.accuracy ? (
                <>
                  <br />
                  Accuracy ±{Math.round(player.accuracy)} m
                </>
              ) : null}
              {player.at ? (
                <>
                  <br />
                  Updated {formatAgo(player.at)}
                </>
              ) : null}
              {player.note ? (
                <>
                  <br />
                  {player.note}
                </>
              ) : null}
            </Popup>
          </Marker>
        ))}

        {children}
      </MapContainer>
    </div>
  );
}
