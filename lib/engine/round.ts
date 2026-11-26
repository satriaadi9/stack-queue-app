import { dealBoard, dealOffer, STREAM_AUTO, STREAM_OVERFLOW, type Card } from "./deal";
import { DEFAULT_MAX_PICKS, type DeckPreset, type Mode } from "./deck-code";
import { applyOp, fmt, formatOp } from "./ops";
import { rngFor } from "./rng";
import type { Timers } from "./rules";
import { simulate } from "./whatif";

export const MAX_DEPTH = 8;
export const MAX_QUEUE = 8;
export const WAGERS = [10, 50, 100, 250] as const;

export type Phase = "build" | "resolve" | "done";
export type Outcome = "cashed" | "bust" | "overflow";

export type TraceKind = "push" | "take" | "peek" | "fee" | "call" | "base" | "return" | "bust" | "cash" | "info";

export interface TraceLine {
  id: number;
  kind: TraceKind;
  call: string;
  result?: string;
  before?: number;
  after?: number;
}

export interface Resolved {
  card: Card;
  before: number;
  after: number;
}

export interface Round {
  mode: Mode;
  seed: number;
  wager: number;
  pot: number;
  phase: Phase;
  outcome: Outcome | null;
  preset: DeckPreset | null;
  minPicks: number;
  maxPicks: number;

  /** Stack/queue: the 12-card board. Empty in recursion. */
  board: Card[];
  /** Ids of board cards moved into the structure. */
  taken: string[];
  /** Stack: last element is the TOP. Queue: first element is the FRONT. Recursion: call frames, last = deepest. */
  structure: Card[];
  /** Every card put in, in insertion order (drives the what-if replay). */
  picks: Card[];
  /** Cards applied to the pot, in application order. */
  resolved: Resolved[];
  /** Card ids whose face is visible. */
  revealed: string[];
  fees: number;
  /** Peek is allowed once per round. */
  peekUsed: boolean;
  /** Queue only: an extra enqueue is allowed once per dequeue. */
  canEnqueue: boolean;

  /** Admin fee paid on top of the wager when the round started. Never returned. */
  fee: number;
  /** The table was drawn at random in the lobby. */
  randomTable: boolean;
  pickSeconds: number;
  openSeconds: number;
  /** Epoch ms when each clock runs out; null while that clock isn't running. */
  pickDeadline: number | null;
  openDeadline: number | null;
  /** The pick clock chose cards for the player. */
  autoPicked: boolean;
  /** The open clock ended the round (cash out / return) instead of the player. */
  timedOut: boolean;

  /** Recursion */
  depth: number;
  offer: Card[] | null;
  overflowDepth: number | null;

  trace: TraceLine[];
}

export type Action =
  | { type: "pick"; slot: number }
  | { type: "deal" }
  | { type: "take" }
  | { type: "peek" }
  | { type: "enqueue"; slot: number }
  | { type: "cashout" }
  | { type: "choose"; index: number }
  | { type: "dive" }
  | { type: "return" }
  | { type: "unwind" }
  /** Sent by the UI when a clock hits zero. Ignored if no deadline has passed. */
  | { type: "timeout" };

export const PEEK_RATE = 0.25;
export const peekCost = (wager: number) => Math.max(1, Math.ceil(wager * PEEK_RATE));
export const enqueueFee = (wager: number) => Math.max(1, Math.ceil(wager * 0.05));
export const overflowRisk = (depth: number) => (depth <= 1 ? 0 : Math.min(1, (depth - 1) * 0.08));

const clock = (seconds: number, now: number) => (seconds > 0 ? now + seconds * 1000 : null);

