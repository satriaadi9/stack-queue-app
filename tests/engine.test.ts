import { describe, expect, it } from "vitest";
import { dealBoard, dealOffer } from "@/lib/engine/deal";
import { BOARD_SIZE, decodeDeck, encodeDeck, type DeckPreset } from "@/lib/engine/deck-code";
import { applyOp, parseOp, POT_CAP, type Op } from "@/lib/engine/ops";
import { drawOp, tierOf, TIERS } from "@/lib/engine/pool";
import { mulberry32 } from "@/lib/engine/rng";
import { createRound, legal, overflowRisk, payout, reduce, type Action, type Round } from "@/lib/engine/round";
import { simulate, whatIf } from "@/lib/engine/whatif";

const op = (s: string) => parseOp(s)!;
const run = (r: Round, ...actions: Action[]) => actions.reduce(reduce, r);

/** A fully fixed deck so outcomes are exact. Slot n holds ops[n-1]. */
function deck(ops: string[], extra: Partial<DeckPreset> = {}): DeckPreset {
  const slots = Array.from({ length: BOARD_SIZE }, (_, i) => (ops[i] ? op(ops[i]) : op("+1")));
  return { name: "test", mode: null, slots, maxPicks: 5, shuffle: false, ...extra };
}

describe("ops", () => {
  it("applies integer math with floor division", () => {
    expect(applyOp(10, op("+20"))).toBe(30);
    expect(applyOp(10, op("-21"))).toBe(-11);
    expect(applyOp(10, op("x20"))).toBe(200);
    expect(applyOp(7, op("/2"))).toBe(3);
  });
  it("handles decimal multipliers without float drift", () => {
    expect(applyOp(100, op("x1.4"))).toBe(140);
    expect(applyOp(100, op("x1.1"))).toBe(110);
    expect(applyOp(7, op("x1.5"))).toBe(10);
    expect(applyOp(100, op("/1.5"))).toBe(66);
    expect(applyOp(1, op("x0.9"))).toBe(0);
  });
  it("caps the pot", () => {
    expect(applyOp(POT_CAP, op("x20"))).toBe(POT_CAP);
  });
  it("parses and rejects", () => {
    expect(parseOp("x5")).toEqual({ kind: "mul", n: 5 });
    expect(parseOp("x1.5")).toEqual({ kind: "mul", n: 1.5 });
    expect(parseOp("/2.5")).toEqual({ kind: "div", n: 2.5 });
    expect(parseOp("+1.5")).toBeNull(); // adds stay whole numbers
    expect(parseOp("x1.555")).toBeNull();
    expect(parseOp("/0")).toBeNull();
    expect(parseOp("x101")).toBeNull();
    expect(parseOp("hello")).toBeNull();
  });
});

describe("pool", () => {
  it("weights sum to 100", () => {
    expect(TIERS.reduce((s, t) => s + t.weight, 0)).toBe(100);
  });
  it("every pool op classifies into its own tier", () => {
    for (const t of TIERS) for (const o of t.ops) expect(tierOf(o)).toBe(t.tier);
  });
  it("default pool stays between x0 and x3", () => {
    for (const t of TIERS) for (const o of t.ops) expect(o.n).toBeLessThanOrEqual(3);
  });
  it("draws roughly by weight", () => {
    const rand = mulberry32(42);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) {
      const t = tierOf(drawOp(rand));
      counts[t] = (counts[t] ?? 0) + 1;
    }
    expect(counts.common / 20000).toBeCloseTo(0.55, 1);
    expect(counts.legendary / 20000).toBeCloseTo(0.05, 1);
  });
});

