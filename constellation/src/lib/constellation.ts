/**
 * Constellation data model + server-side schema validation.
 */

export type NodeType = "core_skill" | "career" | "stretch_career";

export interface CNode {
  id: string;
  label: string;
  type: NodeType;
  brightness: number; // 0.3–1, how strong the fit is
}

export interface CEdge {
  from: string;
  to: string;
  strength: number; // 0.2–1
}

export interface ConstellationData {
  nodes: CNode[];
  edges: CEdge[];
}

export const NODE_LIMITS: Record<NodeType, { min: number; max: number }> = {
  core_skill: { min: 3, max: 5 },
  career: { min: 4, max: 6 },
  stretch_career: { min: 2, max: 3 },
};

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/**
 * Validates and normalizes a raw LLM response into ConstellationData.
 * Repairs what it safely can (clamping, deduping, trimming overflow);
 * returns an error string for structural problems that require a retry.
 */
export function validateConstellation(
  raw: unknown
): { ok: true; data: ConstellationData } | { ok: false; error: string } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(obj.nodes) || !Array.isArray(obj.edges))
    return { ok: false, error: "missing nodes/edges arrays" };

  // --- nodes ---
  const seen = new Set<string>();
  const nodes: CNode[] = [];
  for (const n of obj.nodes) {
    const node = n as Record<string, unknown>;
    const label =
      typeof node.label === "string" ? node.label.trim().slice(0, 48) : "";
    const type = node.type;
    if (label.length < 2) continue;
    if (type !== "core_skill" && type !== "career" && type !== "stretch_career")
      continue;
    let id =
      typeof node.id === "string" && node.id.trim()
        ? slugify(node.id)
        : slugify(label);
    if (!id) continue;
    while (seen.has(id)) id = `${id}-2`;
    seen.add(id);
    const brightness =
      typeof node.brightness === "number"
        ? clamp(node.brightness, 0.3, 1)
        : 0.7;
    nodes.push({ id, label, type, brightness });
  }

  // Original-id → normalized-id map for edge fixing.
  const idMap = new Map<string, string>();
  (obj.nodes as Record<string, unknown>[]).forEach((n, i) => {
    if (typeof n.id === "string" && nodes[i]) idMap.set(n.id, nodes[i].id);
  });

  // --- counts (trim overflow, fail on shortage) ---
  const byType = (t: NodeType) => nodes.filter((n) => n.type === t);
  const trimmed: CNode[] = [];
  for (const t of Object.keys(NODE_LIMITS) as NodeType[]) {
    const group = byType(t)
      .sort((a, b) => b.brightness - a.brightness)
      .slice(0, NODE_LIMITS[t].max);
    if (group.length < NODE_LIMITS[t].min)
      return {
        ok: false,
        error: `need at least ${NODE_LIMITS[t].min} ${t} nodes, got ${group.length}`,
      };
    trimmed.push(...group);
  }
  const kept = new Set(trimmed.map((n) => n.id));

  // --- edges ---
  const edgeKeys = new Set<string>();
  const edges: CEdge[] = [];
  for (const e of obj.edges) {
    const edge = e as Record<string, unknown>;
    const from =
      typeof edge.from === "string"
        ? (idMap.get(edge.from) ?? slugify(edge.from))
        : "";
    const to =
      typeof edge.to === "string"
        ? (idMap.get(edge.to) ?? slugify(edge.to))
        : "";
    if (!kept.has(from) || !kept.has(to) || from === to) continue;
    const key = [from, to].sort().join("→");
    if (edgeKeys.has(key)) continue;
    edgeKeys.add(key);
    const strength =
      typeof edge.strength === "number" ? clamp(edge.strength, 0.2, 1) : 0.5;
    edges.push({ from, to, strength });
  }

  // --- connectivity: every non-core node must reach a core_skill ---
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    adjacency.set(e.from, [...(adjacency.get(e.from) ?? []), e.to]);
    adjacency.set(e.to, [...(adjacency.get(e.to) ?? []), e.from]);
  }
  const reached = new Set<string>();
  const queue = trimmed.filter((n) => n.type === "core_skill").map((n) => n.id);
  queue.forEach((id) => reached.add(id));
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  const orphans = trimmed.filter((n) => !reached.has(n.id));
  if (orphans.length > 0)
    return {
      ok: false,
      error: `orphan nodes not connected to any core skill: ${orphans
        .map((n) => n.id)
        .join(", ")}`,
    };

  return { ok: true, data: { nodes: trimmed, edges } };
}
