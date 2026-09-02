"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Profile } from "@/lib/types";

type Status =
  | { state: "idle" }
  | { state: "reading"; fileName: string }
  | { state: "error"; message: string };

const MAX_FILE_BYTES = 5 * 1024 * 1024;

export default function CVUpload({
  onExtracted,
  onSwitchToForm,
  onBack,
}: {
  onExtracted: (profile: Profile, note?: string) => void;
  onSwitchToForm: () => void;
  onBack: () => void;
}) {
  const [status, setStatus] = useState<Status>({ state: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".pdf") && !name.endsWith(".docx")) {
      setStatus({
        state: "error",
        message: "Please upload a PDF or DOCX file.",
      });
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setStatus({
        state: "error",
        message: "That file is over 5MB. Try exporting a lighter version.",
      });
      return;
    }

    setStatus({ state: "reading", fileName: file.name });
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/parse-cv", { method: "POST", body: form });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.profile) {
        setStatus({
          state: "error",
          message:
            data?.error ??
            "Something went wrong reading your CV. Please try again.",
        });
        return;
      }
      onExtracted(data.profile as Profile, data.note);
    } catch {
      setStatus({
        state: "error",
        message: "Network hiccup — we couldn't reach the reader. Try again.",
      });
    }
  };

  const reading = status.state === "reading";

  return (
    <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg"
      >
        <h2 className="text-center font-display text-2xl font-semibold sm:text-3xl">
          Let&apos;s read your story so far
        </h2>
        <p className="mt-3 text-center text-sm leading-relaxed text-secondary">
          Upload your CV and we&apos;ll pull out your skills and interests.
          You&apos;ll review everything before a single star is drawn.
        </p>

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload CV"
          onClick={() => !reading && inputRef.current?.click()}
          onKeyDown={(e) =>
            (e.key === "Enter" || e.key === " ") &&
            !reading &&
            inputRef.current?.click()
          }
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file && !reading) handleFile(file);
          }}
          className={`glass mt-8 flex cursor-pointer flex-col items-center justify-center rounded-2xl px-8 py-12 text-center transition-all ${
            dragOver ? "scale-[1.02]" : ""
          }`}
          style={{
            borderStyle: "dashed",
            borderColor: dragOver ? "var(--accent)" : "var(--panel-border)",
            boxShadow: dragOver ? "0 0 40px var(--accent-soft)" : undefined,
          }}
        >
          {reading ? (
            <>
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 2.4, ease: "linear" }}
                className="glow-text text-3xl"
              >
                ✦
              </motion.span>
              <p className="mt-4 text-sm font-medium text-primary">
                Reading {status.state === "reading" ? status.fileName : ""}…
              </p>
              <p className="mt-1 text-xs text-faint">
                Extracting skills & interests
              </p>
            </>
          ) : (
            <>
              <span className="glow-text text-3xl">⬆</span>
              <p className="mt-4 text-sm font-medium text-primary">
                Drag &amp; drop your CV here
              </p>
              <p className="mt-1 text-xs text-faint">
                or click to browse · PDF or DOCX · max 5MB
              </p>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
        />

        {/* Error state */}
        {status.state === "error" && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-xl px-4 py-3 text-center text-sm text-primary"
            style={{
              background: "rgba(248, 113, 113, 0.08)",
              border: "1px solid rgba(248, 113, 113, 0.3)",
            }}
          >
            {status.message}
          </motion.p>
        )}

        <div className="mt-8 flex items-center justify-center gap-6 text-sm">
          <button
            onClick={onBack}
            className="text-secondary transition-colors hover:text-primary"
          >
            ← Back
          </button>
          <button
            onClick={onSwitchToForm}
            className="text-secondary underline underline-offset-4 transition-colors hover:text-primary"
          >
            Answer questions instead
          </button>
        </div>
      </motion.div>
    </div>
  );
}
