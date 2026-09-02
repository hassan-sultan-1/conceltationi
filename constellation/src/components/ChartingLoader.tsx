"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

const MESSAGES = [
  "Charting your constellation…",
  "Weighing your brightest skills…",
  "Tracing paths between stars…",
  "Placing careers in your sky…",
];

/** Diagonal shooting-star streaks that repeat while the sky is charted. */
function ShootingStars() {
  const streaks = [
    { top: "18%", delay: 0.3, duration: 1.1, repeatDelay: 2.6 },
    { top: "42%", delay: 1.4, duration: 0.9, repeatDelay: 3.4 },
    { top: "66%", delay: 2.2, duration: 1.3, repeatDelay: 2.9 },
  ];
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {streaks.map((s, i) => (
        <motion.div
          key={i}
          className="absolute h-px w-40"
          style={{
            top: s.top,
            left: "-12rem",
            background:
              "linear-gradient(90deg, transparent, var(--star-glow), var(--star-core))",
            filter: "drop-shadow(0 0 6px var(--star-glow))",
          }}
          initial={{ x: 0, y: 0, opacity: 0 }}
          animate={{
            x: "120vw",
            y: "38vh",
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            delay: s.delay,
            duration: s.duration,
            repeat: Infinity,
            repeatDelay: s.repeatDelay,
            ease: "easeIn",
            times: [0, 0.15, 0.8, 1],
          }}
        >
          <span
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
            style={{
              background: "var(--star-core)",
              boxShadow: "0 0 10px var(--star-core), 0 0 20px var(--star-glow)",
            }}
          />
        </motion.div>
      ))}
    </div>
  );
}

export default function ChartingLoader() {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setMsgIndex((i) => (i + 1) % MESSAGES.length),
      2200
    );
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <ShootingStars />
      <motion.div
        animate={{ scale: [1, 1.15, 1], opacity: [0.8, 1, 0.8] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="glow-text text-5xl"
      >
        ✦
      </motion.div>

      <div className="mt-8 h-6">
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
            className="font-display text-sm font-medium tracking-wide text-secondary"
          >
            {MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

      {/* Slim progress shimmer */}
      <div
        className="mt-6 h-0.5 w-48 overflow-hidden rounded-full"
        style={{ background: "var(--panel-border)" }}
      >
        <motion.div
          animate={{ x: ["-100%", "220%"] }}
          transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
          className="h-full w-1/3 rounded-full"
          style={{ background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}
