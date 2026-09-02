"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion } from "framer-motion";
import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { CNode, ConstellationData, NodeType } from "@/lib/constellation";
import { Profile } from "@/lib/types";
import { clearSavedSky, formatSavedDate } from "@/lib/storage";
import StarDetailPanel from "./StarDetailPanel";

interface SimNode extends SimulationNodeDatum, CNode {}
interface SimLink extends SimulationLinkDatum<SimNode> {
  strength: number;
}

const TYPE_META: Record<
  NodeType,
  { baseRadius: number; radiusScale: number; legend: string; fill: string }
> = {
  core_skill: {
    baseRadius: 3.5,
    radiusScale: 2.5,
    legend: "Core skill",
    fill: "var(--star-core)",
  },
  career: {
    baseRadius: 5.5,
    radiusScale: 4.5,
    legend: "Career path",
    fill: "var(--star-glow)",
  },
  stretch_career: {
    baseRadius: 4.5,
    radiusScale: 3.5,
    legend: "Stretch career",
    fill: "var(--star-glow-alt)",
  },
};

export function nodeRadius(node: CNode): number {
  const meta = TYPE_META[node.type];
  return meta.baseRadius + meta.radiusScale * node.brightness;
}

/** Deterministic 0..1 pseudo-random from a string (stable twinkle per star). */
function hash01(input: string, salt = 0): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

type ViewTransform = { x: number; y: number; k: number };

