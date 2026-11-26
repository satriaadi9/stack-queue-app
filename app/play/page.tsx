"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Clocks } from "@/components/play/Clocks";
import { LinearTable } from "@/components/play/LinearTable";
import { RecursionTable } from "@/components/play/RecursionTable";
import { Summary } from "@/components/play/Summary";
import { useActionLock } from "@/components/play/useActionLock";
import { useHydrated } from "@/components/Providers";
import { Rail } from "@/components/table/Rail";
import { CodePane } from "@/components/teach/CodePane";
import { TracePanel } from "@/components/teach/TracePanel";
import { opSign } from "@/lib/engine/ops";
import { legal, type Action, type Round } from "@/lib/engine/round";
import { MODE_COPY } from "@/lib/modes";
import { sfx } from "@/lib/sfx";
import { decodeDeck } from "@/lib/engine/deck-code";
import { maxAffordable } from "@/lib/engine/rules";
import { rulesFor, useGame, useMe, useRound } from "@/lib/store";

const ANIM_MS = 450;
const UNWIND_MS = 850;
const SUMMARY_DELAY_MS = 1100;

function soundFor(a: Action, prev: Round, next: Round) {
  if (next.outcome === "bust" || next.outcome === "overflow") return sfx.bust();
  const flipped = a.type === "take" || a.type === "unwind" ? next.resolved[next.resolved.length - 1]?.card : null;
  const chosen = a.type === "choose" ? next.structure[next.structure.length - 1] : null;
  const card = flipped ?? chosen;
  if (card) {
    sfx.flip();
    if (card.tier === "legendary") setTimeout(sfx.gold, 120);
    else if (flipped) setTimeout(opSign(card.op) > 0 ? sfx.good : opSign(card.op) < 0 ? sfx.bad : () => {}, 120);
  } else if (a.type === "peek") sfx.flip();
  else if (a.type === "return") sfx.chip();
  else sfx.place();
  if (next.outcome === "cashed" && prev.phase !== "done") setTimeout(sfx.cash, 350);
}

