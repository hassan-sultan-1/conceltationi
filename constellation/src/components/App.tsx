"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Starfield from "@/components/Starfield";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import Landing, { LandingChoice } from "@/components/Landing";
import CVUpload from "@/components/CVUpload";
import ManualForm from "@/components/ManualForm";
import Review from "@/components/Review";
import ChartingLoader from "@/components/ChartingLoader";
import ConstellationView from "@/components/ConstellationView";
import ChatWidget from "@/components/ChatWidget";
import ExpansionComparison from "@/components/ExpansionComparison";
import { Profile } from "@/lib/types";
import { ConstellationData } from "@/lib/constellation";
import {
  clearSavedSky,
  diffSkies,
  formatSavedDate,
  loadSavedSky,
  saveSky,
  type SkyDiff,
} from "@/lib/storage";

/**
 * Single-page flow state machine. Screens are added phase by phase:
 *   landing → input (cv | form) → review → loading → [comparison] → constellation
 */
type Screen =
  | { name: "landing" }
  | { name: "input"; mode: "cv" | "form" }
  | { name: "review"; profile: Profile; source: "cv" | "form"; note?: string }
  | { name: "generating"; profile: Profile; source: "cv" | "form" }
  | {
      name: "comparison";
      profile: Profile;
      data: ConstellationData;
      note?: string;
      diff: SkyDiff;
      prevDate: string;
      savedAt: number;
    }
  | {
      name: "constellation";
      profile: Profile;
      data: ConstellationData;
      note?: string;
      savedAt?: number;
    }
  | { name: "genError"; profile: Profile; source: "cv" | "form"; message: string }
  | { name: "placeholder"; label: string; blurb: string };

