import { Profile } from "./types";
import { CNode, ConstellationData } from "./constellation";
import { LATEST_STORAGE_KEY } from "./theme";

/**
 * Lightweight localStorage persistence — no accounts, no database.
 * Everything lives under "constellation:latest".
 */

export interface SavedSky {
  version: 1;
  savedAt: number; // epoch ms
  profile: Profile;
  data: ConstellationData;
}

export function loadSavedSky(): SavedSky | null {
  try {
    const raw = localStorage.getItem(LATEST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedSky;
    if (
      parsed?.version !== 1 ||
      typeof parsed.savedAt !== "number" ||
      !Array.isArray(parsed?.data?.nodes) ||
      !Array.isArray(parsed?.data?.edges) ||
      !Array.isArray(parsed?.profile?.skills) ||
      parsed.data.nodes.length === 0
    )
      return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSky(profile: Profile, data: ConstellationData): SavedSky {
  const saved: SavedSky = { version: 1, savedAt: Date.now(), profile, data };
  try {
    localStorage.setItem(LATEST_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    /* storage full / private mode — non-fatal */
  }
  return saved;
}

export function clearSavedSky() {
  try {
    localStorage.removeItem(LATEST_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Diff two skies by node id → unchanged | new | removed. */
export interface SkyDiff {
  newNodes: CNode[];
  unchangedNodes: CNode[];
  removedNodes: CNode[];
  newIds: Set<string>;
}

export function diffSkies(
  prev: ConstellationData,
  next: ConstellationData
): SkyDiff {
  const prevIds = new Set(prev.nodes.map((n) => n.id));
  const nextIds = new Set(next.nodes.map((n) => n.id));
  const newNodes = next.nodes.filter((n) => !prevIds.has(n.id));
  return {
    newNodes,
    unchangedNodes: next.nodes.filter((n) => prevIds.has(n.id)),
    removedNodes: prev.nodes.filter((n) => !nextIds.has(n.id)),
    newIds: new Set(newNodes.map((n) => n.id)),
  };
}

export function formatSavedDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
