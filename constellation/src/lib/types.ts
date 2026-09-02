export type ExperienceLevel = "student" | "entry" | "mid" | "senior";

export const EXPERIENCE_LEVELS: { id: ExperienceLevel; label: string }[] = [
  { id: "student", label: "Student / Learning" },
  { id: "entry", label: "Entry level" },
  { id: "mid", label: "Mid level" },
  { id: "senior", label: "Senior" },
];

export interface Profile {
  skills: string[];
  interests: string[];
  experience_level: ExperienceLevel;
}

/** Cleans an unknown value into a deduped list of short strings. */
export function sanitizeStringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const clean = item.trim().replace(/\s+/g, " ").slice(0, 40);
    if (clean.length < 2) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
    if (out.length >= max) break;
  }
  return out;
}

export function sanitizeExperienceLevel(value: unknown): ExperienceLevel {
  if (
    value === "student" ||
    value === "entry" ||
    value === "mid" ||
    value === "senior"
  )
    return value;
  return "entry";
}
