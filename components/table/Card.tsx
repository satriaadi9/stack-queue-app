"use client";

import { motion } from "motion/react";
import type { Card as CardT } from "@/lib/engine/deal";
import { formatOp, opSign } from "@/lib/engine/ops";
import { backOf, tierDef } from "@/lib/engine/pool";

const BACK_NAME = { plain: "cream", teal: "teal", oxblood: "oxblood", gold: "gold" } as const;

export type CardSize = "sm" | "md" | "lg";

const SIZE: Record<CardSize, string> = {
  sm: "w-[46px] h-[64px] sm:w-[52px] sm:h-[72px]",
  md: "w-[58px] h-[80px] sm:w-[72px] sm:h-[100px]",
  lg: "w-[84px] h-[116px] sm:w-[104px] sm:h-[144px]",
};

/** Slot numbers on card backs. */
const NUM: Record<CardSize, string> = {
  sm: "text-lg",
  md: "text-2xl sm:text-3xl",
  lg: "text-4xl sm:text-5xl",
};

/** Operation on the face. Sized so four characters ("×2.5") fit. */
const FACE: Record<CardSize, string> = {
  sm: "text-[15px] sm:text-base",
  md: "text-xl sm:text-2xl",
  lg: "text-3xl sm:text-4xl",
};

interface Props {
  card: CardT;
  faceUp: boolean;
  size?: CardSize;
  /** Show the slot number on the back (board) or hide it (structure). */
  showSlot?: boolean;
  /** Visual emphasis, e.g. stack top / queue front. */
  emphasis?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  label?: string;
  layout?: boolean;
}

export function Card({ card, faceUp, size = "md", showSlot = true, emphasis, onClick, disabled, label, layout = true }: Props) {
  const back = backOf(card.tier);
  const interactive = !!onClick && !disabled;
  const aria =
    label ??
    (faceUp
      ? `Card ${card.slot}: ${formatOp(card.op)}, ${tierDef(card.tier).label}`
      : `Card ${card.slot}, ${BACK_NAME[back]} back, face down`);

  const body = (
    <motion.div
      className="relative size-full [transform-style:preserve-3d]"
      initial={false}
      animate={{ rotateY: faceUp ? 180 : 0 }}
      transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
    >
      <CardBack slot={card.slot} back={back} size={size} showSlot={showSlot} />
      <CardFace card={card} size={size} />
    </motion.div>
  );

  const shell = `relative shrink-0 ${SIZE[size]} [perspective:900px] rounded-[9px] ${
    emphasis ? "ring-2 ring-brass-hi ring-offset-2 ring-offset-felt" : ""
  }`;

  if (onClick) {
    return (
      <motion.button
        type="button"
        layoutId={layout ? card.id : undefined}
        layout={layout}
        onClick={interactive ? onClick : undefined}
        disabled={disabled}
        aria-label={aria}
        className={`${shell} ${interactive ? "cursor-pointer" : "cursor-default"}`}
        whileHover={interactive ? { y: -6, rotate: -1.5 } : undefined}
        whileTap={interactive ? { y: -2, scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
      >
        {body}
      </motion.button>
    );
  }
  return (
    <motion.div
      layoutId={layout ? card.id : undefined}
      layout={layout}
      role="img"
      aria-label={aria}
      className={shell}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
    >
      {body}
    </motion.div>
  );
}

function CardBack({ slot, back, size, showSlot }: { slot: number; back: string; size: CardSize; showSlot: boolean }) {
  const light = back === "teal" || back === "oxblood";
  return (
    <div className={`card-body back-${back} backface-hidden absolute inset-0 grid place-items-center overflow-hidden`}>
      <div
        className={`absolute inset-[4px] rounded-[6px] border ${light ? "border-card/45" : "border-ink/35"}`}
        aria-hidden
      />
      {showSlot ? (
        <span className={`font-display font-bold leading-none tnum ${NUM[size]}`} aria-hidden>
          {slot}
        </span>
      ) : (
        <span
          aria-hidden
          className={`size-3 rotate-45 border ${light ? "border-card/70" : "border-ink/60"}`}
        />
      )}
    </div>
  );
}

function CardFace({ card, size }: { card: CardT; size: CardSize }) {
  const sign = opSign(card.op);
  const tone = sign > 0 ? "text-ink" : sign < 0 ? "text-loss" : "text-ink-soft";
  const t = card.tier;
  const frame =
    t === "legendary" ? "border-brass border-2" : t === "cursed" ? "border-loss border-2" : "border-ink/20 border";
  return (
    <div
      className="card-body card-face backface-hidden absolute inset-0 overflow-hidden [transform:rotateY(180deg)]"
      aria-hidden
    >
      <div className={`absolute inset-[4px] rounded-[6px] ${frame}`} />
      <span className="absolute left-[7px] top-[5px] font-sans text-[9px] font-semibold text-ink-soft tnum">
        {card.slot}
      </span>
      <div className="absolute inset-0 grid place-items-center">
        <OpText op={card.op} className={`${tone} ${FACE[size]}`} />
      </div>
      {size !== "sm" && (
        <span
          className={`absolute inset-x-0 bottom-[7px] text-center text-[8px] font-bold uppercase tracking-[0.2em] ${
            t === "cursed" ? "text-loss" : t === "legendary" ? "text-brass-lo" : "text-ink-soft"
          }`}
        >
          {tierDef(t).label}
        </span>
      )}
    </div>
  );
}

/** Dashed outline left on the felt where a card used to be. */
export function CardGhost({ size = "md", label }: { size?: CardSize; label?: string }) {
  return (
    <div
      className={`${SIZE[size]} grid shrink-0 place-items-center rounded-[9px] border border-dashed border-felt-print/25`}
      aria-hidden
    >
      {label && <span className="font-sans text-[10px] text-felt-print/40">{label}</span>}
    </div>
  );
}

/** "×1.5": a slightly smaller operator so the digits carry the weight. */
export function OpText({ op, className = "" }: { op: CardT["op"]; className?: string }) {
  const text = formatOp(op);
  return (
    <span className={`inline-flex items-baseline font-sans font-extrabold leading-none tracking-tight tnum ${className}`}>
      <span className="mr-[0.03em] text-[0.8em]">{text[0]}</span>
      <span>{text.slice(1)}</span>
    </span>
  );
}
