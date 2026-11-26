"use client";

import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { fmt } from "@/lib/engine/ops";
import type { TraceKind, TraceLine } from "@/lib/engine/round";

const TONE: Record<TraceKind, string> = {
  push: "text-card/85",
  take: "text-card",
  peek: "text-brass-hi/90",
  fee: "text-brass-hi/90",
  call: "text-card/85",
  base: "text-brass-hi",
  return: "text-card",
  bust: "text-loss-hi",
  cash: "text-brass-hi",
  info: "text-felt-print/70",
};

/** Live operation log: what the data structure actually did, step by step. */
export function TracePanel({ trace, className = "" }: { trace: TraceLine[]; className?: string }) {
  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    // Scroll only the log itself; scrollIntoView would drag the page along on mobile.
    const el = list.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [trace.length]);

  return (
    <section className={`flex min-h-0 flex-col rounded-xl bg-black/30 ${className}`} aria-labelledby="trace-h">
      <div className="flex items-center justify-between border-b border-felt-print/10 px-4 py-2.5">
        <h2 id="trace-h" className="felt-print">
          Trace
        </h2>
        <span className="font-mono text-[10px] text-felt-print/50 tnum">{trace.length} ops</span>
      </div>
      <ol ref={list} className="min-h-0 flex-1 overflow-y-auto px-2 py-2 font-mono text-[12px] leading-relaxed" aria-live="polite">
        {trace.map((t) => (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.25 }}
            className={`grid grid-cols-[2ch_1fr] gap-x-2 rounded px-2 py-0.5 ${TONE[t.kind]} ${
              t.kind === "bust" ? "bg-loss/15" : t.kind === "cash" ? "bg-brass/10" : ""
            }`}
          >
            <span className="text-felt-print/35 tnum">{String(t.id).padStart(2, "0")}</span>
            <span className="min-w-0">
              <span className="font-semibold">{t.call}</span>
              {t.result && <span className="text-card/60"> → {t.result}</span>}
              {t.before !== undefined && t.after !== undefined && (
                <span className="block text-[11px] text-felt-print/70 tnum">
                  pot {fmt(t.before)} → <span className={t.after > t.before ? "text-card" : t.after < t.before ? "text-loss-hi" : ""}>{fmt(Math.max(0, t.after))}</span>
                </span>
              )}
            </span>
          </motion.li>
        ))}
      </ol>
    </section>
  );
}
