"use client";

import { animate, motion, useMotionValue, useTransform } from "motion/react";
import { useEffect } from "react";
import { fmt } from "@/lib/engine/ops";

/** Number that rolls smoothly to its new value. */
export function RollingNumber({ value, className = "" }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => fmt(Math.round(v)));
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.7, ease: [0.2, 0.8, 0.2, 1] });
    return () => c.stop();
  }, [mv, value]);
  return <motion.span className={`tnum ${className}`}>{text}</motion.span>;
}

interface Props {
  pot: number;
  wager: number;
  state: "live" | "bust" | "cashed";
  label?: string;
}

export function PotCounter({ pot, wager, state, label = "Pot" }: Props) {
  const mult = wager > 0 ? pot / wager : 0;
  return (
    <motion.div
      className="flex flex-col items-center text-center"
      animate={state === "bust" ? { x: [0, -10, 9, -6, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.45 }}
      aria-live="polite"
    >
      <span className="felt-print">{label}</span>
      <span
        className={`font-display text-5xl font-bold leading-none transition-colors duration-500 sm:text-6xl ${
          state === "bust" ? "text-loss-hi" : state === "cashed" ? "text-brass-hi" : "text-card"
        }`}
      >
        <RollingNumber value={pot} />
      </span>
      <span className="mt-1.5 font-sans text-[11px] text-felt-print/80 tnum">
        wager {fmt(wager)} · {state === "bust" ? "lost" : `×${mult >= 100 ? Math.round(mult) : mult.toFixed(2)}`}
      </span>
    </motion.div>
  );
}
