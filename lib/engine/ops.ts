export type OpKind = "add" | "sub" | "mul" | "div";

export interface Op {
  kind: OpKind;
  n: number;
}

/** Hard ceiling on any pot, so a host deck full of big multipliers can't run away. */
export const POT_CAP = 10_000_000;

export const OP_LIMITS: Record<OpKind, { min: number; max: number; decimals: boolean }> = {
  add: { min: 1, max: 1000, decimals: false },
  sub: { min: 1, max: 1000, decimals: false },
  mul: { min: 0, max: 100, decimals: true },
  div: { min: 1, max: 100, decimals: true },
};

/**
 * The pot stays an integer: results round down. The tiny epsilon stops float
 * noise (100 × 1.4 = 139.99999…) from costing the player a chip.
 */
export function applyOp(pot: number, op: Op): number {
  let r: number;
  switch (op.kind) {
    case "add":
      r = pot + op.n;
      break;
    case "sub":
      r = pot - op.n;
      break;
    case "mul":
      r = pot * op.n;
      break;
    case "div":
      r = pot / op.n;
      break;
  }
  return Math.min(Math.floor(r + 1e-9), POT_CAP);
}

const SYMBOL: Record<OpKind, string> = {
  add: "+",
  sub: "−", // real minus sign, not a hyphen
  mul: "×",
  div: "÷",
};

export function formatOp(op: Op): string {
  return `${SYMBOL[op.kind]}${op.n}`;
}

/** Ascii form used in deck codes: +20  -21  x5  /2 */
const ASCII: Record<OpKind, string> = { add: "+", sub: "-", mul: "x", div: "/" };

export function opToAscii(op: Op): string {
  return `${ASCII[op.kind]}${op.n}`;
}

export function parseOp(text: string): Op | null {
  const m = /^\s*([+\-x*/×÷−])\s*(\d{1,4}(?:\.\d{1,2})?)\s*$/i.exec(text);
  if (!m) return null;
  const sym = m[1].toLowerCase();
  const kind: OpKind =
    sym === "+" ? "add" : sym === "-" || sym === "−" ? "sub" : sym === "/" || sym === "÷" ? "div" : "mul";
  const n = Number(m[2]);
  const lim = OP_LIMITS[kind];
  if (!Number.isFinite(n) || n < lim.min || n > lim.max) return null;
  if (!lim.decimals && !Number.isInteger(n)) return null;
  return { kind, n };
}

/** +1 helps the pot, 0 neutral, -1 hurts it. */
export function opSign(op: Op): -1 | 0 | 1 {
  switch (op.kind) {
    case "add":
      return 1;
    case "sub":
      return -1;
    case "mul":
      return op.n > 1 ? 1 : op.n === 1 ? 0 : -1;
    case "div":
      return op.n > 1 ? -1 : 0;
  }
}

export function sameOp(a: Op, b: Op): boolean {
  return a.kind === b.kind && a.n === b.n;
}

export const fmt = (n: number) => n.toLocaleString("en-US");
