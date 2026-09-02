/**
 * Server-side Gemini helper. The API key is read from process.env only —
 * this module must never be imported from client components.
 */

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

export function hasGeminiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  return !!key && key !== "your_gemini_api_key_here";
}

export class GeminiError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

/**
 * Calls Gemini with JSON output mode and parses the response.
 * Throws GeminiError on transport/parse failure so callers can retry or fall back.
 */
export async function geminiJSON<T>(
  prompt: string,
  options: { temperature?: number } = {}
): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.4,
        response_mime_type: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GeminiError(
      `Gemini request failed (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiError("Gemini returned an empty response");

  // Strip accidental code fences before parsing.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiError("Gemini returned invalid JSON");
  }
}

export interface ChatTurn {
  role: "user" | "model";
  text: string;
}

/**
 * Conversational call: system instruction + prior turns + latest user message.
 * Returns plain text.
 */
export async function geminiChat(
  system: string,
  turns: ChatTurn[],
  options: { temperature?: number } = {}
): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new GeminiError("GEMINI_API_KEY is not configured");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": key,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: turns.map((t) => ({
        role: t.role,
        parts: [{ text: t.text }],
      })),
      generationConfig: { temperature: options.temperature ?? 0.7 },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new GeminiError(
      `Gemini request failed (${res.status}): ${body.slice(0, 300)}`,
      res.status
    );
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim())
    throw new GeminiError("Gemini returned an empty response");
  return text.trim();
}
