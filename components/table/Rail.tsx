"use client";

import Link from "next/link";
import { RollingNumber } from "./PotCounter";
import { useGame, useMe } from "@/lib/store";

/** The leather rail across the top of every screen. */
export function Rail({ children }: { children?: React.ReactNode }) {
  const me = useMe();
  const muted = useGame((s) => s.muted);
  const toggleMute = useGame((s) => s.toggleMute);
  const deckName = useGame((s) => s.deckName);

  return (
    <header className="rail sticky top-0 z-30">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:gap-5">
        <Link href={me ? "/lobby" : "/"} className="font-display text-lg font-bold tracking-tight text-card sm:text-xl">
          Stack <span className="text-brass">&amp;</span> Deal
        </Link>
        {deckName && (
          <span className="hidden rounded-full border border-brass/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-brass-hi sm:inline">
            House deck · {deckName}
          </span>
        )}
        <div className="ml-auto flex items-center gap-3 sm:gap-5">
          {children}
          {me && (
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 min-w-11 place-items-center rounded-md bg-card px-1.5 font-mono text-sm font-bold tracking-[0.15em] text-ink">
                {me.initials}
              </span>
              <div className="flex flex-col leading-none">
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-card/50">Chips</span>
                <RollingNumber value={me.balance} className="font-mono text-sm font-semibold text-brass-hi" />
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute sound" : "Mute sound"}
            aria-pressed={muted}
            className="grid size-9 place-items-center rounded-md text-card/70 hover:text-card"
          >
            <SoundIcon muted={muted} />
          </button>
        </div>
      </div>
    </header>
  );
}

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 9h3l5-4v14l-5-4H4z" strokeLinejoin="round" />
      {muted ? (
        <path d="M16 9l5 6M21 9l-5 6" strokeLinecap="round" />
      ) : (
        <path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" strokeLinecap="round" />
      )}
    </svg>
  );
}
