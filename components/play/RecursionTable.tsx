"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { useMemo } from "react";
import { Card } from "@/components/table/Card";
import { PotCounter } from "@/components/table/PotCounter";
import { dealOffer, type Card as CardT } from "@/lib/engine/deal";
import { fmt } from "@/lib/engine/ops";
import { MAX_DEPTH, overflowRisk, projectedReturn, type Action, type Legal, type Round } from "@/lib/engine/round";

interface Props {
  round: Round;
  can: Legal;
  locked: boolean;
  dispatch: (a: Action) => void;
}

interface FrameView {
  depth: number;
  card: CardT;
  status: "live" | "returned";
  arg?: number;
  ret?: number;
}

export function RecursionTable({ round, can, locked, dispatch }: Props) {
  const done = round.phase === "done";
  const overflow = round.outcome === "overflow";
  const proj = useMemo(() => projectedReturn(round), [round]);
  const nextRisk = overflowRisk(round.depth + 1);

  // structure[i] is the frame at depth i+1; resolved frames came off deepest-first.
  const frames: FrameView[] = [
    ...round.structure.map((card, i) => ({ depth: i + 1, card, status: "live" as const })),
    ...round.resolved
      .slice()
      .reverse()
      .map((r, i) => ({
        depth: round.structure.length + i + 1,
        card: r.card,
        status: "returned" as const,
        arg: r.before,
        ret: Math.max(0, r.after),
      })),
  ];

  // After a choice, show the two cards passed over at this depth, face up.
  const passed = useMemo(() => {
    if (round.offer || round.phase !== "build" || round.structure.length < round.depth) return [];
    const chosen = round.structure[round.depth - 1];
    return dealOffer(round.seed, round.depth, round.preset).filter((c) => c.id !== chosen?.id);
  }, [round]);

  return (
    <LayoutGroup>
      <section aria-labelledby="offer-h" className="min-h-[200px]">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="offer-h" className="font-mono text-sm text-card">
            dive(<span className="text-brass-hi">{round.depth}</span>)
            <span className="ml-3 font-sans text-sm text-card/65">
              {round.offer
                ? "deals three cards. Choose one for this frame."
                : round.phase === "build"
                  ? "frame set. Go deeper or return?"
                  : round.phase === "resolve"
                    ? "returning, unwinding frames…"
                    : overflow
                      ? "the stack overflowed."
                      : "all frames returned."}
            </span>
          </h2>
          <span className="font-sans text-xs text-felt-print/60 tnum">
            depth {round.depth}/{MAX_DEPTH}
          </span>
        </div>

        <div className="flex min-h-[150px] items-center justify-center gap-4 sm:gap-6">
          {round.offer?.map((c, i) => (
            <Card
              key={c.id}
              card={c}
              size="lg"
              faceUp={false}
              showSlot
              onClick={() => dispatch({ type: "choose", index: i })}
              disabled={!can.choose || locked}
              label={`Choose card ${i + 1}`}
            />
          ))}
          <AnimatePresence>
            {!round.offer &&
              passed.map((c) => (
                <motion.div
                  key={`passed-${c.id}`}
                  initial={{ opacity: 1 }}
                  animate={{ opacity: 0.45 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="relative"
                >
                  <Card card={c} size="lg" faceUp layout={false} />
                  <span className="felt-print absolute -bottom-6 left-1/2 -translate-x-1/2">passed</span>
                </motion.div>
              ))}
          </AnimatePresence>
        </div>
      </section>

      <div className="mt-10 grid gap-8 md:grid-cols-[minmax(260px,auto)_1fr] md:items-start">
        <motion.section
          className={`felt-zone relative isolate px-4 pb-4 pt-9 ${overflow ? "border-loss!" : ""}`}
          aria-label="Call stack"
          animate={overflow ? { x: [0, -8, 7, -5, 3, 0] } : { x: 0 }}
          transition={{ duration: 0.45 }}
        >
          <span className="felt-print absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap">Call stack</span>
          {overflow && (
            <div className="mb-3 rounded-md bg-loss/20 px-3 py-2 font-mono text-[11px] text-loss-hi">
              dive({round.overflowDepth}): StackOverflowError
            </div>
          )}
          <ol className="flex flex-col-reverse gap-2">
            <li className="flex items-center justify-between rounded-md border border-dashed border-felt-print/25 px-3 py-2 font-mono text-[11px] text-felt-print/60">
              <span>base case</span>
              <span className="tnum">returns wager {fmt(round.wager)}</span>
            </li>
            {frames.map((f) => {
              const isTop = f.status === "live" && f.depth === round.structure.length;
              return (
                <motion.li
                  key={f.card.id}
                  layout
                  className={`flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors ${
                    f.status === "returned" ? "bg-black/10 opacity-60" : isTop ? "bg-black/30" : "bg-black/20"
                  }`}
                >
                  <span className="w-16 font-mono text-xs text-card/85">dive({f.depth})</span>
                  <Card card={f.card} size="sm" faceUp emphasis={isTop && round.phase === "resolve"} />
                  <span className="ml-auto text-right font-sans text-[11px] tnum">
                    {f.status === "returned" ? (
                      <>
                        <span className="text-felt-print/60">got {fmt(f.arg!)}</span>
                        <br />
                        <span className={f.ret! > f.arg! ? "text-card" : f.ret! < f.arg! ? "text-loss-hi" : "text-felt-print/80"}>returns {fmt(f.ret!)}</span>
                      </>
                    ) : (
                      <span className="text-felt-print/50">{isTop && round.phase === "build" ? "active" : "waiting"}</span>
                    )}
                  </span>
                </motion.li>
              );
            })}
          </ol>
        </motion.section>

        <div className="flex flex-col items-center gap-6 md:pt-4">
          <PotCounter
            label={round.phase === "build" ? "Wager" : "Return value"}
            pot={round.phase === "build" ? round.wager : round.pot}
            wager={round.wager}
            state={round.outcome === "cashed" ? "cashed" : done ? "bust" : "live"}
          />

          {round.phase === "build" && !round.offer && (
            <>
              <p className="text-center text-sm text-card/75">
                If you return now, the stack unwinds to{" "}
                <span className={`font-sans font-semibold tnum ${proj.busted ? "text-loss-hi" : "text-brass-hi"}`}>
                  {proj.busted ? "a bust" : fmt(proj.final)}
                </span>
                .
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  className="plaque min-w-44"
                  disabled={!can.dive || locked}
                  onClick={() => dispatch({ type: "dive" })}
                >
                  Dive deeper · {Math.round(nextRisk * 100)}% crash
                  <span className="kbd">D</span>
                </button>
                <button
                  type="button"
                  className="plaque plaque-brass min-w-44"
                  disabled={!can.return || locked}
                  onClick={() => dispatch({ type: "return" })}
                >
                  Return
                  <span className="kbd">R</span>
                </button>
              </div>
              {round.depth >= MAX_DEPTH && <p className="text-xs text-card/50">Max depth. Time to return.</p>}
            </>
          )}
          {round.phase === "build" && round.offer && (
            <p className="text-sm text-card/55">
              Card backs show rarity, not value. Press <span className="kbd">1</span>–<span className="kbd">3</span> or tap a card.
            </p>
          )}
          {round.phase === "resolve" && (
            <p className="font-mono text-sm text-card/70">
              unwinding… {round.structure.length} frame{round.structure.length === 1 ? "" : "s"} left
            </p>
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}
