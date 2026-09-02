import { ExperienceLevel, Profile } from "./types";

/**
 * Keyword-based CV extraction used as a graceful fallback when the Gemini
 * API is unavailable or unconfigured. Only surfaces terms actually present
 * in the text — never invents.
 */

const SKILL_KEYWORDS = [
  "python", "javascript", "typescript", "java", "c++", "c#", "go", "rust",
  "react", "next.js", "node.js", "vue", "angular", "svelte", "flutter",
  "html", "css", "tailwind", "sql", "postgresql", "mysql", "mongodb",
  "firebase", "aws", "azure", "gcp", "docker", "kubernetes", "git",
  "machine learning", "deep learning", "data analysis", "data science",
  "pandas", "numpy", "tensorflow", "pytorch", "nlp", "computer vision",
  "figma", "photoshop", "illustrator", "ui design", "ux design",
  "graphic design", "wireframing", "prototyping",
  "excel", "power bi", "tableau", "accounting", "financial analysis",
  "project management", "agile", "scrum", "product management",
  "marketing", "seo", "content writing", "copywriting", "social media",
  "public speaking", "leadership", "teamwork", "communication",
  "customer service", "sales", "negotiation", "research", "teaching",
];

const INTEREST_KEYWORDS = [
  "artificial intelligence", "ai", "robotics", "gaming", "game development",
  "photography", "music", "reading", "writing", "blogging", "travel",
  "volunteering", "sports", "cricket", "football", "chess", "hiking",
  "startups", "entrepreneurship", "fintech", "healthcare", "education",
  "sustainability", "climate", "space", "astronomy", "design", "art",
  "film", "animation", "open source", "cybersecurity", "blockchain",
];

function findKeywords(text: string, keywords: string[], max: number): string[] {
  const lower = text.toLowerCase();
  const found: string[] = [];
  for (const kw of keywords) {
    const pattern = new RegExp(
      `(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`,
      "i"
    );
    if (pattern.test(lower)) {
      found.push(
        kw.length <= 3
          ? kw.toUpperCase()
          : kw.replace(/\b\w/g, (c) => c.toUpperCase())
      );
      if (found.length >= max) break;
    }
  }
  return found;
}

function guessExperienceLevel(text: string): ExperienceLevel {
  const lower = text.toLowerCase();
  if (/\b(senior|lead|principal|head of|director|manager)\b/.test(lower))
    return "senior";
  const years = lower.match(/(\d+)\+?\s*years?/);
  if (years) {
    const n = parseInt(years[1], 10);
    if (n >= 7) return "senior";
    if (n >= 3) return "mid";
    return "entry";
  }
  if (/\b(intern|internship|undergraduate|bachelor|student|fresh graduate|final year)\b/.test(lower))
    return "student";
  return "entry";
}

export function heuristicExtract(text: string): Profile {
  return {
    skills: findKeywords(text, SKILL_KEYWORDS, 12),
    interests: findKeywords(text, INTEREST_KEYWORDS, 8),
    experience_level: guessExperienceLevel(text),
  };
}
