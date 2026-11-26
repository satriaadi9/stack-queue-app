"use client";

import { motion } from "motion/react";
import type { Round } from "@/lib/engine/round";

const LINES: { code: string; key: Line | null }[] = [
  { code: "function dive(d) {", key: null },
  { code: "  const card = choose(deal(3));", key: "choose" },
  { code: "  if (player.returns) return wager;", key: "base" },
  { code: "  const result = dive(d + 1);", key: "recurse" },
  { code: "  return card.apply(result);", key: "apply" },
  { code: "}", key: null },
];

type Line = "choose" | "base" | "recurse" | "apply";

function activeLine(r: Round): Line | null {
  if (r.phase === "done") return r.outcome === "overflow" ? "recurse" : null;
  if (r.phase === "resolve") return "apply";
  return r.offer ? "choose" : "base";
}

/** The recursive function the table is running, with the current line lit. */
export function CodePane({ round }: { round: Round }) {
  const line = activeLine(round);
  const crashed = round.outcome === "overflow";
  return (
    <section className="rounded-xl bg-black/30" aria-labelledby="code-h">
      <div className="flex items-center justify-between border-b border-felt-print/10 px-4 py-2.5">
        <h2 id="code-h" className="felt-print">
          Running
        </h2>
        <span className="font-mono text-[10px] text-felt-print/50 tnum">
          {round.phase === "resolve" ? `${round.structure.length} frames left` : `depth ${round.depth}`}
        </span>
      </div>
      <pre className="overflow-x-auto px-2 py-3 font-mono text-[12px] leading-[1.7]">
        {LINES.map((l, i) => {
          const on = l.key !== null && l.key === line;
          return (
            <div key={i} className="relative px-2">
              {on && (
                <motion.span
                  layoutId="code-line"
                  className={`absolute inset-0 rounded ${crashed ? "bg-loss/25" : "bg-brass/20"}`}
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                  aria-hidden
                />
              )}
              <span className={`relative ${on ? "text-card" : "text-card/50"}`}>{l.code}</span>
            </div>
          );
        })}
      </pre>
      {crashed && (
        <p className="border-t border-loss/30 px-4 py-2.5 font-mono text-[11px] text-loss-hi">
          RangeError: Maximum call stack size exceeded at dive({round.overflowDepth})
        </p>
      )}
    </section>
  );
}
