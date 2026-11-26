"use client";

import Link from "next/link";
import { useState } from "react";
import { useHydrated } from "@/components/Providers";
import { Rail } from "@/components/table/Rail";
import { fmt } from "@/lib/engine/ops";
import { useGame } from "@/lib/store";

export default function Regulars() {
  const hydrated = useHydrated();
  const profiles = useGame((s) => s.profiles);
  const active = useGame((s) => s.active);
  const forget = useGame((s) => s.forget);
  const [confirm, setConfirm] = useState<string | null>(null);

  const rows = Object.values(profiles).sort((a, b) => b.balance - a.balance || b.best - a.best);

  return (
    <>
      <Rail />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:pt-12">
        <p className="felt-print">This device</p>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Regulars</h1>
        <p className="mt-2 text-card/60">Ranked by chips on hand. Loans are on the record.</p>

        {hydrated && rows.length === 0 && (
          <p className="mt-10 text-card/60">
            Nobody&apos;s played here yet.{" "}
            <Link href="/" className="text-brass-hi underline underline-offset-4">
              Take the first seat
            </Link>
            .
          </p>
        )}

        {hydrated && rows.length > 0 && (
          <div className="mt-8 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="felt-print">
                  <th className="pb-3 pr-3 font-semibold">#</th>
                  <th className="pb-3 pr-3 font-semibold">Player</th>
                  <th className="pb-3 pr-3 text-right font-semibold">Chips</th>
                  <th className="pb-3 pr-3 text-right font-semibold">Peak</th>
                  <th className="pb-3 pr-3 text-right font-semibold">Best win</th>
                  <th className="pb-3 pr-3 text-right font-semibold">Rounds</th>
                  <th className="pb-3 text-right font-semibold">Loans</th>
                  <th className="pb-3" />
                </tr>
              </thead>
              <tbody className="font-mono text-sm tnum">
                {rows.map((p, i) => (
                  <tr key={p.initials} className={`border-t border-felt-print/10 ${p.initials === active ? "bg-brass/10" : ""}`}>
                    <td className={`py-3 pr-3 font-display text-lg font-bold ${i === 0 ? "text-brass-hi" : "text-card/50"}`}>{i + 1}</td>
                    <td className="py-3 pr-3">
                      <span className="rounded bg-card px-1.5 py-0.5 font-bold tracking-[0.12em] text-ink">{p.initials}</span>
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold text-brass-hi">{fmt(p.balance)}</td>
                    <td className="py-3 pr-3 text-right text-card/70">{fmt(p.best)}</td>
                    <td className="py-3 pr-3 text-right text-card/70">{p.biggestWin > 0 ? `+${fmt(p.biggestWin)}` : "—"}</td>
                    <td className="py-3 pr-3 text-right text-card/70">
                      {p.rounds}
                      <span className="text-card/35"> ({p.wins}W)</span>
                    </td>
                    <td className={`py-3 text-right ${p.loans ? "text-loss-hi" : "text-card/35"}`}>{p.loans || "—"}</td>
                    <td className="py-3 pl-3 text-right">
                      {confirm === p.initials ? (
                        <button
                          type="button"
                          onClick={() => (forget(p.initials), setConfirm(null))}
                          className="font-sans text-xs font-semibold text-loss-hi"
                        >
                          Confirm remove
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirm(p.initials)}
                          className="font-sans text-xs text-card/35 hover:text-card/80"
                          aria-label={`Remove ${p.initials}`}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-12 flex gap-6 text-sm text-card/50">
          <Link href={active ? "/lobby" : "/"} className="hover:text-card">
            ← Back to the tables
          </Link>
        </div>
      </main>
    </>
  );
}
