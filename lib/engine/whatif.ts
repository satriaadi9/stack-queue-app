import type { Card } from "./deal";
import { applyOp, type Op } from "./ops";
import type { Round } from "./round";

export interface SimStep {
  op: Op;
  before: number;
  after: number;
}

export interface SimResult {
  final: number;
  busted: boolean;
  steps: SimStep[];
}

/** Apply ops in order to a starting pot, stopping at the first bust (≤ 0). */
export function simulate(start: number, ops: Op[]): SimResult {
  let pot = start;
  const steps: SimStep[] = [];
  for (const op of ops) {
    const after = applyOp(pot, op);
    steps.push({ op, before: pot, after });
    pot = after;
    if (pot <= 0) return { final: 0, busted: true, steps };
  }
  return { final: pot, busted: false, steps };
}

export interface WhatIfLine {
  label: string;
  order: string; // short description of the order rule
  result: SimResult;
  /** True for the order this round's structure actually uses. */
  native: boolean;
}

export interface WhatIf {
  /** How many cards each line replays. */
  count: number;
  /** True when that is fewer than were picked (the player cashed out or busted early). */
  partial: boolean;
  lines: WhatIfLine[];
}

const lifo = (cards: Card[], k: number) => cards.slice().reverse().slice(0, k).map((c) => c.op);
const fifo = (cards: Card[], k: number) => cards.slice(0, k).map((c) => c.op);

/**
 * Replays the round under both orders, ignoring fees, so only the data
 * structure's ordering differs. For stack/queue it replays as many cards as the
 * player actually took. With mostly × cards the full total barely depends on
 * order, but which cards come out before you cash out depends on it entirely.
 */
export function whatIf(round: Round): WhatIf {
  const cards = round.picks;
  const total = cards.length;
  const w = round.wager;
  if (total === 0) return { count: 0, partial: false, lines: [] };
  if (round.mode === "recursion") {
    return {
      count: total,
      partial: false,
      lines: [
        { label: "Recursive", order: "deepest call returns first", result: simulate(w, lifo(cards, total)), native: true },
        { label: "As a loop", order: "top level applied first", result: simulate(w, fifo(cards, total)), native: false },
      ],
    };
  }
  const k = round.phase === "done" && round.resolved.length > 0 ? round.resolved.length : total;
  return {
    count: k,
    partial: k < total,
    lines: [
      { label: "As a stack", order: "last in, first out", result: simulate(w, lifo(cards, k)), native: round.mode === "stack" },
      { label: "As a queue", order: "first in, first out", result: simulate(w, fifo(cards, k)), native: round.mode === "queue" },
    ],
  };
}
