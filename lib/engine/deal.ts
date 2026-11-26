import { BOARD_SIZE, type DeckPreset } from "./deck-code";
import type { Op } from "./ops";
import { BASE_WEIGHTS, drawOp, tierOf, type Tier, type Weights } from "./pool";
import { rngFor, shuffle } from "./rng";

export interface Card {
  id: string;
  /** Number printed on the card back — what the player picks by. */
  slot: number;
  op: Op;
  tier: Tier;
}

const makeCard = (id: string, slot: number, op: Op): Card => ({ id, slot, op, tier: tierOf(op) });

// Stream ids — keep distinct so streams never overlap.
export const STREAM_BOARD = 1;
export const STREAM_OFFER = 100; // + depth
export const STREAM_OVERFLOW = 200; // + depth
export const STREAM_AUTO = 300; // + depth: cards picked by the clock

/** The 12 face-down cards for stack & queue rounds. */
export function dealBoard(seed: number, preset: DeckPreset | null, weights: Weights = BASE_WEIGHTS): Card[] {
  const rand = rngFor(seed, STREAM_BOARD);
  let ops: Op[] = Array.from({ length: BOARD_SIZE }, (_, i) => preset?.slots[i] ?? drawOp(rand, weights));
  if (preset?.shuffle) ops = shuffle(ops, rand);
  return ops.map((op, i) => makeCard(`b${i + 1}`, i + 1, op));
}

/** The three doors offered at a given recursion depth (1-based). */
export function dealOffer(
  seed: number,
  depth: number,
  preset: DeckPreset | null,
  weights: Weights = BASE_WEIGHTS,
): Card[] {
  const rand = rngFor(seed, STREAM_OFFER + depth);
  let ops: Op[] = [0, 1, 2].map((i) => {
    // Host decks feed recursion three slots per level, wrapping after 4 levels.
    const slot = preset ? preset.slots[((depth - 1) * 3 + i) % BOARD_SIZE] : null;
    return slot ?? drawOp(rand, weights);
  });
  if (preset?.shuffle) ops = shuffle(ops, rand);
  return ops.map((op, i) => makeCard(`d${depth}-${i + 1}`, i + 1, op));
}
