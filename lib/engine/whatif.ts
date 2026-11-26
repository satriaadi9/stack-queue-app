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

const lifo = (cards: Card[]) => cards.slice().reverse().map((c) => c.op);
const fifo = (cards: Card[]) => cards.map((c) => c.op);

/**
 * Replays every card the player put in, fully resolved, under both orders.
 * Ignores peek/enqueue fees and early cash-outs: it isolates the effect of
 * the data structure's ordering alone.
 */
export function whatIf(round: Round): WhatIfLine[] {
  const cards = round.picks;
  if (cards.length === 0) return [];
  const w = round.wager;
  if (round.mode === "recursion") {
    return [
      { label: "Recursive", order: "deepest call returns first", result: simulate(w, lifo(cards)), native: true },
      { label: "As a loop", order: "top level applied first", result: simulate(w, fifo(cards)), native: false },
    ];
  }
  return [
    {
      label: "As a stack",
      order: "last in, first out",
      result: simulate(w, lifo(cards)),
      native: round.mode === "stack",
    },
    {
      label: "As a queue",
      order: "first in, first out",
      result: simulate(w, fifo(cards)),
      native: round.mode === "queue",
    },
  ];
}
