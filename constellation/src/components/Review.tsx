"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ChipEditor from "./ChipEditor";
import ExperiencePicker from "./ExperiencePicker";
import { Profile } from "@/lib/types";

export default function Review({
  initial,
  source,
  note,
  onConfirm,
  onBack,
}: {
  initial: Profile;
  source: "cv" | "form";
  note?: string;
  onConfirm: (profile: Profile) => void;
  onBack: () => void;
}) {
  const [skills, setSkills] = useState(initial.skills);
  const [interests, setInterests] = useState(initial.interests);
  const [level, setLevel] = useState(initial.experience_level);

  const valid = skills.length >= 2;

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <div className="mb-2 text-center">
          <span className="glass rounded-full px-3 py-1 text-[11px] font-medium tracking-widest text-secondary">
            {source === "cv" ? "EXTRACTED FROM YOUR CV" : "FROM YOUR ANSWERS"}
          </span>
        </div>
        <h2 className="text-center font-display text-2xl font-semibold sm:text-3xl">
          Does this look like you?
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-secondary">
          These are the raw materials of your constellation. Add, remove, or
          edit anything before we chart the sky.
        </p>

        {note && (
          <p
            className="mt-4 rounded-xl px-4 py-3 text-center text-xs leading-relaxed text-secondary"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--panel-border)",
            }}
          >
            {note}
          </p>
        )}

        <div className="mt-8 space-y-7">
          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              Skills{" "}
              <span className="font-sans text-xs font-normal text-faint">
                ({skills.length})
              </span>
            </label>
            <ChipEditor
              items={skills}
              onChange={setSkills}
              placeholder="Add a skill…"
            />
          </div>

          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              Interests{" "}
              <span className="font-sans text-xs font-normal text-faint">
                ({interests.length})
              </span>
            </label>
            <ChipEditor
              items={interests}
              onChange={setInterests}
              placeholder="Add an interest…"
              max={8}
            />
          </div>

          <div>
            <label className="mb-2.5 block font-display text-sm font-semibold">
              Experience level
            </label>
            <ExperiencePicker value={level} onChange={setLevel} />
          </div>
        </div>

        <button
          disabled={!valid}
          onClick={() =>
            onConfirm({ skills, interests, experience_level: level })
          }
          className="mt-10 w-full rounded-full bg-accent-strong px-8 py-4 font-display text-sm font-semibold tracking-wide text-white transition-all enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            boxShadow: valid
              ? "0 0 24px var(--accent-soft), 0 0 64px var(--accent-soft)"
              : undefined,
          }}
        >
          ✦ Chart My Constellation
        </button>
        {!valid && (
          <p className="mt-3 text-center text-xs text-faint">
            Add at least 2 skills to continue
          </p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={onBack}
            className="text-sm text-secondary transition-colors hover:text-primary"
          >
            ← Back
          </button>
        </div>
      </motion.div>
    </div>
  );
}
