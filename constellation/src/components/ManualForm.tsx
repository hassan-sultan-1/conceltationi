"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ChipEditor from "./ChipEditor";
import ExperiencePicker from "./ExperiencePicker";
import { ExperienceLevel, Profile } from "@/lib/types";

const SKILL_SUGGESTIONS = [
  "Python",
  "JavaScript",
  "Data Analysis",
  "Figma",
  "Communication",
  "Project Management",
];
const INTEREST_SUGGESTIONS = [
  "Artificial Intelligence",
  "Design",
  "Startups",
  "Healthcare",
  "Education",
  "Gaming",
];

export default function ManualForm({
  onSubmit,
  onSwitchToCV,
  onBack,
}: {
  onSubmit: (profile: Profile) => void;
  onSwitchToCV: () => void;
  onBack: () => void;
}) {
  const [skills, setSkills] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [level, setLevel] = useState<ExperienceLevel>("student");

  const valid = skills.length >= 2 && interests.length >= 1;

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <h2 className="text-center font-display text-2xl font-semibold sm:text-3xl">
          A few questions before we chart
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-secondary">
          Three quick answers — that&apos;s all the sky needs.
        </p>

        <div className="mt-10 space-y-8">
          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              What are you good at?{" "}
              <span className="font-sans text-xs font-normal text-faint">
                (at least 2 skills)
              </span>
            </label>
            <ChipEditor
              items={skills}
              onChange={setSkills}
              placeholder="e.g. Python, writing, design…"
              suggestions={SKILL_SUGGESTIONS}
            />
          </div>

          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              What pulls your curiosity?{" "}
              <span className="font-sans text-xs font-normal text-faint">
                (at least 1 interest)
              </span>
            </label>
            <ChipEditor
              items={interests}
              onChange={setInterests}
              placeholder="e.g. AI, music, healthcare…"
              suggestions={INTEREST_SUGGESTIONS}
              max={8}
            />
          </div>

          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              Where are you in your journey?
            </label>
            <ExperiencePicker value={level} onChange={setLevel} />
          </div>
        </div>

        <button
          disabled={!valid}
          onClick={() =>
            onSubmit({ skills, interests, experience_level: level })
          }
          className="mt-10 w-full rounded-full bg-accent-strong px-8 py-3.5 font-display text-sm font-semibold tracking-wide text-white transition-all enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            boxShadow: valid ? "0 0 24px var(--accent-soft)" : undefined,
          }}
        >
          Continue to Review →
        </button>

        <div className="mt-6 flex items-center justify-center gap-6 text-sm">
          <button
            onClick={onBack}
            className="text-secondary transition-colors hover:text-primary"
          >
            ← Back
          </button>
          <button
            onClick={onSwitchToCV}
            className="text-secondary underline underline-offset-4 transition-colors hover:text-primary"
          >
            Upload a CV instead
          </button>
        </div>
      </motion.div>
    </div>
  );
}
