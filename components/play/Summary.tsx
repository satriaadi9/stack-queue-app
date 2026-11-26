"use client";

import { motion } from "motion/react";
import { fmt } from "@/lib/engine/ops";
import { seedLabel } from "@/lib/engine/rng";
import type { Round } from "@/lib/engine/round";
import { whatIf } from "@/lib/engine/whatif";

interface Props {
  round: Round;
  balance: number;
  onAgain: () => void;
  onLobby: () => void;
  onHide: () => void;
  canAgain: boolean;
}

export function Summary({ round, balance, onAgain, onLobby, onHide, canAgain }: Props) {
  const net = (round.outcome === "cashed" ? round.pot : 0) - round.wager;
  const lines = whatIf(round);
  const values = lines.map((l) => l.result.final);
  const best = Math.max(...values, 1);
  const swing = values.length === 2 ? Math.abs(values[0] - values[1]) : 0;

  const headline =
    round.outcome === "overflow"
      ? "Stack overflow"
      : round.outcome === "bust"
        ? "Bust"
        : round.mode === "recursion"
          ? "Returned"
          : net >= 0
            ? "Cashed out"
            : "Cashed out short";

  return (
    <motion.div
      role="dialog"
      aria-modal="false"
      aria-labelledby="summary-h"
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 40, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 34 }}
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-b-0 border-brass/50 bg-felt-deep px-5 pb-6 pt-5 shadow-[0_-20px_50px_rgb(0_0_0/0.5)] sm:bottom-6 sm:rounded-2xl sm:border-b"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="summary-h"
            className={`font-display text-3xl font-bold ${round.outcome === "cashed" ? "text-card" : "text-loss-hi"}`}
          >
            {headline}
          </h2>
          <p className="mt-1 font-mono text-sm tnum">
            <span className={net > 0 ? "text-brass-hi" : net < 0 ? "text-loss-hi" : "text-card/70"}>
              {net > 0 ? "+" : net < 0 ? "−" : "±"}
              {fmt(Math.abs(net))}
            </span>
            <span className="text-card/50"> · balance {fmt(balance)}</span>
          </p>
        </div>
        <button type="button" onClick={onHide} className="text-xs font-semibold uppercase tracking-[0.16em] text-card/50 hover:text-card">
          View table
        </button>
      </div>

      {lines.length > 0 && (
        <section className="mt-5 rounded-xl bg-black/25 p-4" aria-labelledby="whatif-h">
          <h3 id="whatif-h" className="felt-print">
            What if: the same {round.picks.length} cards, fully played
          </h3>
          <ul className="mt-3 space-y-3">
            {lines.map((l) => (
              <li key={l.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span>
                    <span className="font-semibold">{l.label}</span>
                    <span className="text-card/50"> · {l.order}</span>
                    {l.native && <span className="ml-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brass-hi">this table</span>}
                  </span>
                  <span className={`font-mono tnum ${l.result.busted ? "text-loss-hi" : "text-card"}`}>
                    {l.result.busted ? "bust" : fmt(l.result.final)}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/30">
                  <motion.div
                    className={`h-full rounded-full ${l.native ? "bg-brass" : "bg-felt-print/60"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${(l.result.final / best) * 100}%` }}
                    transition={{ duration: 0.8, delay: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  />
                </div>
                <p className="mt-1 font-mono text-[10px] text-felt-print/55">
                  {fmt(round.wager)} {l.result.steps.map((s) => `→ ${fmt(Math.max(0, s.after))}`).join(" ")}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-felt-print/10 pt-3 text-sm text-card/70">
            {swing === 0
              ? "Both orders land in the same place this time. It happens when the cards are all + or all ×."
              : `Same cards. The order alone is worth ${fmt(swing)} chips.`}
            {round.fees > 0 && ` You also paid ${fmt(round.fees)} in peek/enqueue fees.`}
          </p>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onAgain} disabled={!canAgain} className="plaque plaque-brass flex-1 whitespace-nowrap">
          Deal again · {fmt(Math.min(round.wager, balance))}
          <span className="kbd">Enter</span>
        </button>
        <button type="button" onClick={onLobby} className="plaque plaque-ghost flex-1 whitespace-nowrap">
          Change table
        </button>
      </div>
      <p className="mt-4 text-center font-mono text-[10px] text-felt-print/40">round seed {seedLabel(round.seed)}</p>
    </motion.div>
  );
}
