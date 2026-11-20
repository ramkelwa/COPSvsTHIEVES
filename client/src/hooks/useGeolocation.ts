import { useEffect, useState } from "react";
import { GEO_OPTIONS, geoErrorMessage, type GeoFix } from "../utils/gps";

/**
 * Live GPS watcher. Only enabled during an active match so the browser
 * location indicator is visible exactly when tracking is happening.
 */
export function useGeolocation(enabled: boolean) {
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [supported] = useState(
    () => typeof navigator !== "undefined" && "geolocation" in navigator,
  );

  useEffect(() => {
    if (!enabled || !supported) return;
    const id = navigator.geolocation.watchPosition(
      (position) => {
        setError(null);
        setFix({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp || Date.now(),
        });
      },
      (err) => setError(geoErrorMessage(err)),
      GEO_OPTIONS,
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled, supported]);

  return { fix, error, supported };
}