export default function Play() {
  const hydrated = useHydrated();
  const router = useRouter();
  const me = useMe();
  const round = useRound();
  const act = useGame((s) => s.act);
  const startRound = useGame((s) => s.startRound);
  const clearRound = useGame((s) => s.clearRound);
  const { locked, run } = useActionLock();
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    if (!hydrated) return;
    if (!me) router.replace("/");
    else if (!round) router.replace("/lobby");
  }, [hydrated, me, round, router]);

  const dispatch = useCallback(
    (a: Action) =>
      run(() => {
        const s = useGame.getState();
        const prev = s.active ? (s.profiles[s.active]?.round ?? null) : null;
        if (!prev) return false;
        const next = act(a);
        if (!next || next === prev) return false;
        soundFor(a, prev, next);
        return true;
      }, ANIM_MS),
    [act, run],
  );

  // Recursion: once returning, frames unwind on their own, one per beat.
  useEffect(() => {
    if (round?.mode !== "recursion" || round.phase !== "resolve") return;
    const t = setTimeout(() => {
      const prev = round;
      const next = act({ type: "unwind" });
      if (next && next !== prev) soundFor({ type: "unwind" }, prev, next);
    }, UNWIND_MS);
    return () => clearTimeout(t);
  }, [round, act]);

  // Clocks: fire a timeout when the nearest deadline passes. Deadlines live in the
  // saved round, so a reload picks up the same clock instead of resetting it.
  useEffect(() => {
    if (!round || round.phase === "done") return;
    const pending = [round.pickDeadline, round.openDeadline].filter((d): d is number => d !== null);
    if (pending.length === 0) return;
    const t = setTimeout(
      () => {
        const prev = round;
        const next = act({ type: "timeout" });
        if (next && next !== prev) soundFor({ type: "timeout" }, prev, next);
      },
      Math.max(0, Math.min(...pending) - Date.now()) + 40,
    );
    return () => clearTimeout(t);
  }, [round, act]);

  // Let the final flip land before the results slide up.
  const done = round?.phase === "done";
  useEffect(() => {
    if (!done) {
      setShowSummary(false);
      return;
    }
    const t = setTimeout(() => setShowSummary(true), SUMMARY_DELAY_MS);
    return () => clearTimeout(t);
  }, [done]);

  const maxWager = useGame((s) => {
    const p = s.active ? s.profiles[s.active] : null;
    if (!p) return 0;
    return maxAffordable(p.balance, rulesFor(s, s.deckCode ? decodeDeck(s.deckCode) : null).feeRate);
  });

  const again = useCallback(() => {
    if (!round || !me) return;
    const wager = Math.min(round.wager, maxWager);
    clearRound();
    // A random table draws again; otherwise sit at the same one.
    if (wager >= 1 && startRound(round.randomTable ? "random" : round.mode, wager)) sfx.chip();
    else router.push("/lobby");
  }, [round, me, maxWager, clearRound, startRound, router]);

  const toLobby = useCallback(() => {
    clearRound();
    router.push("/lobby");
  }, [clearRound, router]);

  // Keyboard: digits pick, letters act.
  useEffect(() => {
    if (!round) return;
    const can = legal(round);
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      const k = e.key.toLowerCase();
      const slot = k === "0" ? 10 : k === "-" ? 11 : k === "=" ? 12 : /^[1-9]$/.test(k) ? Number(k) : null;
      let a: Action | null = null;
      if (slot !== null) {
        if (can.choose && slot <= 3) a = { type: "choose", index: slot - 1 };
        else if (can.pick) a = { type: "pick", slot };
        else if (can.enqueue) a = { type: "enqueue", slot };
      } else if (k === "enter") {
        if (can.deal) a = { type: "deal" };
        else if (round.phase === "done" && showSummary) {
          e.preventDefault();
          again();
          return;
        }
      } else if (k === "p" || k === " ") a = can.take ? { type: "take" } : null;
      else if (k === "k") a = can.peek ? { type: "peek" } : null;
      else if (k === "c") a = can.cashout ? { type: "cashout" } : null;
      else if (k === "d") a = can.dive ? { type: "dive" } : null;
      else if (k === "r") a = can.return ? { type: "return" } : null;
      if (a) {
        e.preventDefault();
        dispatch(a);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [round, dispatch, again, showSummary]);

  if (!hydrated || !me || !round) return <Rail />;

  const can = legal(round);
  const copy = MODE_COPY[round.mode];

  return (
    <>
      <Rail>
        <Link
          href="/lobby"
          className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-card/55 hover:text-card sm:block"
        >
          {done ? "Lobby" : "Step away"}
        </Link>
      </Rail>

      <main className="mx-auto grid max-w-6xl gap-8 px-4 pb-72 pt-6 lg:grid-cols-[1fr_300px] lg:pb-24">
        <div className="min-w-0">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="felt-print">
                {round.randomTable && <span className="text-brass-hi">Drawn at random · </span>}
                {copy.structure} · {copy.rule}
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{copy.name}</h1>
            </div>
            <Link href="/lobby" className="text-xs text-card/50 underline-offset-4 hover:text-card hover:underline sm:hidden">
              {done ? "Lobby" : "Step away"}
            </Link>
          </header>

          {/* Sticky on phones so the clock stays in view while scrolling to the buttons. */}
          {(round.pickDeadline !== null || round.openDeadline !== null) && (
            <div className="sticky top-14 z-20 -mx-4 mb-6 border-b border-felt-print/10 bg-felt-deep px-4 py-2.5 lg:static lg:mx-0 lg:rounded-xl lg:border-0 lg:bg-black/20">
              <Clocks round={round} />
            </div>
          )}

          {round.mode === "recursion" ? (
            <RecursionTable round={round} can={can} locked={locked} dispatch={dispatch} />
          ) : (
            <LinearTable round={round} can={can} locked={locked} dispatch={dispatch} />
          )}
        </div>

        <aside className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)]">
          {round.mode === "recursion" && <CodePane round={round} />}
          <TracePanel trace={round.trace} className="h-72 lg:h-auto lg:flex-1" />
          <details className="rounded-xl bg-black/15 px-4 py-3 text-sm">
            <summary className="cursor-pointer font-semibold text-card/75">How {copy.structure.toLowerCase()} works</summary>
            <ol className="mt-3 space-y-2 text-card/70">
              {copy.how.map((h, i) => (
                <li key={i} className="flex gap-2">
                  <span className="font-display font-bold text-brass">{i + 1}</span>
                  {h}
                </li>
              ))}
            </ol>
            <p className="mt-3 text-card/55">{copy.tip}</p>
          </details>
        </aside>
      </main>

      <AnimatePresence>
        {done && showSummary && (
          <Summary
            key="summary"
            round={round}
            balance={me.balance}
            canAgain={maxWager >= 1}
            maxWager={maxWager}
            onAgain={again}
            onLobby={toLobby}
            onHide={() => setShowSummary(false)}
          />
        )}
        {done && !showSummary && (
          <motion.button
            key="reopen"
            type="button"
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1, transition: { delay: SUMMARY_DELAY_MS / 1000 } }}
            exit={{ y: 30, opacity: 0 }}
            onClick={() => setShowSummary(true)}
            className="plaque plaque-brass fixed bottom-6 left-1/2 z-40 -translate-x-1/2"
          >
            Round over · results
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