export function createRound(opts: {
  mode: Mode;
  wager: number;
  seed: number;
  preset: DeckPreset | null;
  fee?: number;
  timers?: Timers;
  randomTable?: boolean;
  now?: number;
}): Round {
  const { mode, wager, seed, preset, fee = 0, timers = { pick: 0, open: 0 }, randomTable = false, now = 0 } = opts;
  const maxPicks = preset?.maxPicks ?? DEFAULT_MAX_PICKS;
  const base: Round = {
    mode,
    seed,
    wager,
    pot: wager,
    phase: "build",
    outcome: null,
    preset,
    minPicks: Math.min(3, maxPicks),
    maxPicks,
    board: [],
    taken: [],
    structure: [],
    picks: [],
    resolved: [],
    revealed: [],
    fees: 0,
    peekUsed: false,
    canEnqueue: false,
    fee,
    randomTable,
    pickSeconds: timers.pick,
    openSeconds: timers.open,
    pickDeadline: clock(timers.pick, now),
    openDeadline: null,
    autoPicked: false,
    timedOut: false,
    depth: 1,
    offer: null,
    overflowDepth: null,
    trace: [],
  };
  if (mode === "recursion") {
    return log({ ...base, offer: dealOffer(seed, 1, preset) }, { kind: "call", call: `dive(1)`, result: "choose a card" });
  }
  const verb = mode === "stack" ? "new Stack()" : "new Queue()";
  return log({ ...base, board: dealBoard(seed, preset) }, { kind: "info", call: verb, result: `pot ${fmt(wager)}` });
}

function log(r: Round, line: Omit<TraceLine, "id">): Round {
  const id = r.trace.length ? r.trace[r.trace.length - 1].id + 1 : 1;
  return { ...r, trace: [...r.trace, { id, ...line }] };
}

/** The card the next take() would apply (stack top / queue front). */
export function nextOut(r: Round): Card | null {
  if (r.structure.length === 0 || r.mode === "recursion") return null;
  return r.mode === "stack" ? r.structure[r.structure.length - 1] : r.structure[0];
}

export const boardAvailable = (r: Round) => r.board.filter((c) => !r.taken.includes(c.id));

/** What return would pay right now, unwinding deepest-first. */
export function projectedReturn(r: Round) {
  return simulate(
    r.wager,
    r.structure
      .slice()
      .reverse()
      .map((c) => c.op),
  );
}

export interface Legal {
  pick: boolean;
  deal: boolean;
  take: boolean;
  peek: boolean;
  enqueue: boolean;
  cashout: boolean;
  choose: boolean;
  dive: boolean;
  return: boolean;
  unwind: boolean;
}

export function legal(r: Round): Legal {
  const linear = r.mode !== "recursion";
  const out = nextOut(r);
  const avail = linear ? boardAvailable(r).length : 0;
  return {
    pick: linear && r.phase === "build" && r.structure.length < r.maxPicks && avail > 0,
    deal: linear && r.phase === "build" && r.structure.length >= r.minPicks,
    take: linear && r.phase === "resolve" && r.structure.length > 0,
    peek:
      linear && r.phase === "resolve" && !r.peekUsed && !!out && !r.revealed.includes(out.id) && r.pot > peekCost(r.wager),
    enqueue:
      r.mode === "queue" &&
      r.phase === "resolve" &&
      r.canEnqueue &&
      avail > 0 &&
      r.structure.length < MAX_QUEUE &&
      r.pot > enqueueFee(r.wager),
    cashout: linear && r.phase === "resolve" && r.resolved.length > 0,
    choose: !linear && r.phase === "build" && !!r.offer,
    dive: !linear && r.phase === "build" && !r.offer && r.depth < MAX_DEPTH,
    return: !linear && r.phase === "build" && !r.offer && r.structure.length > 0,
    unwind: !linear && r.phase === "resolve" && r.structure.length > 0,
  };
}

