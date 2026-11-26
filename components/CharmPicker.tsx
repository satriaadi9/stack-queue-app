"use client";

import { motion } from "motion/react";
import { CHARMS, charmCost, oddsFor, type CharmId } from "@/lib/engine/charms";
import { fmt } from "@/lib/engine/ops";
import { TIERS, type Tier } from "@/lib/engine/pool";

/** Bar colours, a touch lighter than the card backs so they read on the felt. */
export const TIER_BAR: Record<Tier, string> = {
  common: "#e6dcc4",
  rare: "#45a9a1",
  epic: "#b8434d",
  legendary: "#e8cd85",
  cursed: "#e2564d",
};

/** The odds as one stacked bar: wider segment, likelier tier. */
export function OddsBar({ charm, className = "" }: { charm: CharmId; className?: string }) {
  const odds = oddsFor(charm);
  return (
    <span className={`flex h-2 w-full overflow-hidden rounded-full bg-black/30 ${className}`} aria-hidden>
      {TIERS.map((t) => (
        <motion.span
          key={t.tier}
          initial={false}
          animate={{ width: `${odds[t.tier]}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 34 }}
          style={{ background: TIER_BAR[t.tier] }}
          className="h-full"
        />
      ))}
    </span>
  );
}

/** One charm per round, or none. Prices scale with the wager. */
export function CharmPicker({
  value,
  onChange,
  wager,
  budget,
  disabled,
}: {
  value: CharmId;
  onChange: (c: CharmId) => void;
  wager: number;
  /** Chips left after the wager and fee. */
  budget: number;
  disabled: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Luck charm" className="grid gap-3 sm:grid-cols-2">
      {CHARMS.map((c) => {
        const cost = charmCost(wager, c.id);
        const short = cost > budget;
        const on = value === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled || short}
            onClick={() => onChange(c.id)}
            className={`relative flex flex-col rounded-2xl p-4 text-left transition-[opacity,background-color] disabled:opacity-35 ${
              on ? "bg-black/25" : "bg-black/10 hover:bg-black/20"
            }`}
          >
            {on && (
              <motion.span
                layoutId="charm-ring"
                className="absolute inset-0 rounded-2xl border-2 border-brass"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
                aria-hidden
              />
            )}
            <span className="flex items-baseline justify-between gap-3">
              <span className="font-display text-lg font-bold">{c.name}</span>
              <span className={`shrink-0 text-sm font-semibold tnum ${c.rate ? "text-brass-hi" : "text-card/50"}`}>
                {c.rate === 0 ? (
                  "Free"
                ) : short && !disabled ? (
                  "Can't afford"
                ) : (
                  <>
                    {fmt(cost)} chips<span className="ml-1.5 font-normal text-card/45">{Math.round(c.rate * 100)}%</span>
                  </>
                )}
              </span>
            </span>
            <span className="mt-1 text-sm text-card/70">{c.effect}</span>
            <OddsBar charm={c.id} className="mt-3" />
          </button>
        );
      })}
    </div>
  );
}
