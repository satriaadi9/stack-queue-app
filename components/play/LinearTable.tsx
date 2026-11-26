"use client";

import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Card, CardGhost } from "@/components/table/Card";
import { PotCounter } from "@/components/table/PotCounter";
import { fmt } from "@/lib/engine/ops";
import { enqueueFee, nextOut, peekCost, type Action, type Legal, type Round } from "@/lib/engine/round";
import { MODE_COPY } from "@/lib/modes";

interface Props {
  round: Round;
  can: Legal;
  locked: boolean;
  dispatch: (a: Action) => void;
}

export function LinearTable({ round, can, locked, dispatch }: Props) {
  const isStack = round.mode === "stack";
  const copy = MODE_COPY[round.mode];
  const done = round.phase === "done";
  const boardLive = (can.pick || can.enqueue) && !locked;
  const out = nextOut(round);

  return (
    <LayoutGroup>
      <section aria-labelledby="deck-h">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 id="deck-h" className="felt-print">
            The deck
          </h2>
          <p className="text-sm text-card/70" aria-live="polite">
            <DeckHint round={round} can={can} />
          </p>
        </div>
        <div className="mx-auto grid w-fit grid-cols-4 gap-2.5 sm:grid-cols-6 sm:gap-4">
          {round.board.map((c) =>
            round.taken.includes(c.id) ? (
              <CardGhost key={c.id} label={`#${c.slot}`} />
            ) : (
              <Card
                key={c.id}
                card={c}
                faceUp={done}
                onClick={() => dispatch(can.pick ? { type: "pick", slot: c.slot } : { type: "enqueue", slot: c.slot })}
                disabled={!boardLive}
              />
            ),
          )}
        </div>
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-[minmax(200px,auto)_1fr] md:items-start">
        {isStack ? <StackZone round={round} /> : <QueueZone round={round} />}

        <div className="flex flex-col items-center gap-6 md:pt-4">
          <PotCounter
            pot={round.pot}
            wager={round.wager}
            state={round.outcome === "cashed" ? "cashed" : done ? "bust" : "live"}
          />

          {round.phase === "build" && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="plaque plaque-brass min-w-52"
                disabled={!can.deal || locked}
                onClick={() => dispatch({ type: "deal" })}
              >
                Deal {round.structure.length || ""} {round.structure.length === 1 ? "card" : "cards"}
                <span className="kbd">Enter</span>
              </button>
              <span className="text-xs text-card/45">
                {round.structure.length < round.minPicks
                  ? `${round.minPicks - round.structure.length} more to go`
                  : `or keep picking, up to ${round.maxPicks}`}
              </span>
            </div>
          )}

          {round.phase === "resolve" && (
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                className="plaque plaque-brass min-w-36"
                disabled={!can.take || locked}
                onClick={() => dispatch({ type: "take" })}
              >
                {copy.takeVerb}
                <span className="kbd">P</span>
              </button>
              <button
                type="button"
                className="plaque"
                disabled={!can.peek || locked}
                onClick={() => dispatch({ type: "peek" })}
                title={`Reveal the ${isStack ? "top" : "front"} card without applying it. Once per round.`}
              >
                {round.peekUsed ? "Peek used" : `Peek once · −${fmt(peekCost(round.wager))}`}
                {!round.peekUsed && <span className="kbd">K</span>}
              </button>
              <button
                type="button"
                className="plaque plaque-ghost"
                disabled={!can.cashout || locked}
                onClick={() => dispatch({ type: "cashout" })}
              >
                Cash out {fmt(round.pot)}
                <span className="kbd">C</span>
              </button>
            </div>
          )}

          <PlayedRow round={round} />
          {out && round.phase === "resolve" && (
            <span className="sr-only" aria-live="polite">
              Next out: card {out.slot}
            </span>
          )}
        </div>
      </div>
    </LayoutGroup>
  );
}

function DeckHint({ round, can }: { round: Round; can: Legal }) {
  const verb = MODE_COPY[round.mode].putVerb;
  if (round.phase === "build") {
    return (
      <>
        Pick a number to <span className="font-semibold text-card">{verb}</span> it ·{" "}
        <span className="font-sans tnum">
          {round.structure.length}/{round.maxPicks}
        </span>
      </>
    );
  }
  if (can.enqueue) {
    return (
      <>
        The line moved. Tap a card to <span className="font-semibold text-card">enqueue</span> it at the back for{" "}
        {fmt(enqueueFee(round.wager))}.
      </>
    );
  }
  if (round.phase === "done") return <>Every card is face up: here&apos;s what you passed on.</>;
  return <>Cards you didn&apos;t pick stay face down.</>;
}

function StackZone({ round }: { round: Round }) {
  // Render top first. Each lower card tucks behind the one above it.
  const cards = round.structure.slice().reverse();
  return (
    <section className="felt-zone relative flex min-h-[220px] flex-col items-center px-16 pb-6 pt-9" aria-label="Stack">
      <span className="felt-print absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap">Stack · LIFO</span>
      {cards.length === 0 ? (
        <div className="mt-2">
          <CardGhost size="sm" label="empty" />
        </div>
      ) : (
        <ol className="flex flex-col items-center">
          <AnimatePresence initial={false}>
            {cards.map((c, i) => (
              <li key={c.id} className="relative" style={{ marginTop: i === 0 ? 0 : -20, zIndex: 40 - i }}>
                {i === 0 && (
                  <motion.span
                    layoutId="stack-top"
                    className="absolute -left-12 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-[0.2em] text-brass-hi"
                  >
                    top →
                  </motion.span>
                )}
                <Card card={c} size="sm" faceUp={round.revealed.includes(c.id)} emphasis={i === 0 && round.phase === "resolve"} />
              </li>
            ))}
          </AnimatePresence>
        </ol>
      )}
      {cards.length > 1 && <span className="felt-print mt-3 opacity-50">bottom</span>}
    </section>
  );
}

function QueueZone({ round }: { round: Round }) {
  const cards = round.structure;
  const tight = cards.length > 5;
  return (
    <section className="felt-zone relative flex min-h-[150px] flex-col px-5 pb-5 pt-9 md:min-w-[320px]" aria-label="Queue">
      <span className="felt-print absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap">Queue · FIFO</span>
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.2em]">
        <span className="text-brass-hi">← front · out</span>
        <span className="text-felt-print/60">back · in ←</span>
      </div>
      <ol className="mt-3 flex min-h-[72px] items-center">
        {cards.length === 0 && <CardGhost size="sm" label="empty" />}
        {cards.map((c, i) => (
          <li key={c.id} style={{ marginLeft: i === 0 ? 0 : tight ? -12 : 8, zIndex: 40 - i }} className="relative">
            <Card card={c} size="sm" faceUp={round.revealed.includes(c.id)} emphasis={i === 0 && round.phase === "resolve"} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function PlayedRow({ round }: { round: Round }) {
  if (round.resolved.length === 0) return null;
  return (
    <section className="w-full" aria-label="Applied cards">
      <h3 className="felt-print mb-2 text-center">Applied, in order</h3>
      <ol className="flex flex-wrap justify-center gap-x-3 gap-y-4">
        {round.resolved.map((r, i) => (
          <li key={r.card.id} className="flex flex-col items-center gap-1.5">
            <Card card={r.card} size="sm" faceUp />
            <span className="font-sans text-[10px] text-felt-print/80 tnum">
              <span className="text-felt-print/45">{i + 1}.</span> {fmt(r.before)}→
              <span className={r.after > r.before ? "text-card" : r.after < r.before ? "text-loss-hi" : ""}>
                {fmt(Math.max(0, r.after))}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