const screenTransition = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
  transition: { duration: 0.4 },
};

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: "landing" });
  const generatingRef = useRef(false);

  // --- achievement toasts (cosmetic, client-side only) ---
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const seenOnce = useRef(new Set<string>());
  const pushToast = (text: string, onceKey?: string) => {
    if (onceKey) {
      if (seenOnce.current.has(onceKey)) return;
      seenOnce.current.add(onceKey);
    }
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  };

  // Kick off generation when entering the "generating" screen.
  useEffect(() => {
    if (screen.name !== "generating" || generatingRef.current) return;
    generatingRef.current = true;
    const { profile, source } = screen;
    const startedAt = Date.now();
    const MIN_LOADER_MS = 2200; // let the loader breathe

    (async () => {
      try {
        const res = await fetch("/api/generate-constellation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(profile),
        });
        const body = await res.json().catch(() => null);
        const wait = Math.max(0, MIN_LOADER_MS - (Date.now() - startedAt));
        await new Promise((r) => setTimeout(r, wait));
        if (!res.ok || !body?.constellation) {
          setScreen({
            name: "genError",
            profile,
            source,
            message:
              body?.error ??
              "Something went wrong while charting your sky. Please try again.",
          });
        } else {
          const data = body.constellation as ConstellationData;
          const prev = loadSavedSky();
          const saved = saveSky(profile, data);
          if (prev) {
            setScreen({
              name: "comparison",
              profile,
              data,
              note: body.note,
              diff: diffSkies(prev.data, data),
              prevDate: formatSavedDate(prev.savedAt),
              savedAt: saved.savedAt,
            });
          } else {
            setScreen({
              name: "constellation",
              profile,
              data,
              note: body.note,
              savedAt: saved.savedAt,
            });
          }
        }
      } catch {
        setScreen({
          name: "genError",
          profile,
          source,
          message:
            "We couldn't reach the constellation engine. Check your connection and try again.",
        });
      } finally {
        generatingRef.current = false;
      }
    })();
  }, [screen]);

  const handleLandingChoice = (choice: LandingChoice) => {
    if (choice === "cv") setScreen({ name: "input", mode: "cv" });
    else if (choice === "form") setScreen({ name: "input", mode: "form" });
    else {
      const saved = loadSavedSky();
      if (saved) {
        setScreen({
          name: "constellation",
          profile: saved.profile,
          data: saved.data,
          savedAt: saved.savedAt,
        });
      } else {
        // Corrupted / cleared while the page was open — tidy up gracefully.
        clearSavedSky();
        setScreen({
          name: "placeholder",
          label: "No saved sky found",
          blurb:
            "Your previous constellation couldn't be loaded. Chart a new one — it only takes a minute.",
        });
      }
    }
  };

  const handleConfirmedProfile = (profile: Profile, source: "cv" | "form") => {
    setScreen({ name: "generating", profile, source });
  };

  return (
    <div className="relative min-h-screen">
      {/* Ambient background layers */}
      <Starfield />
      <div
        aria-hidden
        className="nebula-layer pointer-events-none fixed inset-0 z-0"
      />
      <div
        aria-hidden
        className="aurora-veil pointer-events-none fixed inset-0 z-0"
      />

      {/* Achievement toasts */}
      <div className="pointer-events-none fixed left-1/2 top-16 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -16, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-full px-5 py-2.5 text-sm text-primary"
              style={{ boxShadow: "0 0 24px var(--accent-soft)" }}
            >
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Top bar */}
      <header className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-5 py-4 sm:px-8">
        <button
          onClick={() => setScreen({ name: "landing" })}
          className="flex items-center gap-2 font-display text-sm font-semibold tracking-widest text-primary"
        >
          <span className="glow-text text-lg leading-none">✦</span>
          CONSTELLATION
        </button>
        <ThemeSwitcher />
      </header>

      <AnimatePresence mode="wait">
        {screen.name === "landing" && (
          <motion.div key="landing" {...screenTransition}>
            <Landing onChoose={handleLandingChoice} />
          </motion.div>
        )}

        {screen.name === "input" && screen.mode === "cv" && (
          <motion.div key="input-cv" {...screenTransition}>
            <CVUpload
              onExtracted={(profile, note) =>
                setScreen({ name: "review", profile, source: "cv", note })
              }
              onSwitchToForm={() => setScreen({ name: "input", mode: "form" })}
              onBack={() => setScreen({ name: "landing" })}
            />
          </motion.div>
        )}

        {screen.name === "input" && screen.mode === "form" && (
          <motion.div key="input-form" {...screenTransition}>
            <ManualForm
              onSubmit={(profile) =>
                setScreen({ name: "review", profile, source: "form" })
              }
              onSwitchToCV={() => setScreen({ name: "input", mode: "cv" })}
              onBack={() => setScreen({ name: "landing" })}
            />
          </motion.div>
        )}

        {screen.name === "review" && (
          <motion.div key="review" {...screenTransition}>
            <Review
              initial={screen.profile}
              source={screen.source}
              note={screen.note}
              onConfirm={(p) => handleConfirmedProfile(p, screen.source)}
              onBack={() => setScreen({ name: "input", mode: screen.source })}
            />
          </motion.div>
        )}

        {screen.name === "generating" && (
          <motion.div key="generating" {...screenTransition}>
            <ChartingLoader />
          </motion.div>
        )}

        {screen.name === "comparison" && (
          <motion.div key="comparison" {...screenTransition}>
            <ExpansionComparison
              diff={screen.diff}
              lastDate={screen.prevDate}
              onContinue={() =>
                setScreen({
                  name: "constellation",
                  profile: screen.profile,
                  data: screen.data,
                  note: screen.note,
                  savedAt: screen.savedAt,
                })
              }
            />
          </motion.div>
        )}

        {screen.name === "constellation" && (
          <motion.div key="constellation" {...screenTransition}>
            <ConstellationView
              data={screen.data}
              profile={screen.profile}
              note={screen.note}
              savedAt={screen.savedAt}
              onStartOver={() => setScreen({ name: "landing" })}
              onToast={pushToast}
            />
            <ChatWidget
              profile={screen.profile}
              data={screen.data}
              onMessageSent={(count) => {
                if (count >= 3)
                  pushToast("💬 Deep diver — three questions and counting", "deep-diver");
              }}
            />
          </motion.div>
        )}

        {screen.name === "genError" && (
          <motion.main
            key="gen-error"
            {...screenTransition}
            className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
          >
            <div className="glass max-w-md rounded-2xl px-8 py-10">
              <p className="mb-3 text-2xl">☄️</p>
              <h2 className="font-display text-xl font-semibold">
                The sky clouded over
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                {screen.message}
              </p>
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  onClick={() =>
                    setScreen({
                      name: "generating",
                      profile: screen.profile,
                      source: screen.source,
                    })
                  }
                  className="rounded-full bg-accent-strong px-6 py-2.5 font-display text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Try again
                </button>
                <button
                  onClick={() =>
                    setScreen({
                      name: "review",
                      profile: screen.profile,
                      source: screen.source,
                    })
                  }
                  className="text-sm text-secondary underline underline-offset-4 transition-colors hover:text-primary"
                >
                  Edit my profile
                </button>
              </div>
            </div>
          </motion.main>
        )}

        {screen.name === "placeholder" && (
          <motion.main
            key="placeholder"
            {...screenTransition}
            className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 text-center"
          >
            <div className="glass max-w-md rounded-2xl px-8 py-10">
              <p className="glow-text mb-3 text-2xl">✦</p>
              <h2 className="font-display text-xl font-semibold">
                {screen.label}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-secondary">
                {screen.blurb}
              </p>
              <button
                onClick={() => setScreen({ name: "landing" })}
                className="mt-6 text-sm text-secondary underline underline-offset-4 transition-colors hover:text-primary"
              >
                ← Back to landing
              </button>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}
