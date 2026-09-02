"use client";

import { motion, type Variants } from "framer-motion";
import { CNode, NodeType } from "@/lib/constellation";
import { SkyDiff } from "@/lib/storage";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.3 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.9 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  },
};

const TYPE_COLOR: Record<NodeType, string> = {
  core_skill: "var(--star-core)",
  career: "var(--star-glow)",
  stretch_career: "var(--star-glow-alt)",
};

function StarChip({
  node,
  variant,
}: {
  node: CNode;
  variant: "new" | "kept" | "removed";
}) {
  return (
    <motion.span
      variants={item}
      className="flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm"
      style={{
        border: `1px solid ${variant === "new" ? "var(--accent)" : "var(--panel-border)"}`,
        background: variant === "new" ? "var(--accent-soft)" : "var(--panel-bg)",
        color:
          variant === "removed" ? "var(--text-faint)" : "var(--text-primary)",
        textDecoration: variant === "removed" ? "line-through" : "none",
        opacity: variant === "removed" ? 0.7 : 1,
        boxShadow: variant === "new" ? "0 0 18px var(--accent-soft)" : undefined,
      }}
    >
      <span
        className="inline-block h-2 w-2 rounded-full"
        style={{
          background: TYPE_COLOR[node.type],
          boxShadow:
            variant === "removed" ? "none" : `0 0 8px ${TYPE_COLOR[node.type]}`,
          opacity: variant === "removed" ? 0.4 : 1,
        }}
      />
      {node.label}
      {variant === "new" && (
        <motion.span
          initial={{ scale: 0, rotate: -90 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
          className="glow-text text-xs"
        >
          ✦
        </motion.span>
      )}
    </motion.span>
  );
}

function Section({
  title,
  nodes,
  variant,
}: {
  title: string;
  nodes: CNode[];
  variant: "new" | "kept" | "removed";
}) {
  if (nodes.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2.5 font-display text-[11px] font-semibold tracking-widest text-faint">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">
        {nodes.map((n) => (
          <StarChip key={n.id} node={n} variant={variant} />
        ))}
      </div>
    </div>
  );
}

export default function ExpansionComparison({
  diff,
  lastDate,
  onContinue,
}: {
  diff: SkyDiff;
  lastDate: string;
  onContinue: () => void;
}) {
  const n = diff.newNodes.length;
  const caption =
    n === 0
      ? "Your sky holds steady — the same stars, still shining."
      : n === 1
        ? "1 new star has entered your sky"
        : `${n} new stars have entered your sky`;

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="w-full max-w-xl"
      >
        <motion.p
          variants={item}
          className="text-center text-[11px] font-medium tracking-widest text-faint"
        >
          COMPARED WITH YOUR SKY FROM {lastDate.toUpperCase()}
        </motion.p>
        <motion.h2
          variants={item}
          className="mt-3 text-center font-display text-3xl font-semibold sm:text-4xl"
        >
          Your sky is <span className="glow-text">expanding</span>
        </motion.h2>
        <motion.p
          variants={item}
          className="mt-3 text-center text-sm text-secondary"
        >
          {caption}
        </motion.p>

        <motion.div
          variants={item}
          className="glass mt-10 space-y-7 rounded-2xl px-7 py-7"
        >
          <Section title="✦ NEW STARS" nodes={diff.newNodes} variant="new" />
          <Section
            title="STILL SHINING"
            nodes={diff.unchangedNodes}
            variant="kept"
          />
          <Section
            title="FADED FROM VIEW"
            nodes={diff.removedNodes}
            variant="removed"
          />
        </motion.div>

        <motion.div variants={item} className="mt-8 text-center">
          <button
            onClick={onContinue}
            className="rounded-full bg-accent-strong px-8 py-3.5 font-display text-sm font-semibold tracking-wide text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
            style={{
              boxShadow:
                "0 0 24px var(--accent-soft), 0 0 64px var(--accent-soft)",
            }}
          >
            Enter your new sky →
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
}
