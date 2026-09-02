import { NextRequest, NextResponse } from "next/server";
import { geminiChat, hasGeminiKey } from "@/lib/gemini";
import {
  Profile,
  sanitizeExperienceLevel,
  sanitizeStringList,
} from "@/lib/types";

export const runtime = "nodejs";

interface LiteNode {
  label: string;
  type: string;
  brightness: number;
}

function fallbackSummary(profile: Profile, careers: string[], stretch: string[]): string {
  const top = careers.slice(0, 3);
  return `I mapped my skills into a career constellation ✨ My brightest paths: ${top.join(", ")}${
    stretch.length ? ` — with ${stretch[0]} as my stretch star` : ""
  }. Built on ${profile.skills.slice(0, 3).join(", ")}. Where's your sky pointing?`;
}

export async function POST(req: NextRequest) {
  let profile: Profile;
  let nodes: LiteNode[] = [];
  try {
    const body = await req.json();
    profile = {
      skills: sanitizeStringList(body?.profile?.skills, 15),
      interests: sanitizeStringList(body?.profile?.interests, 8),
      experience_level: sanitizeExperienceLevel(body?.profile?.experience_level),
    };
    if (Array.isArray(body?.nodes)) {
      nodes = (body.nodes as Record<string, unknown>[])
        .filter((n) => typeof n.label === "string" && typeof n.type === "string")
        .slice(0, 20)
        .map((n) => ({
          label: (n.label as string).slice(0, 60),
          type: n.type as string,
          brightness: typeof n.brightness === "number" ? n.brightness : 0.7,
        }));
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const careers = nodes
    .filter((n) => n.type === "career")
    .sort((a, b) => b.brightness - a.brightness)
    .map((n) => n.label);
  const stretch = nodes
    .filter((n) => n.type === "stretch_career")
    .sort((a, b) => b.brightness - a.brightness)
    .map((n) => n.label);

  if (profile.skills.length === 0 || careers.length === 0)
    return NextResponse.json({ error: "Missing constellation context." }, { status: 400 });

  if (!hasGeminiKey())
    return NextResponse.json({ summary: fallbackSummary(profile, careers, stretch) });

  try {
    const prompt = `Write a short, first-person social-media blurb (LinkedIn-friendly) for someone sharing their AI-generated "career constellation" results.

Their top career matches (best first): ${careers.slice(0, 4).join(", ")}
Stretch paths: ${stretch.join(", ") || "none"}
Built on skills: ${profile.skills.slice(0, 5).join(", ")}
Experience level: ${profile.experience_level}

Rules: max 55 words, 1-3 sentences, warm and confident but not cringe, at most one star/sky metaphor and 1-2 emojis. Mention 2-3 of the career matches by name. No hashtags, no quotes around the text, plain text only.`;
    const summary = await geminiChat("You write concise, likeable social blurbs.", [
      { role: "user", text: prompt },
    ]);
    return NextResponse.json({ summary: summary.slice(0, 500) });
  } catch {
    // Never fail a share action — fall back to the template.
    return NextResponse.json({ summary: fallbackSummary(profile, careers, stretch) });
  }
}
