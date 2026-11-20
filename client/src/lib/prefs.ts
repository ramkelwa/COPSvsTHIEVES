import type { LatLng } from "./types";

export interface MatchPrefs {
  scanCooldownSec: number;
  policeRevealSec: number;
  captureRadiusM: number;
  maxAccuracyM: number;
  boundaryGraceSec: number;
  boundaryRadiusM: number;
  durationSec: number;
}

export const DEFAULT_PREFS: MatchPrefs = {
  scanCooldownSec: 30,
  policeRevealSec: 90,
  captureRadiusM: 20,
  maxAccuracyM: 50,
  boundaryGraceSec: 20,
  boundaryRadiusM: 300,
  durationSec: 15 * 60,
};

const PREFS_KEY = "cvt.prefs.v1";
const CENTER_KEY = "cvt.lastCenter.v1";

export function loadPrefs(): MatchPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<MatchPrefs>;
    const merged = { ...DEFAULT_PREFS };
    for (const key of Object.keys(DEFAULT_PREFS) as (keyof MatchPrefs)[]) {
      const value = parsed[key];
      if (typeof value === "number" && Number.isFinite(value)) merged[key] = value;
    }
    return merged;
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(patch: Partial<MatchPrefs>): MatchPrefs {
  const next = { ...loadPrefs(), ...patch };
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage failures */
  }
  return next;
}

export function lastCenter(): LatLng | null {
  try {
    const raw = localStorage.getItem(CENTER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LatLng;
    if (Number.isFinite(parsed?.lat) && Number.isFinite(parsed?.lng)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function saveLastCenter(center: LatLng): void {
  try {
    localStorage.setItem(CENTER_KEY, JSON.stringify(center));
  } catch {
    /* ignore */
  }
}
