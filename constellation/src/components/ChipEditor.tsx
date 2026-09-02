"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export default function ChipEditor({
  items,
  onChange,
  placeholder,
  suggestions = [],
  max = 15,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  suggestions?: string[];
  max?: number;
}) {
  const [draft, setDraft] = useState("");

  const add = (value: string) => {
    const clean = value.trim().replace(/\s+/g, " ").slice(0, 40);
    if (clean.length < 2 || items.length >= max) return;
    if (items.some((i) => i.toLowerCase() === clean.toLowerCase())) return;
    onChange([...items, clean]);
    setDraft("");
  };

  const remove = (value: string) => onChange(items.filter((i) => i !== value));

  const visibleSuggestions = suggestions
    .filter((s) => !items.some((i) => i.toLowerCase() === s.toLowerCase()))
    .slice(0, 6);

  return (
    <div>
      {/* Chips + input */}
      <div className="glass flex min-h-[3.25rem] flex-wrap items-center gap-2 rounded-xl px-3 py-2.5">
        <AnimatePresence initial={false}>
          {items.map((chip) => (
            <motion.span
              key={chip}
              layout
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-sm text-primary"
              style={{ border: "1px solid var(--panel-border)" }}
            >
              {chip}
              <button
                onClick={() => remove(chip)}
                aria-label={`Remove ${chip}`}
                className="text-secondary transition-colors hover:text-primary"
              >
                ×
              </button>
            </motion.span>
          ))}
        </AnimatePresence>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && draft === "" && items.length) {
              remove(items[items.length - 1]);
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={items.length === 0 ? placeholder : "Add more…"}
          className="min-w-[8rem] flex-1 bg-transparent py-1 text-sm text-primary outline-none placeholder:text-faint"
        />
      </div>

      {/* Quick-add suggestions */}
      {visibleSuggestions.length > 0 && items.length < max && (
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {visibleSuggestions.map((s) => (
            <button
              key={s}
              onClick={() => add(s)}
              className="rounded-full px-3 py-1 text-xs text-secondary transition-colors hover:text-primary"
              style={{ border: "1px dashed var(--panel-border)" }}
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
