"use client";

import { motion } from "motion/react";
import { OpText } from "@/components/table/Card";
import { charmOf } from "@/lib/engine/charms";
import { fmt } from "@/lib/engine/ops";
import { seedLabel } from "@/lib/engine/rng";
import type { Round } from "@/lib/engine/round";
import { simulate, whatIf } from "@/lib/engine/whatif";

interface Props {
  round: Round;
  balance: number;
  onAgain: () => void;
  onLobby: () => void;
  onHide: () => void;
  canAgain: boolean;
  maxWager: number;
  /** Name of the charm "Deal again" will buy, if any. */
  againCharm: string | null;
}

export function Summary({ round, balance, onAgain, onLobby, onHide, canAgain, maxWager, againCharm }: Props) {
  const paid = round.outcome === "cashed" ? round.pot : 0;
  const luck = round.charmCost ?? 0;
  const net = paid - round.wager - round.fee - luck;

  // Cards still in the stack/queue when the player cashed out, in the order they'd have come out.
  const left = round.mode === "recursion" ? [] : round.mode === "stack" ? round.structure.slice().reverse() : round.structure;
  const ifContinued = left.length > 0 && round.outcome === "cashed" ? simulate(round.pot, left.map((c) => c.op)) : null;
  const { lines, count, partial } = whatIf(round);
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
          <p className="mt-1 font-sans text-sm tnum">
            <span className={net > 0 ? "text-brass-hi" : net < 0 ? "text-loss-hi" : "text-card/70"}>
              {net > 0 ? "+" : net < 0 ? "−" : "±"}
              {fmt(Math.abs(net))}
            </span>
            <span className="text-card/50"> · balance {fmt(balance)}</span>
          </p>
          <p className="mt-0.5 text-xs text-card/45 tnum">
            wager {fmt(round.wager)} · admin fee {fmt(round.fee)}
            {luck > 0 && ` · ${charmOf(round.charm).name.toLowerCase()} ${fmt(luck)}`} · paid out {fmt(paid)}
          </p>
          {(round.timedOut || round.autoPicked) && (
            <p className="mt-2 text-xs font-semibold text-brass-hi">
              {round.timedOut
                ? round.mode === "recursion"
                  ? "The clock ran out, so the stack returned for you."
                  : `The clock ran out, so you cashed out at ${fmt(round.pot)}.`
                : "The pick clock ran out, so some cards were picked for you."}
            </p>
          )}
        </div>
        <button type="button" onClick={onHide} className="shrink-0 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.16em] text-card/50 hover:text-card">
          View table
        </button>
      </div>

      {ifContinued && (
        <section className="mt-5 rounded-xl border border-felt-print/15 p-4" aria-labelledby="left-h">
          <h3 id="left-h" className="felt-print">
            Left unopened, next out first
          </h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {left.map((c) => (
              <span key={c.id} className="rounded-md bg-card px-2 py-1 text-ink">
                <OpText op={c.op} className="text-base" />
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-card/70">
            Opening them would have{" "}
            {ifContinued.busted ? (
              <span className="font-semibold text-loss-hi">busted you</span>
            ) : (
              <>
                ended at{" "}
                <span className={`font-semibold tnum ${ifContinued.final >= round.pot ? "text-brass-hi" : "text-loss-hi"}`}>
                  {fmt(ifContinued.final)}
                </span>
              </>
            )}
            {ifContinued.busted || ifContinued.final < round.pot ? ". Good call stopping." : "."}
          </p>
        </section>
      )}

      {lines.length > 0 && (
        <section className="mt-5 rounded-xl bg-black/25 p-4" aria-labelledby="whatif-h">
          <h3 id="whatif-h" className="felt-print">
            {partial
              ? `What if: the first ${count} card${count === 1 ? "" : "s"} out, in each order`
              : `What if: the same ${count} cards, fully played`}
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
                  <span className={`font-sans tnum ${l.result.busted ? "text-loss-hi" : "text-card"}`}>
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
                <p className="mt-1 font-sans text-[10px] text-felt-print/55">
                  {fmt(round.wager)} {l.result.steps.map((s) => `→ ${fmt(Math.max(0, s.after))}`).join(" ")}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-felt-print/10 pt-3 text-sm text-card/70">
            {swing === 0
              ? "Same result either way: multiplying doesn't care about order (2 × 3 = 3 × 2). Order matters when + or − cards are mixed in, or when you cash out early."
              : partial
                ? `You stopped after ${count}. The structure decided which cards those were, and that's worth ${fmt(swing)} chips.`
                : `Same cards. The order alone is worth ${fmt(swing)} chips.`}
            {round.fees > 0 && ` You also paid ${fmt(round.fees)} in peek/enqueue fees.`}
          </p>
        </section>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button type="button" onClick={onAgain} disabled={!canAgain} className="plaque plaque-brass flex-1 whitespace-nowrap">
          Deal again · {fmt(Math.min(round.wager, maxWager))}
          {againCharm && ` + ${againCharm.toLowerCase()}`}
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
