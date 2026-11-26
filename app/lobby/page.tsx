"use client";

import { AnimatePresence, motion } from "motion/react";
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
import { maxAffordable, tableFee, type Timers } from "@/lib/engine/rules";
import { MODE_COPY, TABLE_COPY } from "@/lib/modes";
import { sfx } from "@/lib/sfx";
import { isLive, LOAN_AMOUNT, MIN_WAGER, rulesFor, useGame, useMe } from "@/lib/store";

const CHOICES: TableChoice[] = [...MODES, "random"];

/** One decision per screen: table, then rules, then money. */
const STEPS = [
  { title: "Choose your table", short: "Table" },
  { title: "Table rules", short: "Clock & fee" },
  { title: "Place your wager", short: "Wager" },
] as const;

const clockLabel = (t: Timers) => (t.pick === 0 && t.open === 0 ? "No clock" : `${t.pick || "∞"}s pick · ${t.open || "∞"}s open`);

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
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);

  useEffect(() => {
    if (hydrated && !me) router.replace("/");
  }, [hydrated, me, router]);

  const goTo = (n: number) => {
    setStep(n);
    setReached((r) => Math.max(r, n));
    sfx.place();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Enter moves forward on the first two steps (the wager field handles its own Enter).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || step >= 2) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, select, button, a")) return;
      e.preventDefault();
      setStep(step + 1);
      setReached((r) => Math.max(r, step + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

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
  const stepBy = effectiveWager >= 1000 ? 100 : 10;
  const broke = me.balance < MIN_WAGER && !live;
  const canWager = maxWager >= 1 || live;

  const play = () => {
    if (startRound(activeMode, effectiveWager)) {
      sfx.chip();
      router.push("/play");
    }
  };

  // What each completed step decided, shown under its name in the progress bar.
  const picked = [
    TABLE_COPY[activeMode].name,
    `${clockLabel(rules.timers)} · ${Math.round(rules.feeRate * 100)}% fee`,
    wagerError ? "—" : `${fmt(effectiveWager)} chips`,
  ];

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

      <main className="mx-auto max-w-5xl px-4 pb-24 pt-6 sm:pt-10">
        {live && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-brass/50 bg-black/20 px-5 py-4">
            <p className="text-card/85">
              A round is still on your table: {fmt(me.round!.wager)} chips on{" "}
              <strong className="font-semibold">{MODE_COPY[me.round!.mode].name}</strong>.
            </p>
            <Link href="/play" className="plaque plaque-brass">
              Back to table
            </Link>
          </div>
        )}

        <Progress step={step} reached={reached} picked={picked} onGo={goTo} />

        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            aria-labelledby="step-h"
            className="mt-8"
          >
            <h1 id="step-h" className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {STEPS[step].title}
            </h1>

            {step === 0 && (
              <>
                <p className="mt-2 text-card/65">
                  Same cards, different structure, different payout.
                  {lockedMode && " The house deck sets the table for this round."}
                </p>
                <div role="radiogroup" aria-label="Table" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
                        <ModeDiagram mode={m} className={`my-3 h-16 w-full ${selected ? "text-brass-hi" : "text-felt-print/70"}`} />
                        <span className="text-sm font-semibold text-card/90">{c.rule}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 rounded-2xl bg-black/15 p-5">
                  <h2 className="felt-print">
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
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <p className="mt-2 text-card/65">How long you get, and what the house charges to sit down.</p>
                <TableRules rules={rules} wager={0} disabled={live} className="mt-6" />
              </>
            )}

            {step === 2 && (
              <>
                <p className="mt-2 text-card/65 tnum">
                  Balance {fmt(me.balance)}. With the {Math.round(rules.feeRate * 100)}% fee, you can wager up to{" "}
                  {fmt(maxWager)}.
                </p>

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
                  <div className="mt-6 grid gap-6 md:grid-cols-[1fr_300px] md:items-start">
                    <div>
                      <div role="radiogroup" aria-label="Wager" className="flex flex-wrap items-end gap-2 pb-4 sm:gap-4">
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

                      <label htmlFor="wager-input" className="mt-4 block text-sm text-card/70">
                        Or type your own amount
                      </label>
                      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
                        <div className="flex items-center rounded-xl bg-black/25 ring-1 ring-felt-print/30 focus-within:ring-2 focus-within:ring-brass">
                          <button
                            type="button"
                            disabled={live || effectiveWager <= 1}
                            onClick={() => (setWager((effectiveWager || 1) - stepBy), sfx.chip())}
                            aria-label={`Lower the wager by ${stepBy}`}
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
                            onClick={() => (setWager((effectiveWager || 0) + stepBy), sfx.chip())}
                            aria-label={`Raise the wager by ${stepBy}`}
                            className="grid size-11 place-items-center text-xl text-card/70 hover:text-card disabled:opacity-30"
                          >
                            +
                          </button>
                        </div>
                        <span
                          id="wager-hint"
                          className={`text-sm ${wagerError ? "text-loss-hi" : "text-card/45"}`}
                          aria-live="polite"
                        >
                          {wagerError ?? `Any amount from 1 to ${fmt(maxWager)}`}
                        </span>
                      </div>
                    </div>

                    <Receipt
                      table={TABLE_COPY[activeMode].name}
                      clock={clockLabel(rules.timers)}
                      wager={effectiveWager}
                      fee={fee}
                      feePct={Math.round(rules.feeRate * 100)}
                      after={me.balance - effectiveWager - fee}
                      valid={!wagerError}
                    />
                  </div>
                )}

                {deckName && (
                  <button
                    type="button"
                    onClick={() => setDeck(null)}
                    className="mt-6 text-xs text-card/50 underline-offset-4 hover:text-card hover:underline"
                  >
                    Leave house deck “{deckName}”, play random cards
                  </button>
                )}

                <div className="mt-8">
                  <OddsTable />
                </div>
              </>
            )}
          </motion.section>
        </AnimatePresence>

        {/* Step navigation */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-felt-print/10 pt-6">
          {step > 0 ? (
            <button type="button" onClick={() => goTo(step - 1)} className="plaque plaque-ghost">
              ← Back
            </button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <button type="button" onClick={() => goTo(step + 1)} className="plaque plaque-brass min-w-56">
              Next: {STEPS[step + 1].short}
              <span className="kbd">Enter</span>
            </button>
          ) : (
            canWager && (
              <button
                type="button"
                onClick={play}
                disabled={live || !!wagerError}
                className="plaque plaque-brass min-w-60 py-4 text-sm"
              >
                {wagerError ? "Deal me in" : `Deal me in · ${fmt(effectiveWager)}${fee ? ` + ${fmt(fee)} fee` : ""}`}
              </button>
            )
          )}
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

/** Three numbered steps joined by a line. Steps already visited can be revisited. */
function Progress({
  step,
  reached,
  picked,
  onGo,
}: {
  step: number;
  reached: number;
  picked: string[];
  onGo: (n: number) => void;
}) {
  return (
    <nav aria-label="Progress">
      <ol className="grid grid-cols-3 gap-2">
        {STEPS.map((s, i) => {
          const state = i === step ? "current" : i <= reached ? "done" : "todo";
          return (
            <li key={s.short} className="min-w-0">
              <button
                type="button"
                disabled={i > reached}
                onClick={() => onGo(i)}
                aria-current={i === step ? "step" : undefined}
                className="group w-full text-left disabled:cursor-default"
              >
                <span className="relative block h-1 overflow-hidden rounded-full bg-black/30">
                  {state !== "todo" && (
                    <motion.span
                      className={`absolute inset-y-0 left-0 rounded-full ${state === "current" ? "bg-brass" : "bg-felt-print/60"}`}
                      initial={false}
                      animate={{ width: "100%" }}
                      transition={{ duration: 0.4 }}
                    />
                  )}
                </span>
                <span className="mt-2.5 flex items-center gap-2">
                  <span
                    className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                      state === "current"
                        ? "bg-brass text-ink"
                        : state === "done"
                          ? "bg-felt-print/25 text-card"
                          : "bg-black/25 text-card/40"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`truncate text-sm font-semibold ${
                      state === "todo" ? "text-card/40" : "text-card group-enabled:group-hover:text-brass-hi"
                    }`}
                  >
                    {s.short}
                  </span>
                </span>
                <span className={`mt-0.5 hidden truncate pl-8 text-xs sm:block ${state === "todo" ? "text-card/25" : "text-card/55"}`}>
                  {i <= reached ? picked[i] : "—"}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** What the round will cost, before committing. */
function Receipt(p: {
  table: string;
  clock: string;
  wager: number;
  fee: number;
  feePct: number;
  after: number;
  valid: boolean;
}) {
  const row = "flex justify-between gap-4 py-1.5";
  return (
    <aside className="rounded-2xl bg-card p-5 text-ink shadow-[0_3px_0_#9f9374,0_14px_24px_-10px_rgb(0_0_0/0.6)]" aria-label="Round summary">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-ink-soft">Your round</h2>
      <dl className="mt-3 text-sm">
        <div className={row}>
          <dt className="text-ink-soft">Table</dt>
          <dd className="font-semibold">{p.table}</dd>
        </div>
        <div className={row}>
          <dt className="text-ink-soft">Clock</dt>
          <dd className="font-semibold">{p.clock}</dd>
        </div>
        <div className={`${row} border-t border-ink/10 pt-2.5`}>
          <dt className="text-ink-soft">Wager</dt>
          <dd className="font-semibold tnum">{p.valid ? fmt(p.wager) : "—"}</dd>
        </div>
        <div className={row}>
          <dt className="text-ink-soft">Admin fee ({p.feePct}%)</dt>
          <dd className="font-semibold tnum">{p.valid ? fmt(p.fee) : "—"}</dd>
        </div>
        <div className={`${row} border-t border-ink/15 pt-2.5 text-base`}>
          <dt className="font-bold">You pay</dt>
          <dd className="font-bold tnum">{p.valid ? fmt(p.wager + p.fee) : "—"}</dd>
        </div>
        <div className={row}>
          <dt className="text-ink-soft">Balance after</dt>
          <dd className="tnum text-ink-soft">{p.valid ? fmt(p.after) : "—"}</dd>
        </div>
      </dl>
    </aside>
  );
}
