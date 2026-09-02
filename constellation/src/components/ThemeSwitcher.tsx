"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { THEMES, ThemeId, applyTheme, getStoredTheme } from "@/lib/theme";

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<ThemeId>("nebula");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setTheme(getStoredTheme());
  }, []);

  const select = (id: ThemeId) => {
    setTheme(id);
    applyTheme(id);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Switch theme"
        className="glass flex h-10 w-10 items-center justify-center rounded-full text-secondary transition-colors hover:text-primary"
      >
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="13.5" cy="6.5" r="0.8" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="0.8" fill="currentColor" />
          <circle cx="8.5" cy="7.5" r="0.8" fill="currentColor" />
          <circle cx="6.5" cy="12.5" r="0.8" fill="currentColor" />
          <path d="M12 22a1 1 0 0 1-1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1-1 1zm0-20a10 10 0 0 0 0 20 10 10 0 0 0 8.66-15A10 10 0 0 0 12 2z" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="glass absolute right-0 top-12 z-50 w-44 rounded-xl p-1.5"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => select(t.id)}
                className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  theme === t.id
                    ? "bg-accent-soft text-primary"
                    : "text-secondary hover:text-primary"
                }`}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    background: t.swatch,
                    boxShadow: `0 0 8px ${t.swatch}`,
                  }}
                />
                {t.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