export function reduce(r: Round, a: Action, now: number = Date.now()): Round {
  const can = legal(r);
  switch (a.type) {
    case "pick": {
      if (!can.pick) return r;
      const card = boardAvailable(r).find((c) => c.slot === a.slot);
      if (!card) return r;
      let next: Round = {
        ...r,
        taken: [...r.taken, card.id],
        structure: [...r.structure, card],
        picks: [...r.picks, card],
      };
      next = log(next, { kind: "push", call: `${r.mode === "stack" ? "push" : "enqueue"}(#${card.slot})` });
      if (next.structure.length >= next.maxPicks) next = startResolve(next, now);
      return next;
    }
    case "deal":
      return can.deal ? startResolve(r, now) : r;

    case "take": {
      if (!can.take) return r;
      const card = nextOut(r)!;
      const structure = r.mode === "stack" ? r.structure.slice(0, -1) : r.structure.slice(1);
      const before = r.pot;
      const after = applyOp(before, card.op);
      let next: Round = {
        ...r,
        structure,
        pot: Math.max(0, after),
        resolved: [...r.resolved, { card, before, after }],
        revealed: r.revealed.includes(card.id) ? r.revealed : [...r.revealed, card.id],
        canEnqueue: r.mode === "queue",
      };
      next = log(next, {
        kind: "take",
        call: `${r.mode === "stack" ? "pop" : "dequeue"}()`,
        result: formatOp(card.op),
        before,
        after,
      });
      if (after <= 0) return finish(next, "bust");
      if (structure.length === 0) return finish(next, "cashed");
      return next;
    }

    case "peek": {
      if (!can.peek) return r;
      const card = nextOut(r)!;
      const cost = peekCost(r.wager);
      return log(
        { ...r, pot: r.pot - cost, fees: r.fees + cost, peekUsed: true, revealed: [...r.revealed, card.id] },
        { kind: "peek", call: `peek()`, result: `${formatOp(card.op)} · fee ${cost}`, before: r.pot, after: r.pot - cost },
      );
    }

    case "enqueue": {
      if (!can.enqueue) return r;
      const card = boardAvailable(r).find((c) => c.slot === a.slot);
      if (!card) return r;
      const fee = enqueueFee(r.wager);
      return log(
        {
          ...r,
          pot: r.pot - fee,
          fees: r.fees + fee,
          taken: [...r.taken, card.id],
          structure: [...r.structure, card],
          picks: [...r.picks, card],
          canEnqueue: false,
        },
        { kind: "push", call: `enqueue(#${card.slot})`, result: `fee ${fee}`, before: r.pot, after: r.pot - fee },
      );
    }

    case "cashout":
      return can.cashout ? finish(r, "cashed") : r;

    // ── Recursion ────────────────────────────────────────────────
    case "choose": {
      if (!can.choose) return r;
      const card = r.offer![a.index];
      if (!card) return r;
      return log(
        {
          ...r,
          offer: null,
          structure: [...r.structure, card],
          picks: [...r.picks, card],
          revealed: [...r.revealed, card.id],
          pickDeadline: null,
          openDeadline: r.structure.length === 0 ? clock(r.openSeconds, now) : r.openDeadline,
        },
        { kind: "call", call: `dive(${r.depth})`, result: `frame holds ${formatOp(card.op)}` },
      );
    }

    case "dive": {
      if (!can.dive) return r;
      const depth = r.depth + 1;
      const roll = rngFor(r.seed, STREAM_OVERFLOW + depth)();
      if (roll < overflowRisk(depth)) {
        const next = log(
          { ...r, depth, overflowDepth: depth, pot: 0 },
          { kind: "bust", call: `dive(${depth})`, result: "StackOverflowError" },
        );
        return finish(next, "overflow");
      }
      return log(
        { ...r, depth, offer: dealOffer(r.seed, depth, r.preset), pickDeadline: clock(r.pickSeconds, now) },
        { kind: "call", call: `dive(${depth})`, result: "choose a card" },
      );
    }

    case "return":
      if (!can.return) return r;
      return log(
        { ...r, phase: "resolve", pot: r.wager, pickDeadline: null, openDeadline: null },
        { kind: "base", call: `base case`, result: `return ${fmt(r.wager)}` },
      );

    case "unwind": {
      if (!can.unwind) return r;
      const card = r.structure[r.structure.length - 1];
      const frameDepth = r.structure.length;
      const before = r.pot;
      const after = applyOp(before, card.op);
      let next: Round = {
        ...r,
        structure: r.structure.slice(0, -1),
        pot: Math.max(0, after),
        resolved: [...r.resolved, { card, before, after }],
      };
      next = log(next, {
        kind: "return",
        call: `dive(${frameDepth}) returns`,
        result: formatOp(card.op),
        before,
        after,
      });
      if (after <= 0) return finish(next, "bust");
      if (next.structure.length === 0) return finish(next, "cashed");
      return next;
    }

    case "timeout":
      return onTimeout(r, now);
  }
}

