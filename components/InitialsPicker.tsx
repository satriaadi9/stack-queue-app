"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { sfx } from "@/lib/sfx";

const A = "A".charCodeAt(0);
const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);

interface Props {
  onSubmit: (initials: string) => void;
}

/**
 * Three letter tiles. Type on a keyboard (real input underneath, so phones get
 * their keyboard) or nudge each letter with the chevrons like an arcade wheel.
 */
export function InitialsPicker({ onSubmit }: Props) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const nudge = (i: number, d: 1 | -1) => {
    const chars = value.padEnd(3, " ").split("");
    const cur = chars[i] === " " ? (d === 1 ? A - 1 : A + 26) : chars[i].charCodeAt(0);
    chars[i] = String.fromCharCode(A + ((cur - A + d + 26) % 26));
    // Fill any gaps before i with 'A' so the value stays contiguous.
    for (let j = 0; j < i; j++) if (chars[j] === " ") chars[j] = "A";
    setValue(chars.join("").trimEnd());
    sfx.chip();
  };

  const ready = value.length === 3;
  const submit = () => ready && onSubmit(value);

  return (
    <form
      className="flex flex-col items-center gap-7"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label htmlFor="initials" className="felt-print">
        Your initials
      </label>
      <input
        ref={input}
        id="initials"
        value={value}
        onChange={(e) => {
          const v = clean(e.target.value);
          if (v.length > value.length) sfx.chip();
          setValue(v);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={3}
        autoFocus
        className="sr-only"
        aria-describedby="initials-hint"
      />
      <div className="flex gap-3 sm:gap-4" onClick={() => input.current?.focus()}>
        {[0, 1, 2].map((i) => {
          const ch = value[i];
          const caret = focused && i === Math.min(value.length, 2) && !ready;
          return (
            <div key={i} className="flex flex-col items-center gap-1.5">
              <Chevron dir="up" onClick={() => nudge(i, 1)} label={`Next letter for position ${i + 1}`} />
              <div
                className={`card-body card-face relative grid h-[104px] w-[76px] place-items-center overflow-hidden sm:h-[124px] sm:w-[90px] ${
                  caret ? "ring-2 ring-brass-hi ring-offset-2 ring-offset-felt" : ""
                }`}
              >
                <div className="absolute inset-[4px] rounded-[6px] border border-ink/20" aria-hidden />
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={ch ?? "empty"}
                    initial={{ y: 24, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -24, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 600, damping: 34 }}
                    className={`font-display text-6xl font-bold leading-none sm:text-7xl ${ch ? "text-ink" : "text-ink/15"}`}
                  >
                    {ch ?? "·"}
                  </motion.span>
                </AnimatePresence>
              </div>
              <Chevron dir="down" onClick={() => nudge(i, -1)} label={`Previous letter for position ${i + 1}`} />
            </div>
          );
        })}
      </div>
      <p id="initials-hint" className="text-center text-sm text-card/55">
        Type three letters, or use the arrows.
      </p>
      <button type="submit" disabled={!ready} className="plaque plaque-brass min-w-56 py-3.5 text-sm">
        Take a seat
      </button>
    </form>
  );
}

function Chevron({ dir, onClick, label }: { dir: "up" | "down"; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      className="grid h-8 w-14 place-items-center rounded-md text-card/45 transition-colors hover:bg-black/15 hover:text-brass-hi"
    >
      <svg width="18" height="10" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d={dir === "up" ? "M2 8l7-6 7 6" : "M2 2l7 6 7-6"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
