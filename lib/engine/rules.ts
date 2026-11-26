/**
 * Table rules: the admin fee and the two clocks.
 *
 * Why 10%: simulating 200k rounds of the default pool, a typical (median) round
 * returns 100–109% of the wager. Only rare ×3 / ×2.5 draws push the average far
 * above that. A 10% fee makes the typical round slightly negative, like a real
 * house edge, while lucky gold cards still pay out big.
 */
export const DEFAULT_FEE_RATE = 0.1;
export const MAX_FEE_RATE = 0.5;

export const tableFee = (wager: number, rate: number) => (rate <= 0 ? 0 : Math.max(1, Math.ceil(wager * rate)));

/** Largest wager whose wager + fee still fits in the balance. */
export function maxAffordable(balance: number, rate: number): number {
  let w = Math.floor(balance / (1 + Math.max(0, rate)));
  while (w > 0 && w + tableFee(w, rate) > balance) w--;
  while (w + 1 + tableFee(w + 1, rate) <= balance) w++;
  return Math.max(0, w);
}

export interface Timers {
  /** Seconds to pick cards. 0 = no limit. */
  pick: number;
  /** Seconds to open cards. 0 = no limit. */
  open: number;
}

export type TimerPreset = "relaxed" | "standard" | "blitz" | "off" | "custom";

export const TIMER_PRESETS: Record<Exclude<TimerPreset, "custom">, Timers & { label: string }> = {
  relaxed: { label: "Relaxed", pick: 30, open: 60 },
  standard: { label: "Standard", pick: 20, open: 30 },
  blitz: { label: "Blitz", pick: 10, open: 15 },
  off: { label: "No clock", pick: 0, open: 0 },
};

export const DEFAULT_TIMER_PRESET: TimerPreset = "standard";
export const TIMER_LIMITS = { pick: { min: 3, max: 300 }, open: { min: 3, max: 600 } } as const;

export const clampTimer = (kind: keyof Timers, s: number) =>
  s <= 0 ? 0 : Math.round(Math.min(TIMER_LIMITS[kind].max, Math.max(TIMER_LIMITS[kind].min, s)));

/** Chips a brand-new player sits down with. A host deck can set its own. */
export const START_BALANCE = 1000;
/** Quick picks for the starting chips. */
export const START_PRESETS = [500, 1000, 2500, 5000, 10000] as const;
export const START_LIMITS = { min: 10, max: 1_000_000 } as const;
export const clampStart = (n: number) =>
  Math.min(START_LIMITS.max, Math.max(START_LIMITS.min, Math.round(Number.isFinite(n) ? n : START_BALANCE)));
