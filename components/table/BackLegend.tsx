"use client";

import { motion } from "motion/react";
import { useEffect, useId, useRef, useState } from "react";
import { charmOf, oddsFor, type CharmId } from "@/lib/engine/charms";
import { formatOp } from "@/lib/engine/ops";
import { tierDef, type Back } from "@/lib/engine/pool";

const pct = (n: number) => `${Number.isInteger(n) ? n : n.toFixed(1)}%`;

interface Entry {
  back: Back;
  name: string;
  short: string;
  detail: (odds: ReturnType<typeof oddsFor>) => string[];
}

const ops = (t: Parameters<typeof tierDef>[0]) => tierDef(t).ops.map(formatOp).join("  ");

/** What each card back can hide. Gold is shared by the jackpot and the curse. */
const ENTRIES: Entry[] = [
  {
    back: "plain",
    name: "Cream",
    short: "Common",
    detail: (o) => [`Common · ${pct(o.common)} of cards`, ops("common"), "Small nudges up or down."],
  },
  {
    back: "teal",
    name: "Teal",
    short: "Rare",
    detail: (o) => [`Rare · ${pct(o.rare)} of cards`, ops("rare"), "Bigger moves, either way."],
  },
  {
    back: "oxblood",
    name: "Oxblood",
    short: "Epic",
    detail: (o) => [`Epic · ${pct(o.epic)} of cards`, ops("epic"), "Doubles the pot, or halves it."],
  },
  {
    back: "gold",
    name: "Gold",
    short: "×3 or curse",
    detail: (o) =>
      o.cursed === 0
        ? [`Legendary · ${pct(o.legendary)} of cards`, ops("legendary"), "Your ward keeps curses out: every gold card is ×3."]
        : [
            `Legendary ${pct(o.legendary)} or cursed ${pct(o.cursed)}`,
            `${ops("legendary")}   or   ${ops("cursed")}`,
            `The same back for both: a ${Math.round((o.legendary / (o.legendary + o.cursed)) * 100)}% shot at ×3.`,
          ],
  },
];

/**
 * A small key to the card backs, printed beside the deck. Hover, focus or tap
 * a colour for what it can hide and how likely it is, with any charm applied.
 */
export function BackLegend({ charm = "none", hostSet = false }: { charm?: CharmId; hostSet?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const odds = oddsFor(charm);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const pointer = useRef("mouse");

  // A tap elsewhere closes a tooltip opened by tapping.
  useEffect(() => {
    if (open === null) return;
    const close = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <div
      ref={root}
      role="group"
      aria-label="Card colours"
      className="relative mb-4 flex flex-wrap items-center justify-center gap-x-1 gap-y-1.5"
    >
      <span className="mr-1 text-xs text-card/45">Card backs:</span>
      {ENTRIES.map((e, i) => {
        const on = open === i;
        return (
          <span key={e.back} className="relative">
            <button
              type="button"
              aria-describedby={on ? `${id}-${i}` : undefined}
              aria-expanded={on}
              // Mouse: hover shows it, so a click keeps it. Touch: a tap toggles it.
              onPointerDown={(ev) => (pointer.current = ev.pointerType)}
              onClick={() => setOpen(pointer.current === "mouse" || !on ? i : null)}
              onPointerEnter={(ev) => ev.pointerType === "mouse" && setOpen(i)}
              onPointerLeave={(ev) => ev.pointerType === "mouse" && setOpen((cur) => (cur === i ? null : cur))}
              // Keyboard focus shows it too; a tap's focus is left to the click.
              onFocus={(ev) => ev.currentTarget.matches(":focus-visible") && setOpen(i)}
              onBlur={() => setOpen((cur) => (cur === i ? null : cur))}
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
                on ? "bg-black/30 text-card" : "text-card/70 hover:bg-black/20"
              }`}
            >
              <span className={`back-${e.back} card-body block h-4 w-3 rounded-[3px]`} aria-hidden />
              <span>
                <span className="font-semibold">{e.name}</span>
                <span className="text-card/50"> {e.back === "gold" && odds.cursed === 0 ? "×3" : e.short}</span>
              </span>
            </button>
            {/* No exit animation: moving between colours swaps tooltips instantly, never two at once. */}
            {on && (
                <motion.span
                  id={`${id}-${i}`}
                  role="tooltip"
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.12 }}
                  className={`absolute top-full z-30 mt-2 block w-60 rounded-xl bg-card p-3 text-left text-ink shadow-[0_3px_0_#9f9374,0_14px_24px_-10px_rgb(0_0_0/0.6)] ${
                    i < 2 ? "left-0" : "right-0"
                  }`}
                >
                  {e.detail(odds).map((line, j) => (
                    <span
                      key={j}
                      className={`block ${j === 0 ? "text-xs font-bold uppercase tracking-[0.1em] text-ink-soft" : j === 1 ? "mt-1 text-sm font-bold tnum" : "mt-1 text-xs text-ink-soft"}`}
                    >
                      {line}
                    </span>
                  ))}
                  {charm !== "none" && (
                    <span className="mt-2 block border-t border-ink/10 pt-1.5 text-[11px] text-ink-soft">
                      Odds include your {charmOf(charm).name.toLowerCase()}.
                    </span>
                  )}
                  {hostSet && (
                    <span className="mt-2 block border-t border-ink/10 pt-1.5 text-[11px] text-ink-soft">
                      House deck: cards the host set get the colour that matches their swing.
                    </span>
                  )}
                </motion.span>
            )}
          </span>
        );
      })}
    </div>
  );
}
