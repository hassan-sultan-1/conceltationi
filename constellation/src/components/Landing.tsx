"use client";

import { useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { LATEST_STORAGE_KEY } from "@/lib/theme";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
  },
};

export type LandingChoice = "cv" | "form" | "previous";

export default function Landing({
  onChoose,
}: {
  onChoose: (choice: LandingChoice) => void;
}) {
  const [hasPrevious, setHasPrevious] = useState(false);

  useEffect(() => {
    try {
      setHasPrevious(!!localStorage.getItem(LATEST_STORAGE_KEY));
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <motion.main
      variants={container}
      initial="hidden"
      animate="show"
      className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
    >
      {/* Badge */}
      <motion.div
        variants={item}
        className="glass mb-8 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-secondary"
      >
        <span className="glow-text text-sm leading-none">✦</span>
        AI-POWERED CAREER GUIDANCE
      </motion.div>

      {/* Headline */}
      <motion.h1
        variants={item}
        className="max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight sm:text-6xl"
      >
        Your career,
        <br />
        <span className="glow-text">written in the stars.</span>
      </motion.h1>

      <motion.p
        variants={item}
        className="mt-6 max-w-xl text-base leading-relaxed text-secondary sm:text-lg"
      >
        Constellation turns your skills and interests into a living night sky —
        every star a career path, every line a connection back to what you
        already know. Explore it, question it, and download your sky.
      </motion.p>

      {/* CTAs */}
      <motion.div
        variants={item}
        className="mt-10 flex flex-col items-center gap-4 sm:flex-row"
      >
        <button
          onClick={() => onChoose("cv")}
          className="group relative rounded-full bg-accent-strong px-8 py-3.5 font-display text-sm font-semibold tracking-wide text-white transition-transform hover:scale-[1.03] active:scale-[0.98]"
          style={{
            boxShadow:
              "0 0 24px var(--accent-soft), 0 0 64px var(--accent-soft)",
          }}
        >
          Upload My CV
          <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
        <button
          onClick={() => onChoose("form")}
          className="glass rounded-full px-8 py-3.5 font-display text-sm font-semibold tracking-wide text-primary transition-all hover:scale-[1.03] hover:border-[var(--accent)] active:scale-[0.98]"
        >
          Answer a Few Questions
        </button>
      </motion.div>

      {/* Previous sky link */}
      {hasPrevious && (
        <motion.button
          variants={item}
          onClick={() => onChoose("previous")}
          className="mt-8 text-sm text-secondary underline decoration-[var(--panel-border)] underline-offset-4 transition-colors hover:text-primary"
        >
          ✧ View my previous sky
        </motion.button>
      )}

      {/* Footer hint */}
      <motion.p
        variants={item}
        className="absolute bottom-6 text-xs tracking-wide text-faint"
      >
        No account needed · Your data stays in your browser
      </motion.p>
    </motion.main>
  );
}
