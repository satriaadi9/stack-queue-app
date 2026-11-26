import type { Op } from "./ops";

export type Tier = "common" | "rare" | "epic" | "legendary" | "cursed";
/** What the face-down side shows. Legendary and cursed deliberately share gold. */
export type Back = "plain" | "teal" | "oxblood" | "gold";

export interface TierDef {
  tier: Tier;
  label: string;
  weight: number; // percent
  back: Back;
  ops: Op[];
}

const o = (kind: Op["kind"], n: number): Op => ({ kind, n });

export const TIERS: TierDef[] = [
  {
    tier: "common",
    label: "Common",
    weight: 55,
    back: "plain",
    ops: [o("add", 5), o("add", 10), o("sub", 5), o("sub", 10), o("mul", 1)],
  },
  { tier: "rare", label: "Rare", weight: 25, back: "teal", ops: [o("add", 20), o("sub", 21), o("mul", 2), o("div", 2)] },
  { tier: "epic", label: "Epic", weight: 13, back: "oxblood", ops: [o("mul", 3), o("mul", 5), o("sub", 50), o("div", 3)] },
  { tier: "legendary", label: "Legendary", weight: 5, back: "gold", ops: [o("mul", 10), o("mul", 20)] },
  { tier: "cursed", label: "Cursed", weight: 2, back: "gold", ops: [o("mul", 0), o("div", 10)] },
];

const BY_TIER = Object.fromEntries(TIERS.map((t) => [t.tier, t])) as Record<Tier, TierDef>;

export const tierDef = (t: Tier) => BY_TIER[t];
export const backOf = (t: Tier): Back => BY_TIER[t].back;

/**
 * Classify any op (including host-made custom ones) into a tier, so a custom
 * "+7" or "x50" gets a sensible card back. Pool ops classify to their own tier.
 */
export function tierOf(op: Op): Tier {
  const { kind, n } = op;
  if (kind === "mul") {
    if (n === 0) return "cursed";
    if (n >= 10) return "legendary";
    if (n >= 3) return "epic";
    if (n === 2) return "rare";
    return "common";
  }
  if (kind === "div") {
    if (n >= 10) return "cursed";
    if (n >= 3) return "epic";
    if (n === 2) return "rare";
    return "common";
  }
  if (n >= 50) return "epic";
  if (n >= 20) return "rare";
  return "common";
}

export function drawOp(rand: () => number): Op {
  let roll = rand() * 100;
  for (const t of TIERS) {
    if (roll < t.weight) return t.ops[Math.floor(rand() * t.ops.length)];
    roll -= t.weight;
  }
  const last = TIERS[TIERS.length - 1];
  return last.ops[Math.floor(rand() * last.ops.length)];
}
