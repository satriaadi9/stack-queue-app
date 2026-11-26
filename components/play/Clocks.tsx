"use client";

import { useEffect, useState } from "react";
import type { Round } from "@/lib/engine/round";
import { sfx } from "@/lib/sfx";

const URGENT_S = 5;

/** The round's running clocks. Renders nothing when no clock is running. */
export function Clocks({ round }: { round: Round }) {
  const rec = round.mode === "recursion";
  const pick = round.pickDeadline;
  const open = round.openDeadline;
  if (pick === null && open === null) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      {pick !== null && (
        <Clock
          label={rec ? "Choose a card" : "Pick cards"}
          after={rec ? "then one is picked for you" : "then random cards are picked"}
          deadline={pick}
          total={round.pickSeconds}
        />
      )}
      {open !== null && (
        <Clock
          label={rec ? "Return by" : "Open cards"}
          after={rec ? "then the stack returns" : "then you cash out"}
          deadline={open}
          total={round.openSeconds}
        />
      )}
    </div>
  );
}

function Clock({ label, after, deadline, total }: { label: string; after: string; deadline: number; total: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  const left = Math.max(0, deadline - now);
  const secs = Math.ceil(left / 1000);
  const frac = total > 0 ? Math.min(1, left / (total * 1000)) : 0;
  const urgent = secs <= URGENT_S;

  // A soft tick for each of the last few seconds.
  useEffect(() => {
    if (secs > 0 && secs <= 3) sfx.tick();
  }, [secs]);

  const R = 13;
  const C = 2 * Math.PI * R;
  return (
    <div role="timer" aria-live="off" aria-label={`${label}: ${secs} seconds left, ${after}`} className="flex items-center gap-2.5">
      <svg width="34" height="34" viewBox="0 0 34 34" aria-hidden className="-rotate-90">
        <circle cx="17" cy="17" r={R} fill="none" stroke="currentColor" strokeWidth="3" className="text-black/30" />
        <circle
          cx="17"
          cy="17"
          r={R}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - frac)}
          className={`transition-[stroke-dashoffset] duration-200 ease-linear ${urgent ? "stroke-loss-hi" : "stroke-brass-hi"}`}
        />
      </svg>
      <div className="leading-tight">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-felt-print">{label}</div>
        <div className={`text-lg font-bold tnum ${urgent ? "text-loss-hi" : "text-card"}`}>
          {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, "0")}
          <span className="ml-2 text-xs font-normal text-card/45">{after}</span>
        </div>
      </div>
    </div>
  );
}
