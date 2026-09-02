"use client";

import { EXPERIENCE_LEVELS, ExperienceLevel } from "@/lib/types";

export default function ExperiencePicker({
  value,
  onChange,
}: {
  value: ExperienceLevel;
  onChange: (level: ExperienceLevel) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {EXPERIENCE_LEVELS.map((level) => {
        const active = value === level.id;
        return (
          <button
            key={level.id}
            onClick={() => onChange(level.id)}
            className={`rounded-xl px-3 py-2.5 text-xs font-medium transition-all sm:text-sm ${
              active ? "text-primary" : "text-secondary hover:text-primary"
            }`}
            style={{
              background: active ? "var(--accent-soft)" : "var(--panel-bg)",
              border: `1px solid ${active ? "var(--accent)" : "var(--panel-border)"}`,
              boxShadow: active ? "0 0 20px var(--accent-soft)" : undefined,
            }}
          >
            {level.label}
          </button>
        );
      })}
    </div>
  );
}
