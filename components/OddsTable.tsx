import { TIER_BAR } from "@/components/CharmPicker";
import { charmOf, oddsFor, type CharmId } from "@/lib/engine/charms";
import { formatOp } from "@/lib/engine/ops";
import { BASE_WEIGHTS, TIERS } from "@/lib/engine/pool";

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

/** The house's odds, printed openly, with any charm applied. Gold backs hide both jackpots and curses. */
export function OddsTable({ charm = "none" }: { charm?: CharmId }) {
  const odds = oddsFor(charm);
  const gold = odds.legendary + odds.cursed;
  const charmed = charm !== "none";
  return (
    <details className="group w-full rounded-xl bg-black/15 px-4 py-3 open:pb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-card/80 [&::-webkit-details-marker]:hidden">
        <span>
          {charmed ? `Odds with the ${charmOf(charm).name.toLowerCase()}` : "House odds"}: what&apos;s under each card back
        </span>
        <svg width="12" height="8" viewBox="0 0 12 8" className="shrink-0 transition-transform group-open:rotate-180" aria-hidden>
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="felt-print">
            <th className="pb-2 pr-3 font-semibold">Back</th>
            <th className="pb-2 font-semibold">Tier</th>
            <th className="pb-2 text-right font-semibold">Odds</th>
            <th className="pb-2 pl-4 font-semibold">Cards</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => {
            const now = odds[t.tier];
            const was = BASE_WEIGHTS[t.tier];
            const delta = Math.round((now - was) * 10) / 10;
            return (
              <tr key={t.tier} className="border-t border-felt-print/10">
                <td className="py-2 pr-3">
                  <span className={`back-${t.back} card-body block h-7 w-5 rounded-[4px]`} aria-label={`${t.back} back`} />
                </td>
                <td className="py-2 font-semibold">
                  <span className="mr-2 hidden size-2 rounded-full sm:inline-block" style={{ background: TIER_BAR[t.tier] }} aria-hidden />
                  <span className={t.tier === "cursed" ? "text-loss-hi" : ""}>{t.label}</span>
                </td>
                <td className="whitespace-nowrap py-2 text-right font-sans tnum text-card/80">
                  {pct(now)}
                  {charmed && delta !== 0 && (
                    <span className={`ml-1.5 text-xs ${delta > 0 ? "text-brass-hi" : "text-card/45"}`}>
                      {delta > 0 ? "+" : "−"}
                      {Math.abs(delta)}
                    </span>
                  )}
                </td>
                <td className="py-2 pl-4 font-sans text-card/80">{t.ops.map(formatOp).join("  ")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-card/55">
        Every card sits between ×0 and ×3, and the pot rounds down to whole chips. Legendary and cursed cards share the
        same gold back
        {odds.cursed === 0
          ? ", but with no curses in the pool every gold card is ×3."
          : `, so a gold card is a ${Math.round((odds.legendary / gold) * 100)}% shot at ×3.`}
      </p>
    </details>
  );
}
