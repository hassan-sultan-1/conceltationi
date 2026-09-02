import { NextRequest, NextResponse } from "next/server";
import { geminiJSON, hasGeminiKey } from "@/lib/gemini";
import { validateConstellation } from "@/lib/constellation";
import { fallbackConstellation } from "@/lib/constellation-fallback";
import {
  Profile,
  sanitizeExperienceLevel,
  sanitizeStringList,
} from "@/lib/types";

export const runtime = "nodejs";

function buildPrompt(profile: Profile): string {
  return `You are a career-guidance engine that maps a person's profile into a "career constellation" graph.

USER PROFILE
- Skills: ${profile.skills.join(", ")}
- Interests: ${profile.interests.length ? profile.interests.join(", ") : "(none given)"}
- Experience level: ${profile.experience_level}

Respond with ONLY a JSON object in exactly this shape:
{
  "nodes": [{"id": string, "label": string, "type": "core_skill" | "career" | "stretch_career", "brightness": number}],
  "edges": [{"from": string, "to": string, "strength": number}]
}

Rules:
- Exactly 3-5 "core_skill" nodes: chosen from the user's ACTUAL listed skills (the most career-defining ones). Labels must closely match their wording.
- Exactly 4-6 "career" nodes: realistic, specific career paths that genuinely fit the skills, interests, and experience level. Prefer paths where their interests intersect their skills.
- Exactly 2-3 "stretch_career" nodes: ambitious but plausibly reachable paths that would require growth beyond current skills.
- "id": short kebab-case slug unique per node (e.g. "ux-designer").
- "brightness": 0.4-1.0 — how strongly this node fits the user (1.0 = strongest).
- "edges": connect each career node to the 2-3 core_skill nodes that justify it. Connect each stretch_career node to at least one career or core_skill node that is its launching point. "strength": 0.2-1.0 for how direct the connection is.
- CRITICAL: every career and stretch_career node must be reachable from at least one core_skill node by following edges. No orphan or isolated nodes.
- Do not invent skills the user never mentioned as core_skill nodes.`;
}

export async function POST(req: NextRequest) {
  let profile: Profile;
  try {
    const body = await req.json();
    profile = {
      skills: sanitizeStringList(body?.skills, 15),
      interests: sanitizeStringList(body?.interests, 8),
      experience_level: sanitizeExperienceLevel(body?.experience_level),
    };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (profile.skills.length < 2)
    return NextResponse.json(
      { error: "At least 2 skills are needed to chart a constellation." },
      { status: 400 }
    );

  if (hasGeminiKey()) {
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await geminiJSON<unknown>(buildPrompt(profile), {
          temperature: attempt === 0 ? 0.7 : 0.4,
        });
        const result = validateConstellation(raw);
        if (result.ok) return NextResponse.json({ constellation: result.data });
        lastError = result.error;
      } catch (err) {
        lastError = err instanceof Error ? err.message : "unknown error";
      }
    }
    // Both attempts failed — degrade gracefully rather than dead-end.
    console.error("generate-constellation: falling back —", lastError);
    const fallback = validateConstellation(fallbackConstellation(profile));
    if (fallback.ok)
      return NextResponse.json({
        constellation: fallback.data,
        note: "The AI generator was temporarily unavailable, so this sky was charted with a local engine. Regenerate later for a fully personalized map.",
      });
    return NextResponse.json(
      { error: "We couldn't chart your constellation right now. Please try again in a moment." },
      { status: 503 }
    );
  }

  // No API key — local engine keeps the app demoable.
  const fallback = validateConstellation(fallbackConstellation(profile));
  if (fallback.ok)
    return NextResponse.json({
      constellation: fallback.data,
      note: "Gemini API key not configured — this sky was charted with the local demo engine. Add GEMINI_API_KEY for fully personalized results.",
    });
  return NextResponse.json(
    { error: "We couldn't chart a constellation from this profile. Try adding a few more skills." },
    { status: 422 }
  );
}
