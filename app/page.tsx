"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InitialsPicker } from "@/components/InitialsPicker";
import { useHydrated } from "@/components/Providers";
import { StartingChips } from "@/components/StartingChips";
import { Rail } from "@/components/table/Rail";
import { fmt } from "@/lib/engine/ops";
import { sfx } from "@/lib/sfx";
import { isLive, useGame } from "@/lib/store";

export default function Home() {
  const hydrated = useHydrated();
  const router = useRouter();
  const login = useGame((s) => s.login);
  const profiles = useGame((s) => s.profiles);
  const deckName = useGame((s) => s.deckName);
  const resetAll = useGame((s) => s.resetAll);
  const [confirmReset, setConfirmReset] = useState(false);

  const seat = (initials: string) => {
    login(initials);
    router.push("/lobby");
  };

  const regulars = Object.values(profiles).sort((a, b) => b.lastPlayed - a.lastPlayed);
  const midRound = regulars.filter((p) => isLive(p.round)).length;

  return (
    <>
      <Rail />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 pb-20 pt-10 sm:pt-16">
        <ArcTitle />
        <h1 className="-mt-6 font-display text-5xl font-bold tracking-tight sm:text-7xl">
          Stack <span className="text-brass">&amp;</span> Deal
        </h1>
        <p className="mt-4 max-w-md text-center text-base text-card/70 sm:text-lg">
          Pick face-down cards. A stack, a queue or a recursive call decides the order they hit your pot. Order is
          everything.
        </p>

        {deckName && (
          <p className="mt-6 rounded-full border border-brass/60 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-brass-hi">
            House deck loaded · {deckName}
          </p>
        )}

        <div className="felt-zone mt-10 w-full max-w-md px-6 py-9">
          {hydrated ? <InitialsPicker onSubmit={seat} /> : <div className="h-[340px]" />}
        </div>

        {hydrated && <StartingChips />}

        {hydrated && regulars.length > 0 && (
          <section className="mt-12 w-full max-w-md" aria-labelledby="regulars-h">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
              <h2 id="regulars-h" className="felt-print">
                Regulars on this device
              </h2>
              <div className="flex gap-4">
                <Link href="/regulars" className="text-xs text-card/55 underline-offset-4 hover:text-card hover:underline">
                  Leaderboard
                </Link>
                <button
                  type="button"
                  onClick={() => setConfirmReset(true)}
                  aria-expanded={confirmReset}
                  className="text-xs text-card/55 underline-offset-4 hover:text-loss-hi hover:underline"
                >
                  Reset all players
                </button>
              </div>
            </div>

            {confirmReset && (
              <div role="alertdialog" aria-labelledby="reset-h" className="mb-4 rounded-2xl border border-loss/60 bg-loss/10 p-4">
                <p id="reset-h" className="text-sm font-semibold text-card">
                  Delete all {regulars.length} {regulars.length === 1 ? "player" : "players"} on this device?
                </p>
                <p className="mt-1 text-sm text-card/65">
                  Their chips, records and loans go too
                  {midRound > 0 && <>, along with {midRound === 1 ? "an unfinished round" : `${midRound} unfinished rounds`}</>}.
                  This can&apos;t be undone. Your clock, sound and starting-chips settings stay.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      resetAll();
                      setConfirmReset(false);
                      sfx.bust();
                    }}
                    className="rounded-lg bg-loss px-3.5 py-2 text-sm font-semibold text-card hover:bg-loss-hi"
                  >
                    Delete everyone
                  </button>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setConfirmReset(false)}
                    className="rounded-lg bg-black/25 px-3.5 py-2 text-sm font-semibold text-card/80 hover:bg-black/35"
                  >
                    Keep them
                  </button>
                </div>
              </div>
            )}
            <ul className="flex flex-wrap gap-2">
              {regulars.slice(0, 8).map((p) => (
                <li key={p.initials}>
                  <button
                    type="button"
                    onClick={() => seat(p.initials)}
                    className="group flex items-center gap-2.5 rounded-lg bg-black/20 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-black/35"
                  >
                    <span className="rounded bg-card px-1.5 py-0.5 font-mono text-sm font-bold tracking-[0.12em] text-ink">
                      {p.initials}
                    </span>
                    <span className="font-sans text-sm text-brass-hi tnum">{fmt(p.balance)}</span>
                    {isLive(p.round) && (
                      <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-card/50">mid-round</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-16 flex gap-6 text-xs text-card/40">
          <Link href="/host" className="hover:text-card/80">
            Host a table
          </Link>
          <span>Virtual chips only · no real money</span>
        </footer>
      </main>
    </>
  );
}

/** Curved text printed on the felt, like the rules arc on a blackjack layout. */
function ArcTitle() {
  return (
    <svg viewBox="0 0 400 110" className="w-[320px] sm:w-[440px]" aria-hidden>
      <defs>
        <path id="arc" d="M 30 100 Q 200 0 370 100" />
      </defs>
      <path d="M 22 108 Q 200 4 378 108" fill="none" stroke="currentColor" className="text-felt-print/25" strokeWidth="1" />
      <text className="fill-felt-print" style={{ fontSize: 11, letterSpacing: "0.32em", fontWeight: 600 }}>
        <textPath href="#arc" startOffset="50%" textAnchor="middle">
          LAST IN · FIRST OUT · ORDER PAYS
        </textPath>
      </text>
    </svg>
  );
}
