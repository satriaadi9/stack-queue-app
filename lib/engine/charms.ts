import type { DeckPreset } from "./deck-code";
import { BASE_WEIGHTS, type Tier, type Weights } from "./pool";

/**
 * Luck charms: an optional extra, bought per round, that reshapes the gacha
 * odds for the cards drawn at random. Host-set slots are never touched.
 *
 * Priced like the admin fee, from simulating 100k rounds per charm (stack,
 * 3 and 5 cards, opened to the end). Each charm costs about what it adds to a
 * typical (median) round, so it buys a fatter tail, not a free edge:
 *
 *   charm      median ×wager (3 / 5 cards)   ≥2× rounds   busts
 *   none       1.06 / 1.10                   22% / 29%    3% / 5%
 *   steady     1.00 / 1.01                   14% / 20%    1.5% / 2.5%   2%: insurance
 *   ward       1.10 / 1.21                   23% / 31%    0%            8%
 *   rare       1.06 / 1.11                   24% / 30%    3% / 5%       5%
 *   epic       1.08 / 1.11                   26% / 32%    3% / 5%       10%: mostly tail
 *   legendary  1.44 / 1.92                   39% / 49%    3% / 5%       40%
 */
export type CharmId = "none" | "steady" | "rare" | "epic" | "legendary" | "ward";

export interface Charm {
  id: CharmId;
  name: string;
  /** One line: what it changes. */
  effect: string;
  /**
   * Percentage points moved between tiers. Common cards absorb the difference,
   * so a charm never makes the other good tiers rarer.
   */
  shift: Partial<Record<Exclude<Tier, "common">, number>>;
  /** Price as a fraction of the wager. */
  rate: number;
}

export const CHARMS: Charm[] = [
  { id: "none", name: "No charm", effect: "Standard house odds.", shift: {}, rate: 0 },
  {
    id: "steady",
    name: "Steady hand",
    effect: "Half the epic, gold and cursed cards. Smaller swings, fewer busts.",
    shift: { epic: -6.5, legendary: -2.5, cursed: -1 },
    rate: 0.02,
  },
  { id: "ward", name: "Ward", effect: "No cursed cards, so every gold back is ×3.", shift: { cursed: -2 }, rate: 0.08 },
  { id: "rare", name: "Teal charm", effect: "Rare cards come up almost twice as often.", shift: { rare: 20 }, rate: 0.05 },
  { id: "epic", name: "Oxblood charm", effect: "Epic cards come up about twice as often. Big swings both ways.", shift: { epic: 12 }, rate: 0.1 },
  { id: "legendary", name: "Gold charm", effect: "Three times the legendary ×3 cards.", shift: { legendary: 10 }, rate: 0.4 },
];

const BY_ID = Object.fromEntries(CHARMS.map((c) => [c.id, c])) as Record<CharmId, Charm>;
export const charmOf = (id: CharmId | undefined | null): Charm => BY_ID[id ?? "none"] ?? BY_ID.none;
export const isCharmId = (v: unknown): v is CharmId => typeof v === "string" && v in BY_ID;

export function weightsFor(id: CharmId | undefined | null): Weights {
  const shift = charmOf(id).shift as Partial<Record<Tier, number>>;
  const w = { ...BASE_WEIGHTS };
  for (const [t, d] of Object.entries(shift)) {
    w[t as Tier] = Math.max(0, w[t as Tier] + d);
    w.common -= d;
  }
  return w;
}

/** Odds in percent, as shown to the player (one decimal). */
export function oddsFor(id: CharmId | undefined | null): Weights {
  const w = weightsFor(id);
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(w).map(([t, v]) => [t, Math.round((v / total) * 1000) / 10])) as Weights;
}

export const charmCost = (wager: number, id: CharmId | undefined | null) => {
  const rate = charmOf(id).rate;
  return rate <= 0 || wager <= 0 ? 0 : Math.max(1, Math.ceil(wager * rate));
};

/** Charms only reshape random cards; a house deck with every slot set has none. */
export const charmsApply = (preset: DeckPreset | null) => !preset || preset.slots.some((s) => s === null);