export default function ConstellationView({
  data,
  profile,
  note,
  savedAt,
  onStartOver,
  onSelectNode,
  onToast,
}: {
  data: ConstellationData;
  profile: Profile;
  note?: string;
  savedAt?: number;
  onStartOver: () => void;
  onSelectNode?: (node: CNode | null) => void;
  onToast?: (text: string, onceKey?: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [, setTick] = useState(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [skyCleared, setSkyCleared] = useState(false);

  // --- view transform (zoom & pan) ---
  const [transform, setTransform] = useState<ViewTransform>({ x: 0, y: 0, k: 1 });
  const transformRef = useRef(transform);
  transformRef.current = transform;
  const tweenRef = useRef<number | null>(null);

  const stopTween = useCallback(() => {
    if (tweenRef.current !== null) cancelAnimationFrame(tweenRef.current);
    tweenRef.current = null;
  }, []);

  const tweenTo = useCallback(
    (target: ViewTransform, duration = 650) => {
      stopTween();
      const from = { ...transformRef.current };
      const start = performance.now();
      const step = (now: number) => {
        const t = clamp((now - start) / duration, 0, 1);
        const e = 1 - Math.pow(1 - t, 3); // cubic-out
        setTransform({
          x: from.x + (target.x - from.x) * e,
          y: from.y + (target.y - from.y) * e,
          k: from.k + (target.k - from.k) * e,
        });
        if (t < 1) tweenRef.current = requestAnimationFrame(step);
        else tweenRef.current = null;
      };
      tweenRef.current = requestAnimationFrame(step);
    },
    [stopTween]
  );

  // --- measure container ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- simulation data ---
  const { simNodes, simLinks } = useMemo(() => {
    const nodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const links: SimLink[] = data.edges.map((e) => ({
      source: e.from,
      target: e.to,
      strength: e.strength,
    }));
    return { simNodes: nodes, simLinks: links };
  }, [data]);

  const nodeById = useMemo(() => {
    const map = new Map<string, SimNode>();
    simNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [simNodes]);

  // Adjacency for hover highlighting + path tracing.
  const adjacency = useMemo(() => {
    const adj = new Map<string, { id: string; strength: number }[]>();
    for (const e of data.edges) {
      adj.set(e.from, [...(adj.get(e.from) ?? []), { id: e.to, strength: e.strength }]);
      adj.set(e.to, [...(adj.get(e.to) ?? []), { id: e.from, strength: e.strength }]);
    }
    return adj;
  }, [data]);

  // --- run force simulation ---
  useEffect(() => {
    if (!size.w || !size.h) return;
    const cx = size.w / 2;
    const cy = size.h / 2;
    const spread = Math.min(size.w, size.h);

    const byType: Record<NodeType, SimNode[]> = {
      core_skill: [],
      career: [],
      stretch_career: [],
    };
    simNodes.forEach((n) => byType[n.type].push(n));
    (Object.keys(byType) as NodeType[]).forEach((type) => {
      const ring =
        type === "core_skill"
          ? spread * 0.08
          : type === "career"
            ? spread * 0.28
            : spread * 0.42;
      byType[type].forEach((n, i) => {
        const angle =
          (i / Math.max(1, byType[type].length)) * Math.PI * 2 +
          (type === "career" ? 0.4 : type === "stretch_career" ? 0.9 : 0);
        if (n.x === undefined) {
          n.x = cx + Math.cos(angle) * ring * (0.85 + hash01(n.id) * 0.3);
          n.y = cy + Math.sin(angle) * ring * (0.85 + hash01(n.id, 7) * 0.3);
        }
      });
    });

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((l) => 100 + 70 * (1 - l.strength))
          .strength((l) => 0.25 + 0.45 * l.strength)
      )
      .force("charge", forceManyBody().strength(-280))
      .force("center", forceCenter(cx, cy))
      .force("x", forceX(cx).strength(0.045))
      .force("y", forceY(cy).strength(0.06))
      .force(
        "collide",
        forceCollide<SimNode>().radius((d) => nodeRadius(d) + 36)
      )
      .on("tick", () => setTick((t) => t + 1));

    return () => {
      sim.stop();
    };
  }, [simNodes, simLinks, size.w, size.h]);

  // ============================================================
  // Zoom & pan (wheel, drag, pinch)
  // ============================================================
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchDist = useRef<number | null>(null);
  const movedRef = useRef(false);

  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    setTransform((t) => {
      const k = clamp(t.k * factor, 0.45, 3.2);
      const real = k / t.k;
      return { k, x: px - (px - t.x) * real, y: py - (py - t.y) * real };
    });
  }, []);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopTween();
      const rect = el.getBoundingClientRect();
      zoomAt(
        e.clientX - rect.left,
        e.clientY - rect.top,
        Math.exp(-e.deltaY * 0.0016)
      );
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, stopTween]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    stopTween();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) movedRef.current = false;
    pinchDist.current = null;
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const current = { x: e.clientX, y: e.clientY };
    pointers.current.set(e.pointerId, current);

    if (pointers.current.size === 1) {
      const dx = current.x - prev.x;
      const dy = current.y - prev.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) movedRef.current = true;
      setTransform((t) => ({ ...t, x: t.x + dx, y: t.y + dy }));
    } else if (pointers.current.size === 2) {
      movedRef.current = true;
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const rect = svgRef.current!.getBoundingClientRect();
      const mid = {
        x: (pts[0].x + pts[1].x) / 2 - rect.left,
        y: (pts[0].y + pts[1].y) / 2 - rect.top,
      };
      if (pinchDist.current !== null && pinchDist.current > 0) {
        zoomAt(mid.x, mid.y, dist / pinchDist.current);
      }
      pinchDist.current = dist;
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(e.pointerId);
    pinchDist.current = null;
  };

  const focusOn = useCallback(
    (node: SimNode) => {
      const k = Math.max(transformRef.current.k, 1.45);
      tweenTo({
        k,
        x: size.w / 2 - k * (node.x ?? 0),
        y: size.h * 0.42 - k * (node.y ?? 0),
      });
    },
    [size.w, size.h, tweenTo]
  );

  const selectNode = (node: SimNode) => {
    if (movedRef.current) return;
    setSelectedId(node.id);
    focusOn(node);
    onSelectNode?.(node);
    if (node.type === "stretch_career")
      onToast?.("🌟 Exploring beyond your comfort zone", "stretch-explorer");
  };

  const clearSelection = () => {
    if (movedRef.current) return;
    setSelectedId(null);
    onSelectNode?.(null);
  };

  const resetView = () => {
    setSelectedId(null);
    onSelectNode?.(null);
    tweenTo({ x: 0, y: 0, k: 1 });
  };

  // ============================================================
  // Path tracing: hovering a career walks glowing segments back
  // through every connected skill, one BFS depth at a time.
  // ============================================================
  const trace = useMemo(() => {
    if (!hoveredId) return null;
    const origin = nodeById.get(hoveredId);
    if (!origin || origin.type === "core_skill") return null;

    const parent = new Map<string, string>();
    const depth = new Map<string, number>([[hoveredId, 0]]);
    const queue = [hoveredId];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const nb of adjacency.get(cur) ?? []) {
        if (!depth.has(nb.id)) {
          depth.set(nb.id, depth.get(cur)! + 1);
          parent.set(nb.id, cur);
          queue.push(nb.id);
        }
      }
    }

    // Walk back from every reachable core skill, collecting path edges.
    const segments = new Map<string, { a: string; b: string; delay: number }>();
    const nodesOnPath = new Set<string>([hoveredId]);
    for (const n of simNodes) {
      if (n.type !== "core_skill" || !depth.has(n.id)) continue;
      let cur = n.id;
      while (parent.has(cur)) {
        const p = parent.get(cur)!;
        const key = [cur, p].sort().join("→");
        segments.set(key, { a: p, b: cur, delay: depth.get(p)! * 0.22 });
        nodesOnPath.add(cur);
        nodesOnPath.add(p);
        cur = p;
      }
    }
    if (segments.size === 0) return null;
    return { segments: Array.from(segments.values()), nodes: nodesOnPath };
  }, [hoveredId, nodeById, adjacency, simNodes]);

  // Highlight set: traced path nodes, or direct neighbors for core skills.
  const highlight = useMemo(() => {
    if (trace) return trace.nodes;
    if (!hoveredId) return null;
    const set = new Set<string>([hoveredId]);
    for (const nb of adjacency.get(hoveredId) ?? []) set.add(nb.id);
    return set;
  }, [trace, hoveredId, adjacency]);

  // Decorative far-background stars (parallax depth layer, 0.3x pan speed).
  const depthStars = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: hash01(`d${i}`, 1) * 1.6 - 0.3,
        y: hash01(`d${i}`, 2) * 1.6 - 0.3,
        r: 0.4 + hash01(`d${i}`, 3) * 1.1,
        o: 0.08 + hash01(`d${i}`, 4) * 0.22,
      })),
    []
  );

  const coords = (id: string) => {
    const n = nodeById.get(id);
    return { x: n?.x ?? 0, y: n?.y ?? 0 };
  };

  // ============================================================
  // Export & share
  // ============================================================
  const [copying, setCopying] = useState(false);

  /** Renders the constellation to a PNG via an offscreen canvas (fit-to-bounds). */
  const downloadPNG = () => {
    try {
      const styles = getComputedStyle(document.documentElement);
      const col = (v: string, fb: string) =>
        styles.getPropertyValue(v).trim() || fb;
      const W = 1600;
      const H = 1000;
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");

      // Background
      ctx.fillStyle = col("--bg-base", "#070514");
      ctx.fillRect(0, 0, W, H);
      const bgGrad = ctx.createRadialGradient(W / 2, -H * 0.3, 80, W / 2, -H * 0.3, H * 1.35);
      bgGrad.addColorStop(0, col("--nebula-a", "rgba(139,92,246,0.14)"));
      bgGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, W, H);

      // Decorative dust
      for (let i = 0; i < 140; i++) {
        ctx.globalAlpha = 0.06 + hash01(`e${i}`, 5) * 0.3;
        ctx.fillStyle = col("--star-core", "#fff");
        ctx.beginPath();
        ctx.arc(hash01(`e${i}`, 6) * W, hash01(`e${i}`, 7) * H, 0.5 + hash01(`e${i}`, 8) * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Fit graph to canvas
      const xs = simNodes.map((n) => n.x ?? 0);
      const ys = simNodes.map((n) => n.y ?? 0);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const spanX = Math.max(1, maxX - minX);
      const spanY = Math.max(1, maxY - minY);
      const fit = Math.min((W - 320) / spanX, (H - 340) / spanY);
      const ox = (W - spanX * fit) / 2 - minX * fit;
      const oy = (H - 120 - spanY * fit) / 2 - minY * fit + 20;
      const px = (n: SimNode) => (n.x ?? 0) * fit + ox;
      const py = (n: SimNode) => (n.y ?? 0) * fit + oy;

      const typeColor: Record<NodeType, string> = {
        core_skill: col("--star-core", "#ffffff"),
        career: col("--star-glow", "#a78bfa"),
        stretch_career: col("--star-glow-alt", "#67e8f9"),
      };

      // Edges
      for (const l of simLinks) {
        const s = l.source as SimNode;
        const t = l.target as SimNode;
        if (typeof s !== "object" || typeof t !== "object") continue;
        ctx.strokeStyle = col("--line", "rgba(167,139,250,0.35)");
        ctx.lineWidth = 1 + l.strength * 1.8;
        ctx.globalAlpha = 0.5 + l.strength * 0.3;
        ctx.beginPath();
        ctx.moveTo(px(s), py(s));
        ctx.lineTo(px(t), py(t));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Stars + labels
      for (const n of simNodes) {
        const r = nodeRadius(n) * 1.7;
        const color = typeColor[n.type];
        ctx.shadowColor = color;
        ctx.shadowBlur = 26;
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.55 + n.brightness * 0.45;
        ctx.beginPath();
        ctx.arc(px(n), py(n), r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
        ctx.fillStyle = col("--star-core", "#fff");
        ctx.beginPath();
        ctx.arc(px(n), py(n), Math.max(2, r * 0.38), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle =
          n.type === "core_skill"
            ? col("--text-secondary", "#a9a3c9")
            : col("--text-primary", "#f3f1ff");
        ctx.font = `${n.type === "core_skill" ? "400 17px" : "600 19px"} Inter, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(n.label, px(n), py(n) + r + 26);
      }

      // Watermark / caption
      ctx.textAlign = "left";
      ctx.fillStyle = col("--text-primary", "#f3f1ff");
      ctx.font = "600 30px 'Space Grotesk', Inter, sans-serif";
      ctx.fillText("✦ My Career Constellation", 56, H - 56);
      ctx.fillStyle = col("--text-faint", "#6d678f");
      ctx.font = "400 18px Inter, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(
        `charted with Constellation · ${new Date().toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`,
        W - 56,
        H - 56
      );

      const link = document.createElement("a");
      link.download = "my-career-constellation.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      onToast?.("🖼️ Sky captured — check your downloads");
    } catch {
      onToast?.("⚠️ Couldn't render the image — try again");
    }
  };

  const copySummary = async () => {
    if (copying) return;
    setCopying(true);
    try {
      const res = await fetch("/api/share-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, nodes: data.nodes }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.summary) throw new Error("no summary");
      await navigator.clipboard.writeText(body.summary);
      onToast?.("📋 Summary copied — ready to paste");
    } catch {
      onToast?.("⚠️ Couldn't copy a summary right now");
    } finally {
      setCopying(false);
    }
  };


  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8 }}
      className="relative z-10 h-screen w-screen overflow-hidden"
      ref={containerRef}
    >
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        className="absolute inset-0 touch-none"
        style={{ cursor: "grab" }}
        role="img"
        aria-label="Your career constellation"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={clearSelection}
      >
        <defs>
          <filter id="star-glow" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {(Object.keys(TYPE_META) as NodeType[]).map((type) => (
            <radialGradient key={type} id={`halo-${type}`}>
              <stop offset="0%" stopColor={TYPE_META[type].fill} stopOpacity="0.55" />
              <stop offset="40%" stopColor={TYPE_META[type].fill} stopOpacity="0.16" />
              <stop offset="100%" stopColor={TYPE_META[type].fill} stopOpacity="0" />
            </radialGradient>
          ))}
        </defs>

        {/* Depth layer: slow parallax background stars */}
        <g
          transform={`translate(${transform.x * 0.3}, ${transform.y * 0.3}) scale(${1 + (transform.k - 1) * 0.22})`}
        >
          {depthStars.map((s, i) => (
            <circle
              key={i}
              cx={s.x * size.w}
              cy={s.y * size.h}
              r={s.r}
              fill="var(--star-core)"
              opacity={s.o}
            />
          ))}
        </g>

        {/* Interactive layer */}
        <g
          transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
        >
          {/* Edges */}
          <g>
            {simLinks.map((l, i) => {
              const s = l.source as SimNode;
              const t = l.target as SimNode;
              if (typeof s !== "object" || typeof t !== "object") return null;
              const lit =
                !highlight || (highlight.has(s.id) && highlight.has(t.id));
              const pulseDur = 3.5 + hash01(`${s.id}${t.id}`) * 3;
              return (
                <g key={i}>
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="var(--line)"
                    strokeWidth={0.6 + l.strength * 1.3}
                    opacity={lit ? 0.3 + l.strength * 0.35 : 0.08}
                    style={{ transition: "opacity 250ms" }}
                  />
                  {/* traveling pulse */}
                  <line
                    x1={s.x}
                    y1={s.y}
                    x2={t.x}
                    y2={t.y}
                    stroke="var(--star-glow)"
                    strokeWidth={1.4}
                    strokeLinecap="round"
                    strokeDasharray="10 150"
                    opacity={lit ? 0.5 : 0.05}
                    style={{
                      animation: `edge-pulse ${pulseDur}s linear infinite`,
                      transition: "opacity 250ms",
                    }}
                  />
                </g>
              );
            })}
          </g>

          {/* Path tracing overlay */}
          {trace &&
            trace.segments.map((seg) => {
              const a = coords(seg.a);
              const b = coords(seg.b);
              return (
                <motion.line
                  key={`${seg.a}-${seg.b}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="var(--star-glow)"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                  filter="url(#star-glow)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.95 }}
                  transition={{
                    delay: seg.delay,
                    duration: 0.32,
                    ease: "easeOut",
                  }}
                />
              );
            })}

          {/* Stars */}
          <g>
            {simNodes.map((n) => {
              const r = nodeRadius(n);
              const meta = TYPE_META[n.type];
              const dimmed = highlight && !highlight.has(n.id);
              const isSelected = selectedId === n.id;
              const isHovered = hoveredId === n.id;
              const twinkleDur = 2.2 + hash01(n.id, 11) * 3.2;
              const twinkleDelay = hash01(n.id, 13) * 3;
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x ?? 0}, ${n.y ?? 0})`}
                  opacity={dimmed ? 0.18 : 1}
                  style={{ transition: "opacity 250ms", cursor: "pointer" }}
                  onMouseEnter={() => setHoveredId(n.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={(e) => {
                    e.stopPropagation();
                    selectNode(n);
                  }}
                >
                  {/* halo (twinkles) */}
                  <circle
                    r={r * (isSelected || isHovered ? 4.4 : 3.2)}
                    fill={`url(#halo-${n.type})`}
                    style={{
                      animation: `star-twinkle ${twinkleDur}s ease-in-out ${twinkleDelay}s infinite`,
                      transition: "r 300ms",
                    }}
                  />
                  {/* focus ring on selection */}
                  {isSelected && (
                    <circle
                      r={r + 7}
                      fill="none"
                      stroke={meta.fill}
                      strokeWidth={1.2}
                      style={{
                        transformOrigin: "0 0",
                        animation: "focus-ring 1.8s ease-out infinite",
                      }}
                    />
                  )}
                  {/* core of the star */}
                  <circle
                    r={isSelected || isHovered ? r * 1.25 : r}
                    fill={meta.fill}
                    opacity={0.55 + n.brightness * 0.45}
                    filter="url(#star-glow)"
                    style={{ transition: "r 200ms" }}
                  />
                  <circle r={Math.max(1.4, r * 0.4)} fill="var(--star-core)" />
                  {n.type === "stretch_career" && (
                    <circle
                      r={r + 5}
                      fill="none"
                      stroke={meta.fill}
                      strokeWidth="1"
                      strokeDasharray="3 4"
                      opacity="0.55"
                    />
                  )}
                  <text
                    y={r + 17}
                    textAnchor="middle"
                    fontSize={n.type === "core_skill" ? 11 : 12}
                    fontWeight={n.type === "core_skill" ? 400 : 600}
                    fill={
                      n.type === "core_skill"
                        ? "var(--text-secondary)"
                        : "var(--text-primary)"
                    }
                    style={{ userSelect: "none", pointerEvents: "none" }}
                  >
                    {n.label}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>

      {/* Legend + note + view controls */}
      <div className="pointer-events-none absolute bottom-5 left-0 right-0 flex flex-col items-center gap-2.5 px-4 max-sm:gap-2">
        {note && (
          <p className="glass pointer-events-auto max-w-md rounded-xl px-4 py-2 text-center text-xs leading-relaxed text-secondary max-sm:hidden">
            {note}
          </p>
        )}
        {/* Share row */}
        <div className="pointer-events-auto flex items-center gap-2.5">
          <button
            onClick={downloadPNG}
            className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-primary transition-all hover:scale-[1.03] hover:border-[var(--accent)]"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <path d="m7 10 5 5 5-5" />
              <path d="M12 15V3" />
            </svg>
            Download my sky
          </button>
          <button
            onClick={copySummary}
            disabled={copying}
            className="glass flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-primary transition-all hover:scale-[1.03] hover:border-[var(--accent)] disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            {copying ? "Writing…" : "Copy summary"}
          </button>
        </div>

        <div className="glass pointer-events-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-2 rounded-full px-5 py-2.5 text-xs text-secondary">
          {(Object.keys(TYPE_META) as NodeType[]).map((type) => (
            <span key={type} className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: TYPE_META[type].fill,
                  boxShadow: `0 0 6px ${TYPE_META[type].fill}`,
                }}
              />
              {TYPE_META[type].legend}
            </span>
          ))}
          <button
            onClick={resetView}
            className="text-faint underline underline-offset-4 transition-colors hover:text-primary"
          >
            Reset view
          </button>
          <button
            onClick={onStartOver}
            className="text-faint underline underline-offset-4 transition-colors hover:text-primary"
          >
            Start over
          </button>
        </div>

        {/* Saved-sky footer */}
        {savedAt !== undefined && !skyCleared && (
          <p className="pointer-events-auto text-[11px] text-faint">
            Last updated: {formatSavedDate(savedAt)} ·{" "}
            <button
              onClick={() => {
                clearSavedSky();
                setSkyCleared(true);
              }}
              className="underline underline-offset-2 transition-colors hover:text-primary"
            >
              Clear my saved sky
            </button>
          </p>
        )}
        {skyCleared && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-none text-[11px] text-faint"
          >
            Saved sky cleared — this view lasts until you leave.
          </motion.p>
        )}
      </div>

      {/* Star detail panel */}
      <StarDetailPanel
        node={
          selectedId ? (data.nodes.find((n) => n.id === selectedId) ?? null) : null
        }
        profile={profile}
        data={data}
        onClose={() => {
          setSelectedId(null);
          onSelectNode?.(null);
        }}
      />

      {/* Hint (fades out) */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 6, times: [0, 0.15, 0.75, 1], delay: 1.2 }}
        className="pointer-events-none absolute left-1/2 top-20 -translate-x-1/2 text-xs tracking-wide text-secondary"
      >
        Tap or hover a career to trace its path · pinch or scroll to zoom · drag to pan
      </motion.p>
    </motion.div>
  );
}