/**
 * A clock ran out.
 * Pick clock: stack/queue fill up to the minimum with random cards and deal;
 * recursion takes a random card from the offer.
 * Open clock: stack/queue cash out at the current pot; recursion returns.
 */
function onTimeout(r: Round, now: number): Round {
  if (r.phase === "done") return r;
  const linear = r.mode !== "recursion";
  const openUp = r.openDeadline !== null && now >= r.openDeadline;
  const pickUp = r.pickDeadline !== null && now >= r.pickDeadline;

  if (openUp && !linear && r.phase === "build" && r.structure.length > 0) {
    const next = log(
      { ...r, offer: null, phase: "resolve", pot: r.wager, pickDeadline: null, openDeadline: null, timedOut: true },
      { kind: "info", call: "time's up", result: "returning now" },
    );
    return log(next, { kind: "base", call: "base case", result: `return ${fmt(r.wager)}` });
  }
  if (openUp && linear && r.phase === "resolve") {
    const next = log({ ...r, timedOut: true }, { kind: "info", call: "time's up", result: `cash out ${fmt(r.pot)}` });
    return finish(next, "cashed");
  }
  if (pickUp && r.phase === "build") {
    if (!linear && r.offer) {
      const index = Math.floor(rngFor(r.seed, STREAM_AUTO + r.depth)() * r.offer.length);
      const next = log({ ...r, autoPicked: true }, { kind: "info", call: "time's up", result: `picked card ${index + 1} for you` });
      return reduce(next, { type: "choose", index }, now);
    }
    if (linear) {
      const rand = rngFor(r.seed, STREAM_AUTO);
      let next: Round = { ...r, autoPicked: true };
      const auto: number[] = [];
      while (next.structure.length < next.minPicks) {
        const avail = boardAvailable(next);
        if (avail.length === 0) break;
        const card = avail[Math.floor(rand() * avail.length)];
        auto.push(card.slot);
        next = { ...next, taken: [...next.taken, card.id], structure: [...next.structure, card], picks: [...next.picks, card] };
        next = log(next, { kind: "push", call: `${r.mode === "stack" ? "push" : "enqueue"}(#${card.slot})`, result: "auto" });
      }
      if (next.structure.length === 0) return r;
      next = log(next, {
        kind: "info",
        call: "time's up",
        result: auto.length ? `picked #${auto.join(", #")} for you` : "dealing your cards",
      });
      return startResolve(next, now);
    }
  }
  return r;
}

function startResolve(r: Round, now: number): Round {
  const head = r.mode === "stack" ? "top" : "front";
  return log(
    { ...r, phase: "resolve", pickDeadline: null, openDeadline: clock(r.openSeconds, now) },
    { kind: "info", call: `deal`, result: `${r.structure.length} cards · ${head} first` },
  );
}

function finish(r: Round, outcome: Outcome): Round {
  const pot = outcome === "cashed" ? r.pot : 0;
  const line: Omit<TraceLine, "id"> =
    outcome === "cashed"
      ? { kind: "cash", call: "cash out", result: fmt(pot) }
      : outcome === "bust"
        ? { kind: "bust", call: "bust", result: "pot hit 0" }
        : { kind: "bust", call: "crash", result: `overflow at depth ${r.overflowDepth}` };
  return log({ ...r, phase: "done", outcome, pot, pickDeadline: null, openDeadline: null }, line);
}

/** Chips returned to the player's balance when the round ends. */
export const payout = (r: Round) => (r.phase === "done" && r.outcome === "cashed" ? r.pot : 0);
