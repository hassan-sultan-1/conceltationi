import { NextRequest, NextResponse } from "next/server";
import { geminiJSON, hasGeminiKey } from "@/lib/gemini";
import {
  Profile,
  sanitizeExperienceLevel,
  sanitizeStringList,
} from "@/lib/types";

export const runtime = "nodejs";

export interface StarDetail {
  why_it_fits: string;
  next_steps: string[];
  resource_suggestion: string;
}

const LEVEL_LABEL: Record<string, string> = {
  student: "a student / still learning",
  entry: "early-career",
  mid: "mid-career",
  senior: "senior",
};

function buildPrompt(
  label: string,
  type: string,
  profile: Profile,
  connectedSkills: string[]
): string {
  const kind =
    type === "core_skill"
      ? "one of their core skills"
      : type === "stretch_career"
        ? "an ambitious stretch career path for them"
        : "a career path that fits them";
  return `You are a warm, practical career mentor. The user's profile:
- Skills: ${profile.skills.join(", ")}
- Interests: ${profile.interests.length ? profile.interests.join(", ") : "(none given)"}
- Experience: ${LEVEL_LABEL[profile.experience_level] ?? profile.experience_level}

They clicked the star "${label}" in their career constellation — it is ${kind}.${
    connectedSkills.length
      ? ` In the graph it connects to their skills: ${connectedSkills.join(", ")}.`
      : ""
  }

Respond with ONLY a JSON object:
{"why_it_fits": string, "next_steps": string[], "resource_suggestion": string}

Rules:
- "why_it_fits": 2-3 sentences, personal and specific — reference their actual skills/interests, never generic filler. Address the user as "you".
- "next_steps": exactly 3-4 concrete, ordered actions appropriate to their experience level. Each one short (max ~15 words) and actionable this month, not someday.
- "resource_suggestion": ONE specific, real, currently-existing resource (a well-known course, book, site, or community) with a few words on why. No made-up URLs.`;
}

function sanitizeDetail(raw: unknown): StarDetail | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const why =
    typeof obj.why_it_fits === "string" ? obj.why_it_fits.trim().slice(0, 700) : "";
  const steps = sanitizeStringList(obj.next_steps, 4).map((s) => s.slice(0, 160));
  const resource =
    typeof obj.resource_suggestion === "string"
      ? obj.resource_suggestion.trim().slice(0, 300)
      : "";
  if (why.length < 20 || steps.length < 3 || resource.length < 10) return null;
  return { why_it_fits: why, next_steps: steps, resource_suggestion: resource };
}

function fallbackDetail(
  label: string,
  type: string,
  profile: Profile,
  connectedSkills: string[]
): StarDetail {
  const anchors = (connectedSkills.length ? connectedSkills : profile.skills).slice(0, 2);
  const why =
    type === "core_skill"
      ? `${label} is one of the anchor points of your sky — several of your possible career paths draw their light from it. Strengthening it raises the brightness of everything connected to it.`
      : `${label} sits in your sky because it builds directly on ${anchors.join(" and ")}. From where you are now (${LEVEL_LABEL[profile.experience_level] ?? profile.experience_level}), it's a path where what you already know keeps compounding.`;
  return {
    why_it_fits: why,
    next_steps: [
      `Spend 30 minutes reading a "day in the life" of a ${label}.`,
      `Build one tiny project or artifact that uses ${anchors[0] ?? "your top skill"}.`,
      `Find two people doing ${label} work on LinkedIn and study their journey.`,
      "Block one hour weekly to practice — consistency beats intensity.",
    ],
    resource_suggestion: `Search Coursera or YouTube for a beginner-friendly "${label}" roadmap — pick the most recent one with strong reviews and follow just that.`,
  };
}

export async function POST(req: NextRequest) {
  let label = "";
  let type = "career";
  let profile: Profile;
  let connectedSkills: string[] = [];
  try {
    const body = await req.json();
    label = typeof body?.node?.label === "string" ? body.node.label.trim().slice(0, 60) : "";
    type = typeof body?.node?.type === "string" ? body.node.type : "career";
    connectedSkills = sanitizeStringList(body?.connected_skills, 5);
    profile = {
      skills: sanitizeStringList(body?.profile?.skills, 15),
      interests: sanitizeStringList(body?.profile?.interests, 8),
      experience_level: sanitizeExperienceLevel(body?.profile?.experience_level),
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!label || profile.skills.length === 0)
    return NextResponse.json({ error: "Missing star or profile data." }, { status: 400 });

  if (hasGeminiKey()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await geminiJSON<unknown>(
          buildPrompt(label, type, profile, connectedSkills),
          { temperature: 0.7 }
        );
        const detail = sanitizeDetail(raw);
        if (detail) return NextResponse.json({ detail });
      } catch {
        // retry, then fall back
      }
    }
    return NextResponse.json({
      detail: fallbackDetail(label, type, profile, connectedSkills),
      note: "The AI mentor was briefly unreachable — this is a locally drafted overview.",
    });
  }

  return NextResponse.json({
    detail: fallbackDetail(label, type, profile, connectedSkills),
    note: "Gemini API key not configured — showing a locally drafted overview.",
  });
}
