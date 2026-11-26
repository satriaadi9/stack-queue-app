import { describe, expect, it } from "vitest";
import { CHARMS, charmCost, charmsApply, oddsFor, weightsFor } from "@/lib/engine/charms";
import { dealBoard } from "@/lib/engine/deal";
import { BOARD_SIZE, decodeDeck, encodeDeck, type DeckPreset } from "@/lib/engine/deck-code";
import { parseOp } from "@/lib/engine/ops";
import { BASE_WEIGHTS, drawOp } from "@/lib/engine/pool";
import { mulberry32 } from "@/lib/engine/rng";
import { createRound } from "@/lib/engine/round";

const tierShare = (charm: Parameters<typeof weightsFor>[0], tier: string, n = 20000) => {
  const rand = mulberry32(42);
  const w = weightsFor(charm);
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const op = drawOp(rand, w);
    const legendary = op.kind === "mul" && op.n === 3;
    if (tier === "legendary" && legendary) hits++;
    if (tier === "cursed" && ((op.kind === "mul" && op.n === 0) || (op.kind === "div" && op.n === 3))) hits++;
  }
  return hits / n;
};

describe("luck charms", () => {
  it("keep the odds summing to 100%, taking only from common cards", () => {
    for (const c of CHARMS) {
      const w = weightsFor(c.id);
      expect(Object.values(w).reduce((a, b) => a + b, 0)).toBeCloseTo(100);
      for (const t of ["rare", "epic", "legendary", "cursed"] as const) {
        if (!(t in c.shift)) expect(w[t]).toBe(BASE_WEIGHTS[t]);
      }
    }
    expect(oddsFor("legendary").legendary).toBe(15);
    expect(oddsFor("legendary").common).toBe(45);
    expect(oddsFor("none")).toEqual(BASE_WEIGHTS);
  });

  it("change what is actually drawn", () => {
    expect(tierShare("none", "legendary")).toBeCloseTo(0.05, 1);
    expect(tierShare("legendary", "legendary")).toBeCloseTo(0.15, 1);
    expect(tierShare("ward", "cursed")).toBe(0);
  });

  it("cost a share of the wager, at least 1 chip, and nothing for no charm", () => {
    expect(charmCost(100, "none")).toBe(0);
    expect(charmCost(100, "legendary")).toBe(40);
    expect(charmCost(100, "steady")).toBe(2);
    expect(charmCost(10, "steady")).toBe(1);
    expect(charmCost(0, "legendary")).toBe(0);
  });

  it("deal a reproducible, different board from the same seed", () => {
    const plain = createRound({ mode: "stack", wager: 100, seed: 9, preset: null });
    const gold = createRound({ mode: "stack", wager: 100, seed: 9, preset: null, charm: "legendary", charmCost: 40 });
    const again = createRound({ mode: "stack", wager: 100, seed: 9, preset: null, charm: "legendary", charmCost: 40 });
    expect(gold.board).toEqual(again.board);
    expect(gold.board).toEqual(dealBoard(9, null, weightsFor("legendary")));
    expect(gold.charm).toBe("legendary");
    expect(gold.charmCost).toBe(40);
    expect(plain.charm).toBe("none");
    expect(plain.charmCost).toBe(0);
  });

  it("never touch host-set slots, and don't apply to a fully set deck", () => {
    const full: DeckPreset = {
      name: "",
      mode: null,
      slots: Array.from({ length: BOARD_SIZE }, () => parseOp("+1")),
      maxPicks: 5,
      shuffle: false,
      feeRate: null,
      timers: null,
      startChips: null,
    };
    expect(charmsApply(full)).toBe(false);
    expect(charmsApply(null)).toBe(true);
    const mixed = { ...full, slots: full.slots.map((s, i) => (i === 0 ? null : s)) };
    expect(charmsApply(mixed)).toBe(true);
    const board = dealBoard(3, mixed, weightsFor("legendary"));
    expect(board.slice(1).every((c) => c.op.kind === "add" && c.op.n === 1)).toBe(true);
  });
});

describe("starting chips in the deck link", () => {
  const base = encodeDeck({
    name: "",
    mode: null,
    slots: Array.from({ length: BOARD_SIZE }, () => null),
    maxPicks: 5,
    shuffle: false,
    feeRate: null,
    timers: null,
    startChips: 2500,
  });
  it("round-trips", () => {
    expect(decodeDeck(base)?.startChips).toBe(2500);
  });
  it("accepts 10 up to 1,000,000 and rejects anything outside", () => {
    const withC = (c: number) =>
      Buffer.from(JSON.stringify({ v: 1, m: null, s: Array(12).fill("?").join(","), p: 5, sh: 0, c })).toString("base64url");
    expect(decodeDeck(withC(10))?.startChips).toBe(10);
    expect(decodeDeck(withC(1_000_000))?.startChips).toBe(1_000_000);
    expect(decodeDeck(withC(9))).toBeNull();
    expect(decodeDeck(withC(1_000_001))).toBeNull();
  });
});
