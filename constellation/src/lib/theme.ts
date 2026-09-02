export type ThemeId = "nebula" | "solar" | "aurora";

export const THEMES: { id: ThemeId; label: string; swatch: string }[] = [
  { id: "nebula", label: "Nebula Violet", swatch: "#a78bfa" },
  { id: "solar", label: "Solar Amber", swatch: "#fbbf24" },
  { id: "aurora", label: "Aurora Teal", swatch: "#2dd4bf" },
];

export const THEME_STORAGE_KEY = "constellation:theme";
export const LATEST_STORAGE_KEY = "constellation:latest";

export function applyTheme(theme: ThemeId) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* private mode etc. — non-fatal */
  }
}

export function getStoredTheme(): ThemeId {
  try {
    const t = localStorage.getItem(THEME_STORAGE_KEY);
    if (t === "nebula" || t === "solar" || t === "aurora") return t;
  } catch {
    /* ignore */
  }
  return "nebula";
}
