import { z } from "zod";
import { opToAscii, parseOp, type Op } from "./ops";
import { clampTimer, MAX_FEE_RATE, type Timers } from "./rules";

export type Mode = "stack" | "queue" | "recursion";
export const MODES: Mode[] = ["stack", "queue", "recursion"];
/** What a player (or host) can ask for: a specific table, or one drawn at random. */
export type TableChoice = Mode | "random";

export const BOARD_SIZE = 12;

export interface DeckPreset {
  name: string;
  /** null = player chooses the table */
  mode: TableChoice | null;
  /** null slot = drawn from the gacha pool */
  slots: (Op | null)[];
  maxPicks: number;
  shuffle: boolean;
  /** Admin fee as a fraction of the wager. null = the default. */
  feeRate: number | null;
  /** Clocks for every player at this table. null = each player's own setting. */
  timers: Timers | null;
}

export const DEFAULT_MAX_PICKS = 5;

const MODE_CODE = { stack: "s", queue: "q", recursion: "r", random: "x" } as const;

const wire = z.object({
  v: z.literal(1),
  n: z.string().max(40).optional(),
  m: z.enum(["s", "q", "r", "x"]).nullable().optional(),
  s: z.string().max(200),
  p: z.number().int().min(3).max(6),
  sh: z.union([z.literal(0), z.literal(1)]),
  // Added later; optional so older links keep working.
  f: z.number().int().min(0).max(MAX_FEE_RATE * 100).optional(),
  t: z.tuple([z.number().int().min(0).max(300), z.number().int().min(0).max(600)]).optional(),
});

function toB64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

export function encodeDeck(p: DeckPreset): string {
  const payload = {
    v: 1,
    n: p.name.trim() || undefined,
    m: p.mode ? MODE_CODE[p.mode] : null,
    s: p.slots.map((op) => (op ? opToAscii(op) : "?")).join(","),
    p: p.maxPicks,
    sh: p.shuffle ? 1 : 0,
    f: p.feeRate === null ? undefined : Math.round(p.feeRate * 100),
    t: p.timers ? [p.timers.pick, p.timers.open] : undefined,
  };
  return toB64Url(JSON.stringify(payload));
}

/** Returns null for anything malformed — never throws on user input. */
export function decodeDeck(code: string): DeckPreset | null {
  try {
    if (!/^[A-Za-z0-9_-]{1,600}$/.test(code)) return null;
    const parsed = wire.safeParse(JSON.parse(fromB64Url(code)));
    if (!parsed.success) return null;
    const w = parsed.data;
    const parts = w.s.split(",");
    if (parts.length !== BOARD_SIZE) return null;
    const slots: (Op | null)[] = [];
    for (const part of parts) {
      if (part === "?") slots.push(null);
      else {
        const op = parseOp(part);
        if (!op) return null;
        slots.push(op);
      }
    }
    const mode = w.m ? (Object.entries(MODE_CODE).find(([, c]) => c === w.m)![0] as TableChoice) : null;
    return {
      name: w.n ?? "",
      mode,
      slots,
      maxPicks: w.p,
      shuffle: w.sh === 1,
      feeRate: w.f === undefined ? null : w.f / 100,
      timers: w.t ? { pick: clampTimer("pick", w.t[0]), open: clampTimer("open", w.t[1]) } : null,
    };
  } catch {
    return null;
  }
}
