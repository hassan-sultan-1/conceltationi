"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CNode, ConstellationData } from "@/lib/constellation";
import { Profile } from "@/lib/types";

interface Message {
  role: "user" | "assistant";
  text: string;
  isError?: boolean;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent)" }}
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.15 }}
        />
      ))}
    </div>
  );
}

export default function ChatWidget({
  profile,
  data,
  onMessageSent,
}: {
  profile: Profile;
  data: ConstellationData;
  onMessageSent?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const sentCount = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const topCareers = data.nodes
    .filter((n: CNode) => n.type === "career")
    .sort((a, b) => b.brightness - a.brightness);

  const starters = [
    topCareers.length >= 2
      ? `Compare my ${topCareers[0].label} and ${topCareers[1].label} paths`
      : "Which career fits me best?",
    "What's the very first thing I should learn?",
    "Which skill should I strengthen most?",
  ];

  const send = async (text: string) => {
    const clean = text.trim().slice(0, 600);
    if (!clean || pending) return;
    setDraft("");
    setMessages((m) => [...m, { role: "user", text: clean }]);
    setPending(true);
    sentCount.current += 1;
    onMessageSent?.(sentCount.current);

    try {
      const history = messages
        .filter((m) => !m.isError)
        .map((m) => ({
          role: m.role === "user" ? "user" : "model",
          text: m.text,
        }));
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: clean,
          history,
          profile,
          nodes: data.nodes,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.reply) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text:
              body?.error ??
              "The Sky Guide couldn't reach the stars just now. Give it a moment and try again.",
            isError: true,
          },
        ]);
      } else {
        setMessages((m) => [...m, { role: "assistant", text: body.reply }]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: "Connection lost on the way to the stars — check your network and try again.",
          isError: true,
        },
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, duration: 0.4 }}
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close Sky Guide chat" : "Open Sky Guide chat"}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full text-xl transition-transform hover:scale-105 active:scale-95"
        style={{
          background: "var(--accent-strong)",
          color: "#fff",
          boxShadow: "0 0 24px var(--accent-soft), 0 4px 20px rgba(0,0,0,0.4)",
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        ) : (
          <span>✧</span>
        )}
      </motion.button>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="glass fixed bottom-[5.5rem] right-5 z-50 flex h-[30rem] max-h-[calc(100vh-8rem)] w-[22.5rem] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl"
          >
            {/* Header */}
            <div
              className="flex items-center gap-2.5 px-5 py-3.5"
              style={{ borderBottom: "1px solid var(--panel-border)" }}
            >
              <span className="glow-text text-lg leading-none">✧</span>
              <div>
                <p className="font-display text-sm font-semibold leading-tight">
                  Sky Guide
                </p>
                <p className="text-[11px] text-faint">
                  Knows your whole constellation
                </p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div
                    className="max-w-[85%] rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm leading-relaxed text-secondary"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    I can see your whole sky — every skill and career star in
                    it. Ask me anything about your paths.
                  </div>
                  <div className="flex flex-col items-start gap-2">
                    {starters.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="rounded-full px-3.5 py-1.5 text-left text-xs text-secondary transition-colors hover:text-primary"
                        style={{ border: "1px dashed var(--panel-border)" }}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm text-white"
                        : "rounded-tl-sm text-secondary"
                    }`}
                    style={
                      m.role === "user"
                        ? { background: "var(--accent-strong)" }
                        : {
                            background: m.isError
                              ? "rgba(248, 113, 113, 0.08)"
                              : "var(--accent-soft)",
                            border: `1px solid ${
                              m.isError
                                ? "rgba(248, 113, 113, 0.3)"
                                : "var(--panel-border)"
                            }`,
                          }
                    }
                  >
                    {m.text}
                  </div>
                </motion.div>
              ))}

              {pending && (
                <div className="flex justify-start">
                  <div
                    className="rounded-2xl rounded-tl-sm px-3 py-2"
                    style={{
                      background: "var(--accent-soft)",
                      border: "1px solid var(--panel-border)",
                    }}
                  >
                    <TypingDots />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(draft);
              }}
              className="flex items-center gap-2 px-4 py-3"
              style={{ borderTop: "1px solid var(--panel-border)" }}
            >
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about your sky…"
                maxLength={600}
                className="flex-1 rounded-full bg-transparent px-3.5 py-2 text-sm text-primary outline-none placeholder:text-faint"
                style={{ border: "1px solid var(--panel-border)" }}
              />
              <button
                type="submit"
                disabled={pending || !draft.trim()}
                aria-label="Send"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white transition-transform enabled:hover:scale-105 disabled:opacity-40"
                style={{ background: "var(--accent-strong)" }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m22 2-7 20-4-9-9-4Z" />
                  <path d="M22 2 11 13" />
                </svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
