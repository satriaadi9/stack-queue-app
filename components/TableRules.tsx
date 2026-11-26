"use client";

import { useState } from "react";
import { fmt } from "@/lib/engine/ops";
import { tableFee, TIMER_LIMITS, TIMER_PRESETS, type TimerPreset, type Timers } from "@/lib/engine/rules";
import { useGame, type TableRules as Rules } from "@/lib/store";

const PRESETS = Object.entries(TIMER_PRESETS) as [Exclude<TimerPreset, "custom">, Timers & { label: string }][];
const secs = (s: number) => (s === 0 ? "no limit" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${s % 60 ? ` ${s % 60}s` : ""}`);

/** Clock and admin fee for the next round. Locked when a house deck sets them. */
export function TableRules({ rules, wager, disabled }: { rules: Rules; wager: number; disabled: boolean }) {
  const preset = useGame((s) => s.timerPreset);
  const custom = useGame((s) => s.customTimers);
  const setTimers = useGame((s) => s.setTimers);
  const [pickText, setPickText] = useState(String(custom.pick));
  const [openText, setOpenText] = useState(String(custom.open));

  const parse = (text: string, kind: keyof Timers) => {
    const n = /^\d{1,3}$/.test(text) ? Number(text) : NaN;
    const { min, max } = TIMER_LIMITS[kind];
    return n >= min && n <= max ? n : null;
  };
  const pickOk = parse(pickText, "pick");
  const openOk = parse(openText, "open");
  const commit = (p: string, o: string) => {
    const pick = parse(p, "pick");
    const open = parse(o, "open");
    if (pick !== null && open !== null) setTimers("custom", { pick, open });
  };

  const t = rules.timers;
  const pct = Math.round(rules.feeRate * 100);
  const fee = tableFee(wager, rules.feeRate);

  return (
    <section className="mt-10 grid gap-4 md:grid-cols-[1.6fr_1fr]" aria-labelledby="rules-h">
      <h2 id="rules-h" className="sr-only">
        Table rules
      </h2>

      <div className="rounded-2xl bg-black/15 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xl font-bold">Clock</h3>
          {rules.timersLocked && <span className="text-xs font-semibold text-brass-hi">Set by the house deck</span>}
        </div>

        {!rules.timersLocked && (
          <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Clock preset">
            {[...PRESETS, ["custom", { label: "Custom", pick: custom.pick, open: custom.open }] as const].map(([key, p]) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={preset === key}
                disabled={disabled}
                onClick={() => setTimers(key as TimerPreset)}
                className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
                  preset === key ? "bg-card text-ink" : "bg-black/20 text-card/75 hover:bg-black/30"
                }`}
              >
                {p.label}
                {key !== "custom" && key !== "off" && (
                  <span className={`ml-1.5 font-normal tnum ${preset === key ? "text-ink/60" : "text-card/45"}`}>
                    {p.pick}/{p.open}s
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {!rules.timersLocked && preset === "custom" && (
          <div className="mt-4 flex flex-wrap gap-4">
            {(
              [
                ["pick", "Seconds to pick", pickText, setPickText, pickOk],
                ["open", "Seconds to open", openText, setOpenText, openOk],
              ] as const
            ).map(([kind, label, text, setText, ok]) => (
              <label key={kind} className="flex flex-col gap-1 text-sm text-card/70">
                {label}
                <input
                  inputMode="numeric"
                  value={text}
                  disabled={disabled}
                  onChange={(e) => {
                    const v = e.target.value.replace(/[^\d]/g, "").slice(0, 3);
                    setText(v);
                    if (kind === "pick") commit(v, openText);
                    else commit(pickText, v);
                  }}
                  aria-invalid={ok === null}
                  className="w-28 rounded-lg border border-felt-print/25 bg-black/20 px-3 py-2 text-lg font-bold text-card tnum focus:border-brass focus:outline-none aria-[invalid=true]:border-loss"
                />
                <span className={`text-xs ${ok === null ? "text-loss-hi" : "text-card/40"}`}>
                  {TIMER_LIMITS[kind].min}–{TIMER_LIMITS[kind].max}s
                </span>
              </label>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm text-card/70">
          {t.pick === 0 && t.open === 0 ? (
            "No clock: take as long as you like."
          ) : (
            <>
              <strong className="font-semibold text-card">{secs(t.pick)}</strong> to pick your cards
              {t.pick > 0 && ". When it runs out, random cards are picked for you"}. Then{" "}
              <strong className="font-semibold text-card">{secs(t.open)}</strong> to open them
              {t.open > 0 && ". When it runs out, you cash out at the current pot"}.
            </>
          )}
        </p>
      </div>

      <div className="rounded-2xl bg-black/15 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xl font-bold">Admin fee</h3>
          {rules.feeLocked && <span className="text-xs font-semibold text-brass-hi">Set by the house deck</span>}
        </div>
        <p className="mt-3 text-3xl font-bold tnum">{pct}%</p>
        <p className="mt-1 text-sm text-card/70">
          {pct === 0 ? (
            "This table charges no fee."
          ) : (
            <>
              of your wager, at least 1 chip, paid on top and never returned. On {fmt(wager || 0)} that&apos;s{" "}
              <strong className="font-semibold text-card tnum">{fmt(fee)}</strong>.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
