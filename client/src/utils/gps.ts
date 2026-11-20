export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export type AccuracyLevel = "excellent" | "good" | "moderate" | "poor";

/** Official status bands shown on the GPS check screen. */
export function accuracyLevel(accuracy: number): AccuracyLevel {
  if (accuracy <= 10) return "excellent";
  if (accuracy <= 25) return "good";
  if (accuracy <= 50) return "moderate";
  return "poor";
}

export const ACCURACY_META: Record<
  AccuracyLevel,
  { label: string; text: string; bg: string; border: string; dot: string; help: string }
> = {
  excellent: {
    label: "Excellent",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/40",
    dot: "bg-emerald-400",
    help: "Within 10 m — great conditions for a fair match.",
  },
  good: {
    label: "Good",
    text: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
    help: "11–25 m — acceptable for play.",
  },
  moderate: {
    label: "Moderate",
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    help: "26–50 m — usable, but captures may need a little extra distance.",
  },
  poor: {
    label: "Poor",
    text: "text-rose-300",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    dot: "bg-rose-400",
    help: "Above 50 m — step outside or away from buildings and check again.",
  },
};

export function toFix(position: GeolocationPosition): GeoFix {
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp || Date.now(),
  };
}

export function geoErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission was denied. Enable it for this site in your browser settings, then retry.";
    case error.POSITION_UNAVAILABLE:
      return "Your device could not determine a position. Check that location services are turned on.";
    case error.TIMEOUT:
      return "Getting a GPS fix timed out. Move to open sky and try again.";
    default:
      return "An unknown GPS error occurred.";
  }
}

export const GEO_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 20_000,
};

const GPS_ACCURACY_TARGET_M = 50;

/** Collect updates until a usable fix arrives or the location request times out. */
export function requestFix(options: PositionOptions = GEO_OPTIONS): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported by this browser."));
      return;
    }

    let bestFix: GeoFix | null = null;
    let watchId: number | null = null;
    let settled = false;
    const timeoutMs = options.timeout ?? GEO_OPTIONS.timeout ?? 20_000;
    const timer = window.setTimeout(
      () => finish(new Error("Getting a GPS fix timed out. Move to open sky and try again.")),
      timeoutMs,
    );

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (bestFix) resolve(bestFix);
      else reject(error ?? new Error("Could not get a GPS fix."));
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const fix = toFix(position);
        if (!bestFix || fix.accuracy < bestFix.accuracy) bestFix = fix;
        if (bestFix.accuracy <= GPS_ACCURACY_TARGET_M) finish();
      },
      (error) => finish(new Error(geoErrorMessage(error))),
      options,
    );
  });
}

/** Best-effort permission state for the consent screen. */
export async function locationPermissionState(): Promise<PermissionState | "unsupported"> {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unsupported";
  try {
    const status = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return status.state;
  } catch {
    return "unsupported";
  }
}
