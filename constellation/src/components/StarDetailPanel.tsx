"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CNode, ConstellationData, NodeType } from "@/lib/constellation";
import { Profile } from "@/lib/types";
import type { StarDetail } from "@/app/api/star-detail/route";

type Status =
  | { state: "loading" }
  | { state: "done"; detail: StarDetail; note?: string }
  | { state: "error"; message: string };

const TYPE_BADGE: Record<NodeType, { label: string; color: string }> = {
  core_skill: { label: "Core skill", color: "var(--star-core)" },
  career: { label: "Career path", color: "var(--star-glow)" },
  stretch_career: { label: "Stretch career", color: "var(--star-glow-alt)" },
};

// Session cache so re-clicking a star is instant (keyed per profile, so a
// regenerated sky never serves stale advice).
const cache = new Map<string, { detail: StarDetail; note?: string }>();

function cacheKey(nodeId: string, profile: Profile): string {
  return `${nodeId}|${profile.skills.join(",")}|${profile.experience_level}`;
}

function connectedSkillLabels(node: CNode, data: ConstellationData): string[] {
  const coreIds = new Set(
    data.nodes.filter((n) => n.type === "core_skill").map((n) => n.id)
  );
  const labels: string[] = [];
  for (const e of data.edges) {
    const other = e.from === node.id ? e.to : e.to === node.id ? e.from : null;
    if (other && coreIds.has(other)) {
      const n = data.nodes.find((x) => x.id === other);
      if (n) labels.push(n.label);
    }
  }
  return labels;
}

function SkeletonLine({ w }: { w: string }) {
  return (
    <div
      className="h-3 animate-pulse rounded-full"
      style={{ width: w, background: "var(--panel-border)" }}
    />
  );
}

export default function StarDetailPanel({
  node,
  profile,
  data,
  onClose,
}: {
  node: CNode | null;
  profile: Profile;
  data: ConstellationData;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!node) return;
    const cached = cache.get(cacheKey(node.id, profile));
    if (cached) {
      setStatus({ state: "done", ...cached });
      return;
    }
    let cancelled = false;
    setStatus({ state: "loading" });
    (async () => {
      try {
        const res = await fetch("/api/star-detail", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            node: { id: node.id, label: node.label, type: node.type },
            profile,
            connected_skills: connectedSkillLabels(node, data),
          }),
        });
        const body = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !body?.detail) {
          setStatus({
            state: "error",
            message:
              body?.error ?? "The mentor is quiet right now. Try again?",
          });
          return;
        }
        cache.set(cacheKey(node.id, profile), { detail: body.detail, note: body.note });
        setStatus({ state: "done", detail: body.detail, note: body.note });
      } catch {
        if (!cancelled)
          setStatus({
            state: "error",
            message: "Couldn't reach the mentor — check your connection.",
          });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [node, profile, data, attempt]);

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          key={node.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="glass fixed z-40 flex flex-col overflow-hidden rounded-2xl max-sm:inset-x-3 max-sm:bottom-3 max-sm:max-h-[58vh] sm:bottom-24 sm:right-5 sm:top-20 sm:w-[380px]"
        >
          {/* Header */}
          <div
            className="flex items-start justify-between gap-3 px-6 pb-4 pt-5"
            style={{ borderBottom: "1px solid var(--panel-border)" }}
          >
            <div>
              <span
                className="mb-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-widest"
                style={{
                  color: TYPE_BADGE[node.type].color,
                  border: `1px solid ${TYPE_BADGE[node.type].color}`,
                  opacity: 0.9,
                }}
              >
                {TYPE_BADGE[node.type].label.toUpperCase()}
              </span>
              <h3 className="font-display text-xl font-semibold leading-tight">
                {node.label}
              </h3>
              <p className="mt-1 text-xs text-faint">
                Fit strength {(node.brightness * 100) | 0}%
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close panel"
              className="rounded-full p-1.5 text-secondary transition-colors hover:text-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {status.state === "loading" && (
              <div className="space-y-6">
                <div className="space-y-2.5">
                  <SkeletonLine w="40%" />
                  <SkeletonLine w="100%" />
                  <SkeletonLine w="92%" />
                  <SkeletonLine w="75%" />
                </div>
                <div className="space-y-2.5">
                  <SkeletonLine w="35%" />
                  <SkeletonLine w="85%" />
                  <SkeletonLine w="90%" />
                  <SkeletonLine w="70%" />
                </div>
                <p className="text-center text-xs text-faint">
                  Asking the mentor about this star…
                </p>
              </div>
            )}

            {status.state === "error" && (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <p className="text-2xl">☄️</p>
                <p className="text-sm leading-relaxed text-secondary">
                  {status.message}
                </p>
                <button
                  onClick={() => {
                    cache.delete(cacheKey(node.id, profile));
                    setAttempt((a) => a + 1);
                  }}
                  className="rounded-full bg-accent-strong px-5 py-2 font-display text-xs font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Try again
                </button>
              </div>
            )}

            {status.state === "done" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                {status.note && (
                  <p
                    className="rounded-lg px-3 py-2 text-[11px] leading-relaxed text-secondary"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    {status.note}
                  </p>
                )}

                <section>
                  <h4 className="mb-2 font-display text-[11px] font-semibold tracking-widest text-faint">
                    WHY IT FITS YOU
                  </h4>
                  <p className="text-sm leading-relaxed text-secondary">
                    {status.detail.why_it_fits}
                  </p>
                </section>

                <section>
                  <h4 className="mb-2.5 font-display text-[11px] font-semibold tracking-widest text-faint">
                    NEXT STEPS
                  </h4>
                  <ol className="space-y-2.5">
                    {status.detail.next_steps.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed text-secondary">
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                            border: "1px solid var(--panel-border)",
                          }}
                        >
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </section>

                <section
                  className="rounded-xl px-4 py-3.5"
                  style={{
                    background: "var(--accent-soft)",
                    border: "1px solid var(--panel-border)",
                  }}
                >
                  <h4 className="mb-1.5 font-display text-[11px] font-semibold tracking-widest text-faint">
                    ✦ ONE RESOURCE TO START
                  </h4>
                  <p className="text-sm leading-relaxed text-secondary">
                    {status.detail.resource_suggestion}
                  </p>
                </section>
              </motion.div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
