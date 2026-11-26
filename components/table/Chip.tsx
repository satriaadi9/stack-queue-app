"use client";

import { motion } from "motion/react";

const TONES: Record<string, { face: string; edge: string; text: string }> = {
  "10": { face: "#f4eedf", edge: "#1b1b1b", text: "#1b1b1b" },
  "50": { face: "#a8322a", edge: "#f4eedf", text: "#f4eedf" },
  "100": { face: "#1b1b1b", edge: "#c9a44c", text: "#f4eedf" },
  "250": { face: "#1f6f6a", edge: "#f4eedf", text: "#f4eedf" },
  all: { face: "#c9a44c", edge: "#1b1b1b", text: "#1b1b1b" },
};

interface Props {
  value: number | "all";
  label?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

/** A clay casino chip: dashed edge inlay, printed denomination. */
export function Chip({ value, label, selected, disabled, onClick }: Props) {
  const t = TONES[String(value)] ?? TONES.all;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      aria-label={value === "all" ? "Wager everything" : `Wager ${value}`}
      className="relative size-16 shrink-0 rounded-full disabled:cursor-not-allowed disabled:opacity-30 sm:size-[72px]"
      animate={{ y: selected ? -10 : 0 }}
      whileHover={disabled ? undefined : { y: selected ? -12 : -4 }}
      whileTap={disabled ? undefined : { scale: 0.94 }}
      transition={{ type: "spring", stiffness: 500, damping: 26 }}
      style={{
        background: t.face,
        boxShadow: `0 3px 0 rgb(0 0 0 / 0.45), 0 ${selected ? 16 : 8}px 16px -6px rgb(0 0 0 / 0.6)`,
      }}
    >
      <span
        aria-hidden
        className="absolute inset-[3px] rounded-full"
        style={{ border: `5px dashed ${t.edge}`, opacity: 0.9 }}
      />
      <span
        aria-hidden
        className="absolute inset-[12px] rounded-full"
        style={{ border: `1px solid ${t.edge}`, opacity: 0.5 }}
      />
      <span
        className="relative font-display text-base font-bold leading-none sm:text-lg tnum"
        style={{ color: t.text }}
      >
        {label ?? value}
      </span>
      {selected && (
        <motion.span
          layoutId="chip-marker"
          aria-hidden
          className="absolute -bottom-4 left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-brass-hi"
        />
      )}
    </motion.button>
  );
}
