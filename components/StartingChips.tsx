"use client";

import { useState } from "react";
import { fmt } from "@/lib/engine/ops";
import { sfx } from "@/lib/sfx";
import { START_BALANCE, START_LIMITS, START_PRESETS, useGame } from "@/lib/store";

const PRESETS: readonly number[] = START_PRESETS;

/** How many chips a brand-new player sits down with. Folded away until asked for. */
export function StartingChips() {
  const start = useGame((s) => s.startBalance);
  const setStart = useGame((s) => s.setStartBalance);
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(!PRESETS.includes(start));
  const [text, setText] = useState(String(start));

  const parsed = /^\d{1,7}$/.test(text) ? Number(text) : NaN;
  const ok = parsed >= START_LIMITS.min && parsed <= START_LIMITS.max;

  return (
    <section className="mt-5 w-full max-w-md" aria-labelledby="start-h">
      <div className="flex items-baseline justify-between gap-3 px-1">
        <p id="start-h" className="text-sm text-card/60">
          New players start with <strong className="font-semibold text-brass-hi tnum">{fmt(start)}</strong> chips
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="start-panel"
          className="shrink-0 text-xs font-semibold text-card/55 underline-offset-4 hover:text-card hover:underline"
        >
          {open ? "Done" : "Change"}
        </button>
      </div>

      {open && (
        <div id="start-panel" className="mt-3 rounded-2xl bg-black/15 p-4">
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Starting chips">
            {PRESETS.map((n) => {
              const on = !custom && start === n;
              return (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setCustom(false);
                    setStart(n);
                    setText(String(n));
                    sfx.chip();
                  }}
                  className={`rounded-lg px-3.5 py-2 text-sm font-semibold tnum transition-colors ${
                    on ? "bg-card text-ink" : "bg-black/20 text-card/75 hover:bg-black/30"
                  }`}
                >
                  {fmt(n)}
                  {n === START_BALANCE && (
                    <span className={`ml-1.5 text-xs font-normal ${on ? "text-ink/55" : "text-card/45"}`}>default</span>
                  )}
                </button>
              );
            })}
            <button
              type="button"
              role="radio"
              aria-checked={custom}
              onClick={() => {
                setCustom(true);
                setText(String(start));
                sfx.chip();
              }}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${
                custom ? "bg-card text-ink" : "bg-black/20 text-card/75 hover:bg-black/30"
              }`}
            >
              Custom
            </button>
          </div>

          {custom && (
            <label className="mt-4 flex flex-col gap-1 text-sm text-card/70">
              Chips for each new player
              <input
                inputMode="numeric"
                autoFocus
                value={text}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d]/g, "").slice(0, 7);
                  setText(v);
                  const n = Number(v);
                  if (v && n >= START_LIMITS.min && n <= START_LIMITS.max) setStart(n);
                }}
                aria-invalid={!ok}
                className="w-40 rounded-lg border border-felt-print/25 bg-black/20 px-3 py-2 text-lg font-bold text-card tnum focus:border-brass focus-visible:outline-none aria-[invalid=true]:border-loss"
              />
              <span className={`text-xs ${ok ? "text-card/40" : "text-loss-hi"}`}>
                {fmt(START_LIMITS.min)} to {fmt(START_LIMITS.max)}
              </span>
            </label>
          )}

          <p className="mt-4 text-xs text-card/50">
            Only new initials get this. Players already on this device keep the chips they have.
          </p>
        </div>
      )}
    </section>
  );
}