describe("dealing", () => {
  it("is deterministic per seed", () => {
    expect(dealBoard(123, null)).toEqual(dealBoard(123, null));
    expect(dealBoard(123, null)).not.toEqual(dealBoard(124, null));
    expect(dealOffer(9, 3, null)).toEqual(dealOffer(9, 3, null));
  });
  it("uses preset slots in order unless shuffled", () => {
    const p = deck(["x20", "-21"]);
    const b = dealBoard(1, p);
    expect(b[0].op).toEqual(op("x20"));
    expect(b[1].op).toEqual(op("-21"));
    expect(b.map((c) => c.slot)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

describe("stack (LIFO)", () => {
  // Pick #1 (+20) then #2 (x2): stack pops x2 first, then +20.
  const start = () => createRound({ mode: "stack", wager: 10, seed: 1, preset: deck(["+20", "x2", "-21"]) });

  it("pops in reverse push order", () => {
    const r = run(start(), { type: "pick", slot: 1 }, { type: "pick", slot: 2 }, { type: "pick", slot: 3 }, { type: "deal" });
    expect(r.phase).toBe("resolve");
    const r1 = reduce(r, { type: "take" }); // -21 → bust
    expect(r1.resolved[0].card.slot).toBe(3);
    expect(r1.outcome).toBe("bust");
    expect(payout(r1)).toBe(0);
  });

  it("ordering changes the payout", () => {
    // push +20, x2, +1 → pop +1, x2, +20 → ((10+1)*2)+20 = 42
    const p = deck(["+20", "x2", "+1"]);
    const r = run(
      createRound({ mode: "stack", wager: 10, seed: 1, preset: p }),
      { type: "pick", slot: 1 },
      { type: "pick", slot: 2 },
      { type: "pick", slot: 3 },
      { type: "deal" },
      { type: "take" },
      { type: "take" },
      { type: "take" },
    );
    expect(r.outcome).toBe("cashed");
    expect(r.pot).toBe(42);
    const lines = whatIf(r).lines;
    expect(lines.find((l) => l.label === "As a stack")!.result.final).toBe(42);
    expect(lines.find((l) => l.label === "As a queue")!.result.final).toBe(61); // (10+20)*2+1
  });

  it("what-if replays only as many cards as were taken before cashing out", () => {
    // picks x3, x2, +1 · stack pops +1 then cashes out
    const p = deck(["x3", "x2", "+1"]);
    const r = run(
      createRound({ mode: "stack", wager: 10, seed: 1, preset: p }),
      { type: "pick", slot: 1 },
      { type: "pick", slot: 2 },
      { type: "pick", slot: 3 },
      { type: "deal" },
      { type: "take" },
      { type: "cashout" },
    );
    const w = whatIf(r);
    expect(w.count).toBe(1);
    expect(w.partial).toBe(true);
    expect(w.lines.find((l) => l.label === "As a stack")!.result.final).toBe(11); // +1
    expect(w.lines.find((l) => l.label === "As a queue")!.result.final).toBe(30); // x3
  });

  it("needs minimum picks before deal and blocks illegal moves", () => {
    let r = start();
    r = run(r, { type: "pick", slot: 1 }, { type: "deal" });
    expect(r.phase).toBe("build");
    expect(reduce(r, { type: "take" })).toBe(r);
    r = run(r, { type: "pick", slot: 1 }); // already taken
    expect(r.structure).toHaveLength(1);
  });

  it("auto-deals at max picks", () => {
    const r = run(start(), ...[1, 2, 3, 4, 5].map((slot) => ({ type: "pick", slot }) as Action));
    expect(r.phase).toBe("resolve");
    expect(legal(r).pick).toBe(false);
  });

  it("peek reveals the top for 25% of the wager, once per round", () => {
    let r = run(start(), { type: "pick", slot: 4 }, { type: "pick", slot: 5 }, { type: "pick", slot: 2 }, { type: "deal" });
    r = reduce(r, { type: "peek" });
    expect(r.revealed).toContain("b2");
    expect(r.pot).toBe(7); // ceil(10 × 0.25) = 3
    expect(reduce(r, { type: "peek" })).toBe(r);
    r = reduce(r, { type: "take" }); // new top card, but the peek is spent
    expect(legal(r).peek).toBe(false);
  });

  it("cash out only after at least one take", () => {
    let r = run(start(), { type: "pick", slot: 4 }, { type: "pick", slot: 5 }, { type: "pick", slot: 6 }, { type: "deal" });
    expect(legal(r).cashout).toBe(false);
    r = run(r, { type: "take" }, { type: "cashout" });
    expect(r.outcome).toBe("cashed");
    expect(payout(r)).toBe(11);
  });
});

describe("queue (FIFO)", () => {
  it("dequeues in insertion order and allows one enqueue per dequeue", () => {
    const p = deck(["+20", "x2", "+1", "x3"]);
    let r = run(
      createRound({ mode: "queue", wager: 100, seed: 1, preset: p }),
      { type: "pick", slot: 1 },
      { type: "pick", slot: 2 },
      { type: "pick", slot: 3 },
      { type: "deal" },
    );
    expect(legal(r).enqueue).toBe(false);
    r = reduce(r, { type: "take" });
    expect(r.resolved[0].card.slot).toBe(1);
    expect(r.pot).toBe(120);
    r = reduce(r, { type: "enqueue", slot: 4 }); // fee 5
    expect(r.pot).toBe(115);
    expect(r.structure.map((c) => c.slot)).toEqual([2, 3, 4]);
    expect(legal(r).enqueue).toBe(false);
    r = run(r, { type: "take" }, { type: "take" }, { type: "take" });
    expect(r.outcome).toBe("cashed");
    expect(r.pot).toBe((115 * 2 + 1) * 3);
  });
});

describe("recursion", () => {
  const p = deck(["x5", "+1", "+1", "+20", "+1", "+1", "-21", "+1", "+1"]);
  it("unwinds deepest frame first", () => {
    let r = createRound({ mode: "recursion", wager: 10, seed: 7, preset: p });
    r = run(r, { type: "choose", index: 0 }); // x5 at depth 1
    // seed 7 may overflow; risk at depth 2 is 8%, find a seed that doesn't
    let seed = 7;
    while (reduce(r, { type: "dive" }).outcome === "overflow") {
      seed++;
      r = run(createRound({ mode: "recursion", wager: 10, seed, preset: p }), { type: "choose", index: 0 });
    }
    r = run(r, { type: "dive" }, { type: "choose", index: 0 }, { type: "return" }); // +20 at depth 2
    expect(r.phase).toBe("resolve");
    r = run(r, { type: "unwind" });
    expect(r.pot).toBe(30); // 10 + 20 first
    r = run(r, { type: "unwind" });
    expect(r.pot).toBe(150); // then x5
    expect(r.outcome).toBe("cashed");
    expect(whatIf(r).lines.find((l) => !l.native)!.result.final).toBe(70); // 10*5 + 20
  });

  it("overflow risk grows with depth and can bust", () => {
    expect(overflowRisk(1)).toBe(0);
    expect(overflowRisk(2)).toBeCloseTo(0.08);
    expect(overflowRisk(8)).toBeCloseTo(0.56);
    let busted = 0;
    for (let seed = 0; seed < 300; seed++) {
      const r = run(createRound({ mode: "recursion", wager: 10, seed, preset: null }), { type: "choose", index: 0 }, { type: "dive" });
      if (r.outcome === "overflow") busted++;
    }
    expect(busted / 300).toBeGreaterThan(0.03);
    expect(busted / 300).toBeLessThan(0.15);
  });

  it("requires a choice before diving or returning", () => {
    const r = createRound({ mode: "recursion", wager: 10, seed: 1, preset: null });
    expect(reduce(r, { type: "dive" })).toBe(r);
    expect(reduce(r, { type: "return" })).toBe(r);
  });
});

describe("simulate", () => {
  it("stops at bust", () => {
    const res = simulate(10, [op("-21"), op("x20")] as Op[]);
    expect(res.busted).toBe(true);
    expect(res.steps).toHaveLength(1);
  });
});

describe("deck codes", () => {
  it("round-trips", () => {
    const p: DeckPreset = { ...deck(["x20", "-21", "/2", "x1.5", "/2.5"]), name: "Kelas Struktur Data", mode: "queue", shuffle: true, maxPicks: 4 };
    p.slots[5] = null;
    expect(decodeDeck(encodeDeck(p))).toEqual(p);
  });
  it("rejects garbage", () => {
    expect(decodeDeck("not a code!")).toBeNull();
    expect(decodeDeck("eyJ2IjoyfQ")).toBeNull(); // {"v":2}
    expect(decodeDeck("")).toBeNull();
  });
});
