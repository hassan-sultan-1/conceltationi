import { NextRequest, NextResponse } from "next/server";
import { geminiJSON, hasGeminiKey } from "@/lib/gemini";
import { heuristicExtract } from "@/lib/extract-fallback";
import {
  Profile,
  sanitizeExperienceLevel,
  sanitizeStringList,
} from "@/lib/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_CHARS = 15000;

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();

  if (name.endsWith(".pdf")) {
    // Import the inner module directly — pdf-parse's index.js runs debug code.
    const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
    // Pass a plain Uint8Array: pdf.js misreads Node Buffers in some runtimes
    // (pooled-buffer byteOffset handling), which corrupts stream offsets.
    const result = await pdfParse(new Uint8Array(arrayBuffer) as unknown as Buffer);
    return result.text ?? "";
  }
  if (name.endsWith(".docx")) {
    const mammoth = (await import("mammoth")).default;
    const result = await mammoth.extractRawText({
      buffer: Buffer.from(arrayBuffer),
    });
    return result.value ?? "";
  }
  throw new Error("UNSUPPORTED_TYPE");
}

function buildPrompt(cvText: string): string {
  return `You extract structured career data from CV/resume text.

Respond with ONLY a JSON object in exactly this shape:
{"skills": string[], "interests": string[], "experience_level": "student" | "entry" | "mid" | "senior"}

Rules:
- Extract ONLY what is actually present in the text. Never invent or embellish.
- "skills": 3-12 concise skill names (1-3 words each, e.g. "Python", "UX Design", "Public Speaking"). Include both technical and soft skills if present.
- "interests": up to 8 items, taken from explicit hobbies/interests sections or clearly stated passions. If none are stated, return [].
- "experience_level": judge from roles, titles, and years of experience. A current student or fresh graduate with internships only is "student"; <3 years professional work is "entry"; 3-7 years is "mid"; 7+ years or senior/lead titles is "senior".

CV TEXT:
"""
${cvText}
"""`;
}

function sanitizeProfile(raw: unknown): Profile {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    skills: sanitizeStringList(obj.skills, 12),
    interests: sanitizeStringList(obj.interests, 8),
    experience_level: sanitizeExperienceLevel(obj.experience_level),
  };
}

export async function POST(req: NextRequest) {
  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    return errorResponse("Invalid upload. Please try again.");
  }

  if (!file) return errorResponse("No file received. Please try again.");
  if (file.size === 0) return errorResponse("That file appears to be empty.");
  if (file.size > MAX_FILE_BYTES)
    return errorResponse("File is larger than 5MB. Please upload a smaller CV.", 413);

  const name = file.name.toLowerCase();
  if (!name.endsWith(".pdf") && !name.endsWith(".docx"))
    return errorResponse("Unsupported format. Please upload a PDF or DOCX file.", 415);

  // --- Extract raw text ---
  let text = "";
  try {
    text = await extractText(file);
  } catch {
    return errorResponse(
      "We couldn't read that file. It may be corrupted or image-only — try a text-based PDF or DOCX.",
      422
    );
  }

  text = text.replace(/\s+/g, " ").trim();
  if (text.length < 80)
    return errorResponse(
      "We couldn't find enough readable text in that file. If it's a scanned/image CV, try the questions flow instead.",
      422
    );
  if (text.length > MAX_TEXT_CHARS) text = text.slice(0, MAX_TEXT_CHARS);

  // --- AI extraction (retry once), heuristic fallback ---
  if (hasGeminiKey()) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const raw = await geminiJSON<unknown>(buildPrompt(text), {
          temperature: 0.2,
        });
        const profile = sanitizeProfile(raw);
        if (profile.skills.length > 0) {
          return NextResponse.json({ profile });
        }
      } catch {
        // fall through to retry / fallback
      }
    }
    const fallback = heuristicExtract(text);
    if (fallback.skills.length > 0) {
      return NextResponse.json({
        profile: fallback,
        note: "AI extraction was unavailable, so we did a quick local scan — please review the chips below carefully.",
      });
    }
    return errorResponse(
      "The AI reader is temporarily unavailable and we couldn't scan your CV locally. Please try again or use the questions flow.",
      503
    );
  }

  // No API key configured — local scan keeps the app demoable.
  const fallback = heuristicExtract(text);
  if (fallback.skills.length === 0)
    return errorResponse(
      "We couldn't identify skills in this CV. Try the questions flow instead.",
      422
    );
  return NextResponse.json({
    profile: fallback,
    note: "Gemini API key not configured — used a quick local scan. Add GEMINI_API_KEY for full AI extraction.",
  });
}
