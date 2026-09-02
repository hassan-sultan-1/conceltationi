import { NextRequest, NextResponse } from "next/server";
import { ChatTurn, geminiChat, hasGeminiKey } from "@/lib/gemini";
import {
  Profile,
  sanitizeExperienceLevel,
  sanitizeStringList,
} from "@/lib/types";
import { CNode } from "@/lib/constellation";

export const runtime = "nodejs";

const MAX_MESSAGE_CHARS = 600;
const MAX_HISTORY_TURNS = 12;

function buildSystemPrompt(profile: Profile, nodes: CNode[]): string {
  const byType = (t: string) =>
    nodes
      .filter((n) => n.type === t)
      .sort((a, b) => b.brightness - a.brightness)
      .map((n) => `${n.label} (fit ${(n.brightness * 100) | 0}%)`)
      .join(", ");

  return `You are the "Sky Guide" — the in-app career assistant of Constellation, an app that turned this user's profile into a night-sky map of career paths. You have their FULL results below; ground every answer in them. Never give generic advice when you can reference their actual skills, interests, or stars.

USER PROFILE
- Skills: ${profile.skills.join(", ")}
- Interests: ${profile.interests.length ? profile.interests.join(", ") : "(none given)"}
- Experience level: ${profile.experience_level}

THEIR CONSTELLATION
- Core skills (their anchor stars): ${byType("core_skill") || "—"}
- Career paths: ${byType("career") || "—"}
- Stretch careers (ambitious reaches): ${byType("stretch_career") || "—"}

Style rules:
- Concise: under 160 words unless comparing multiple paths (then up to 220).
- Warm, direct, practical. Address the user as "you". Occasional light star/sky metaphor is welcome, never overdone.
- Plain text only — no markdown headers or bold. Use simple "-" bullets when listing.
- If asked something unrelated to careers/learning/this constellation, gently steer back.
- If asked to compare paths, compare the specific ones in THEIR sky using fit %, shared skills, and their experience level.`;
}

function fallbackReply(profile: Profile, nodes: CNode[]): string {
  const top = nodes
    .filter((n) => n.type === "career")
    .sort((a, b) => b.brightness - a.brightness)
    .slice(0, 3)
    .map((n) => n.label);
  return `I need a configured Gemini API key to chat properly — ask the app owner to add GEMINI_API_KEY.\n\nWhat I can tell you from your sky right now: your brightest career stars are ${top.join(", ") || "still being charted"}, built on ${profile.skills.slice(0, 3).join(", ")}. Click any star for a detailed breakdown — that works even without me.`;
}

export async function POST(req: NextRequest) {
  let message = "";
  let history: ChatTurn[] = [];
  let profile: Profile;
  let nodes: CNode[] = [];

  try {
    const body = await req.json();
    message =
      typeof body?.message === "string"
        ? body.message.trim().slice(0, MAX_MESSAGE_CHARS)
        : "";
    profile = {
      skills: sanitizeStringList(body?.profile?.skills, 15),
      interests: sanitizeStringList(body?.profile?.interests, 8),
      experience_level: sanitizeExperienceLevel(body?.profile?.experience_level),
    };
    if (Array.isArray(body?.nodes)) {
      nodes = (body.nodes as unknown[])
        .map((n) => n as Record<string, unknown>)
        .filter(
          (n) =>
            typeof n.label === "string" &&
            (n.type === "core_skill" ||
              n.type === "career" ||
              n.type === "stretch_career")
        )
        .slice(0, 20)
        .map((n) => ({
          id: typeof n.id === "string" ? n.id : "",
          label: (n.label as string).slice(0, 60),
          type: n.type as CNode["type"],
          brightness:
            typeof n.brightness === "number"
              ? Math.min(1, Math.max(0, n.brightness))
              : 0.7,
        }));
    }
    if (Array.isArray(body?.history)) {
      history = (body.history as unknown[])
        .map((t) => t as Record<string, unknown>)
        .filter(
          (t) =>
            (t.role === "user" || t.role === "model") &&
            typeof t.text === "string" &&
            t.text.trim()
        )
        .slice(-MAX_HISTORY_TURNS)
        .map((t) => ({
          role: t.role as "user" | "model",
          text: (t.text as string).slice(0, 1200),
        }));
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!message)
    return NextResponse.json({ error: "Message is empty." }, { status: 400 });
  if (profile.skills.length === 0 || nodes.length === 0)
    return NextResponse.json(
      { error: "Missing constellation context." },
      { status: 400 }
    );

  if (!hasGeminiKey())
    return NextResponse.json({ reply: fallbackReply(profile, nodes) });

  // Ensure history alternates sanely and ends before the new user message.
  const turns: ChatTurn[] = [...history, { role: "user", text: message }];

  try {
    const reply = await geminiChat(buildSystemPrompt(profile, nodes), turns);
    return NextResponse.json({ reply: reply.slice(0, 4000) });
  } catch {
    return NextResponse.json(
      {
        error:
          "The Sky Guide couldn't reach the stars just now. Give it a moment and try again.",
      },
      { status: 503 }
    );
  }
}
