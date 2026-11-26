"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ModeDiagram } from "@/components/ModeDiagram";
import { OddsTable } from "@/components/OddsTable";
import { useHydrated } from "@/components/Providers";
import { TableRules } from "@/components/TableRules";
import { Chip } from "@/components/table/Chip";
import { Rail } from "@/components/table/Rail";
import { decodeDeck, MODES, type TableChoice } from "@/lib/engine/deck-code";
import { fmt } from "@/lib/engine/ops";
import { WAGERS } from "@/lib/engine/round";
import { maxAffordable, tableFee } from "@/lib/engine/rules";
import { MODE_COPY, TABLE_COPY } from "@/lib/modes";
import { sfx } from "@/lib/sfx";
import { isLive, LOAN_AMOUNT, MIN_WAGER, rulesFor, useGame, useMe } from "@/lib/store";

const CHOICES: TableChoice[] = [...MODES, "random"];

export default function Lobby() {
  const hydrated = useHydrated();
  const router = useRouter();
  const me = useMe();
  const lastMode = useGame((s) => s.lastMode);
  const lastWager = useGame((s) => s.lastWager);
  const deckCode = useGame((s) => s.deckCode);
  const deckName = useGame((s) => s.deckName);
  const setDeck = useGame((s) => s.setDeck);
  const startRound = useGame((s) => s.startRound);
  const takeLoan = useGame((s) => s.takeLoan);
  const logout = useGame((s) => s.logout);
  const timerPreset = useGame((s) => s.timerPreset);
  const customTimers = useGame((s) => s.customTimers);

  const preset = useMemo(() => (deckCode ? decodeDeck(deckCode) : null), [deckCode]);
  const lockedMode = preset?.mode ?? null;

  const rules = useMemo(() => rulesFor({ timerPreset, customTimers }, preset), [timerPreset, customTimers, preset]);
  const [mode, setMode] = useState<TableChoice>(lastMode);
  // Kept as text so the field can be empty or half-typed while editing.
  const [wagerText, setWagerText] = useState<string>(String(lastWager));

  useEffect(() => {
    if (hydrated && !me) router.replace("/");
  }, [hydrated, me, router]);

  if (!hydrated || !me) return <Rail />;

  const live = isLive(me.round);
  const activeMode = lockedMode ?? mode;
  // The fee is paid on top of the wager, so the biggest wager is a bit under the balance.
  const maxWager = maxAffordable(me.balance, rules.feeRate);
  const typed = /^\d{1,9}$/.test(wagerText) ? Number(wagerText) : NaN;
  const wagerError = Number.isNaN(typed)
    ? "Enter a whole number of chips."
    : typed < 1
      ? "The wager has to be at least 1 chip."
      : typed > maxWager
        ? `With the admin fee, the most you can wager is ${fmt(maxWager)}.`
        : null;
  const effectiveWager = wagerError ? 0 : typed;
  const fee = tableFee(effectiveWager, rules.feeRate);
  const setWager = (n: number) => setWagerText(String(Math.max(1, Math.min(n, maxWager))));
  const step = effectiveWager >= 1000 ? 100 : 10;
  const broke = me.balance < MIN_WAGER && !live;
  const canWager = maxWager >= 1 || live;

  const play = () => {
    if (startRound(activeMode, effectiveWager)) {
      sfx.chip();
      router.push("/play");
    }
  };

  return (
    <>
      <Rail>
        <button
          type="button"
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-card/55 hover:text-card sm:block"
        >
          Leave seat
        </button>
      </Rail>

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:pt-12">
        {live && (
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brass/50 bg-black/20 px-5 py-4">
            <p className="text-card/85">
              A round is still on your table: {fmt(me.round!.wager)} chips on{" "}
              <strong className="font-semibold">{MODE_COPY[me.round!.mode].name}</strong>.
            </p>
            <Link href="/play" className="plaque plaque-brass">
              Back to table
            </Link>
          </div>
        )}

        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Choose your table</h1>
        <p className="mt-2 text-card/65">
          Same cards, different structure, different payout.
          {lockedMode && " The house deck sets the table for this round."}
        </p>

        <div role="radiogroup" aria-label="Table" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHOICES.map((m) => {
            const c = TABLE_COPY[m];
            const selected = activeMode === m;
            const disabled = !!lockedMode && lockedMode !== m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  setMode(m);
                  sfx.place();
                }}
                className={`relative flex flex-col rounded-2xl p-5 text-left transition-[opacity,background-color] disabled:opacity-30 ${
                  selected ? "bg-black/25" : "bg-black/10 hover:bg-black/20"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="mode-ring"
                    className="absolute inset-0 rounded-2xl border-2 border-brass"
                    transition={{ type: "spring", stiffness: 500, damping: 38 }}
                    aria-hidden
                  />
                )}
                <span className="felt-print">{c.structure}</span>
                <span className="mt-1 font-display text-2xl font-bold lg:text-xl">{c.name}</span>
                <ModeDiagram mode={m} className={`my-4 h-20 w-full ${selected ? "text-brass-hi" : "text-felt-print/70"}`} />
                <span className="text-sm font-semibold text-card/90">{c.rule}</span>
                <span className="mt-1 text-sm text-card/60">{c.pitch}</span>
              </button>
            );
          })}
        </div>

        <section className="mt-6 rounded-2xl bg-black/15 p-5 sm:p-6" aria-labelledby="how-h">
          <h2 id="how-h" className="felt-print">
            {activeMode === "random" ? "How a random table works" : `How ${TABLE_COPY[activeMode].name.toLowerCase()} plays`}
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-3">
            {TABLE_COPY[activeMode].how.map((line, i) => (
              <li key={i} className="flex gap-3 text-sm text-card/80">
                <span className="font-display text-xl font-bold leading-none text-brass">{i + 1}</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-t border-felt-print/10 pt-3 text-sm text-card/60">
            <span className="font-semibold text-brass-hi">Tip:</span> {TABLE_COPY[activeMode].tip}
          </p>
        </section>

        <TableRules rules={rules} wager={effectiveWager || 0} disabled={live} />

        <section className="mt-10" aria-labelledby="wager-h">
          <div className="flex items-baseline justify-between gap-4">
            <h2 id="wager-h" className="font-display text-2xl font-bold">
              Place your wager
            </h2>
            <span className="text-sm text-card/60 tnum">
              balance {fmt(me.balance)} · max wager {fmt(maxWager)}
            </span>
          </div>

          {broke && (
            <div className="mt-5 rounded-xl border border-loss/60 bg-loss/10 p-5">
              <p className="text-card/90">
                You&apos;re out of chips. The house will lend you {fmt(LOAN_AMOUNT)}. Loans are shown on the leaderboard.
              </p>
              <button type="button" onClick={() => (takeLoan(), sfx.cash())} className="plaque mt-4">
                Take a {fmt(LOAN_AMOUNT)} loan
              </button>
            </div>
          )}
          {canWager && (
            <>
              <div role="radiogroup" aria-label="Wager" className="mt-6 flex flex-wrap items-end gap-2 pb-4 sm:gap-5">
                {WAGERS.map((w) => (
                  <Chip
                    key={w}
                    value={w}
                    selected={effectiveWager === w}
                    disabled={w > maxWager || live}
                    onClick={() => {
                      setWager(w);
                      sfx.chip();
                    }}
                  />
                ))}
                <Chip
                  value="all"
                  label="ALL"
                  selected={effectiveWager === maxWager && !WAGERS.includes(maxWager as never)}
                  disabled={live}
                  onClick={() => {
                    setWager(maxWager);
                    sfx.chip();
                  }}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                <label htmlFor="wager-input" className="text-sm text-card/70">
                  Or type your own amount
                </label>
                <div className="flex items-center rounded-xl bg-black/25 ring-1 ring-felt-print/30 focus-within:ring-2 focus-within:ring-brass">
                  <button
                    type="button"
                    disabled={live || effectiveWager <= 1}
                    onClick={() => (setWager((effectiveWager || 1) - step), sfx.chip())}
                    aria-label={`Lower the wager by ${step}`}
                    className="grid size-11 place-items-center text-xl text-card/70 hover:text-card disabled:opacity-30"
                  >
                    −
                  </button>
                  <input
                    id="wager-input"
                    inputMode="numeric"
                    autoComplete="off"
                    value={wagerText}
                    disabled={live}
                    onChange={(e) => setWagerText(e.target.value.replace(/[^\d]/g, "").slice(0, 9))}
                    onKeyDown={(e) => e.key === "Enter" && !wagerError && play()}
                    aria-invalid={!!wagerError}
                    aria-describedby="wager-hint"
                    className="w-28 bg-transparent py-2 text-center text-xl font-bold text-card tnum outline-none focus-visible:outline-none"
                  />
                  <button
                    type="button"
                    disabled={live || effectiveWager >= maxWager}
                    onClick={() => (setWager((effectiveWager || 0) + step), sfx.chip())}
                    aria-label={`Raise the wager by ${step}`}
                    className="grid size-11 place-items-center text-xl text-card/70 hover:text-card disabled:opacity-30"
                  >
                    +
                  </button>
                </div>
                <span id="wager-hint" className={`text-sm ${wagerError ? "text-loss-hi" : "text-card/45"}`} aria-live="polite">
                  {wagerError ?? `Any amount from 1 to ${fmt(maxWager)}`}
                </span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={play}
                  disabled={live || !!wagerError}
                  className="plaque plaque-brass min-w-60 py-4 text-sm"
                >
                  {wagerError ? "Deal me in" : `Deal me in · ${fmt(effectiveWager)}${fee ? ` + ${fmt(fee)} fee` : ""}`}
                </button>
                {deckName && (
                  <button
                    type="button"
                    onClick={() => setDeck(null)}
                    className="text-xs text-card/50 underline-offset-4 hover:text-card hover:underline"
                  >
                    Leave house deck “{deckName}”, play random cards
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        <div className="mt-12">
          <OddsTable />
        </div>

        <nav className="mt-10 flex flex-wrap gap-6 text-sm text-card/50">
          <Link href="/regulars" className="hover:text-card">
            Leaderboard
          </Link>
          <Link href="/host" className="hover:text-card">
            Host a table
          </Link>
          <button
            type="button"
            onClick={() => {
              logout();
              router.push("/");
            }}
            className="hover:text-card sm:hidden"
          >
            Leave seat
          </button>
        </nav>
      </main>
    </>
  );
}
