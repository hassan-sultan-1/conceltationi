import { Profile } from "./types";
import { CEdge, CNode, ConstellationData, slugify } from "./constellation";

/**
 * Rule-based constellation generator used when Gemini is unavailable.
 * Connectivity is guaranteed by construction — every career links to the
 * core skills that produced it, every stretch career links to a career.
 */

const CAREER_RULES: { career: string; match: string[] }[] = [
  { career: "Software Engineer", match: ["python", "javascript", "typescript", "java", "c++", "c#", "go", "node", "programming", "coding"] },
  { career: "Frontend Developer", match: ["react", "javascript", "typescript", "css", "html", "vue", "angular", "tailwind"] },
  { career: "Data Analyst", match: ["sql", "excel", "data analysis", "statistics", "power bi", "tableau", "pandas"] },
  { career: "Machine Learning Engineer", match: ["machine learning", "deep learning", "python", "tensorflow", "pytorch", "nlp", "ai"] },
  { career: "UX/UI Designer", match: ["figma", "ux design", "ui design", "design", "prototyping", "wireframing", "photoshop", "illustrator"] },
  { career: "Digital Marketer", match: ["marketing", "seo", "social media", "content writing", "copywriting"] },
  { career: "Content Strategist", match: ["writing", "content writing", "copywriting", "blogging", "communication"] },
  { career: "Project Manager", match: ["project management", "leadership", "agile", "scrum", "communication", "teamwork"] },
  { career: "Business Analyst", match: ["excel", "sql", "financial analysis", "accounting", "research", "data analysis"] },
  { career: "DevOps Engineer", match: ["docker", "kubernetes", "aws", "azure", "gcp", "git"] },
  { career: "Educator / Trainer", match: ["teaching", "public speaking", "research", "communication"] },
  { career: "Mobile App Developer", match: ["flutter", "react", "java", "mobile"] },
];

const GENERIC_CAREERS = [
  "Technical Consultant",
  "Operations Analyst",
  "Customer Success Specialist",
  "Research Assistant",
];

const STRETCH_POOL = [
  "Product Manager",
  "Startup Founder",
  "AI Product Specialist",
  "Developer Advocate",
  "Freelance Consultant",
];

export function fallbackConstellation(profile: Profile): ConstellationData {
  const skillsLower = profile.skills.map((s) => s.toLowerCase());
  const interestsLower = profile.interests.map((i) => i.toLowerCase());

  // Score careers by matched skills (+ small interest bonus).
  const scored = CAREER_RULES.map((rule) => {
    const matched = profile.skills.filter((s) =>
      rule.match.some(
        (m) => s.toLowerCase().includes(m) || m.includes(s.toLowerCase())
      )
    );
    const interestBonus = interestsLower.some((i) =>
      rule.career.toLowerCase().includes(i.split(" ")[0])
    )
      ? 1
      : 0;
    return { rule, matched, score: matched.length + interestBonus };
  })
    .filter((c) => c.matched.length > 0)
    .sort((a, b) => b.score - a.score);

  let careers = scored.slice(0, 6);
  // Pad with generics (linked later to top skills) to reach the minimum of 4.
  const padding = Math.max(0, 4 - careers.length);
  const generics = GENERIC_CAREERS.slice(0, padding).map((career) => ({
    rule: { career, match: [] as string[] },
    matched: [] as string[],
    score: 1,
  }));
  careers = [...careers, ...generics];

  // Core skills: those that power the most careers, else first listed.
  const skillUse = new Map<string, number>();
  for (const skill of profile.skills) skillUse.set(skill, 0);
  for (const c of careers)
    for (const m of c.matched) skillUse.set(m, (skillUse.get(m) ?? 0) + 1);
  const coreSkills = [...skillUse.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.min(5, Math.max(3, profile.skills.length)))
    .map(([skill]) => skill);
  while (coreSkills.length < 3 && skillsLower.length > 0) {
    coreSkills.push(profile.skills[coreSkills.length % profile.skills.length]);
  }
  const uniqueCore = [...new Set(coreSkills)].slice(0, 5);

  const maxScore = Math.max(...careers.map((c) => c.score), 1);
  const nodes: CNode[] = [];
  const edges: CEdge[] = [];

  for (const skill of uniqueCore) {
    nodes.push({
      id: slugify(skill),
      label: skill,
      type: "core_skill",
      brightness: 0.6 + 0.4 * ((skillUse.get(skill) ?? 0) / Math.max(1, maxScore)),
    });
  }

  for (const c of careers) {
    const id = slugify(c.rule.career);
    nodes.push({
      id,
      label: c.rule.career,
      type: "career",
      brightness: 0.5 + 0.5 * (c.score / maxScore),
    });
    const linkedCore = uniqueCore.filter((s) => c.matched.includes(s));
    const targets = linkedCore.length > 0 ? linkedCore : [uniqueCore[0]];
    for (const skill of targets.slice(0, 3)) {
      edges.push({
        from: slugify(skill),
        to: id,
        strength: 0.4 + 0.6 * (c.score / maxScore),
      });
    }
  }

  // Stretch careers: 2 from the pool that aren't already careers.
  const careerLabels = new Set(careers.map((c) => c.rule.career));
  const stretch = STRETCH_POOL.filter((s) => !careerLabels.has(s)).slice(0, 2);
  stretch.forEach((label, i) => {
    const id = slugify(label);
    nodes.push({ id, label, type: "stretch_career", brightness: 0.45 + i * 0.1 });
    // Anchor to a top career + a core skill so it reads as "reachable".
    edges.push({
      from: slugify(careers[i % careers.length].rule.career),
      to: id,
      strength: 0.35,
    });
    edges.push({
      from: slugify(uniqueCore[(i + 1) % uniqueCore.length]),
      to: id,
      strength: 0.25,
    });
  });

  return { nodes, edges };
}
