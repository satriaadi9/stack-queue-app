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

/** Kept deliberately small: every card sits between ×0 and ×3. */
export const TIERS: TierDef[] = [
  {
    tier: "common",
    label: "Common",
    weight: 55,
    back: "plain",
    ops: [o("mul", 1.1), o("mul", 1.2), o("mul", 0.9), o("mul", 0.8), o("add", 2), o("sub", 2)],
  },
  { tier: "rare", label: "Rare", weight: 25, back: "teal", ops: [o("mul", 1.4), o("mul", 1.5), o("mul", 0.7), o("div", 1.5)] },
  { tier: "epic", label: "Epic", weight: 13, back: "oxblood", ops: [o("mul", 2), o("mul", 2.5), o("div", 2), o("div", 2.5)] },
  { tier: "legendary", label: "Legendary", weight: 5, back: "gold", ops: [o("mul", 3)] },
  { tier: "cursed", label: "Cursed", weight: 2, back: "gold", ops: [o("mul", 0), o("div", 3)] },
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
  if (kind === "add" || kind === "sub") {
    if (n >= 50) return "epic";
    if (n >= 20) return "rare";
    return "common";
  }
  if (kind === "mul" && n === 0) return "cursed";
  // How hard the card swings the pot, in either direction: ×0.5 and ÷2 are both 2.
  const grows = kind === "mul" && n >= 1;
  const swing = kind === "mul" ? (n >= 1 ? n : 1 / n) : n;
  if (swing >= 3 - 1e-9) return grows ? "legendary" : "cursed";
  if (swing >= 2 - 1e-9) return "epic";
  if (swing >= 1.3) return "rare";
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
