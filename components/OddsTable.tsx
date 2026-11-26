import { formatOp } from "@/lib/engine/ops";
import { TIERS } from "@/lib/engine/pool";

/** The house's odds, printed openly. Gold backs hide both jackpots and curses. */
export function OddsTable() {
  return (
    <details className="group w-full rounded-xl bg-black/15 px-4 py-3 open:pb-4">
      <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-card/80 [&::-webkit-details-marker]:hidden">
        <span>House odds: what&apos;s under each card back</span>
        <svg width="12" height="8" viewBox="0 0 12 8" className="transition-transform group-open:rotate-180" aria-hidden>
          <path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </summary>
      <table className="mt-3 w-full text-left text-sm">
        <thead>
          <tr className="felt-print">
            <th className="pb-2 font-semibold">Back</th>
            <th className="pb-2 font-semibold">Tier</th>
            <th className="pb-2 text-right font-semibold">Odds</th>
            <th className="pb-2 pl-4 font-semibold">Cards</th>
          </tr>
        </thead>
        <tbody>
          {TIERS.map((t) => (
            <tr key={t.tier} className="border-t border-felt-print/10">
              <td className="py-2">
                <span className={`back-${t.back} card-body block h-7 w-5 rounded-[4px]`} aria-label={`${t.back} back`} />
              </td>
              <td className={`py-2 font-semibold ${t.tier === "cursed" ? "text-loss-hi" : ""}`}>{t.label}</td>
              <td className="py-2 text-right font-mono tnum text-card/80">{t.weight}%</td>
              <td className="py-2 pl-4 font-mono text-card/80">{t.ops.map(formatOp).join("  ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-card/55">
        Legendary and cursed cards share the same gold back. A gold card is a 5-in-7 shot at a jackpot.
      </p>
    </details>
  );
}
