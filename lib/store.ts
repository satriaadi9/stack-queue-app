"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { decodeDeck, MODES, type DeckPreset, type TableChoice } from "./engine/deck-code";
import { newSeed } from "./engine/rng";
import { createRound, payout, reduce, type Action, type Round } from "./engine/round";
import {
  clampTimer,
  DEFAULT_FEE_RATE,
  DEFAULT_TIMER_PRESET,
  maxAffordable,
  tableFee,
  TIMER_PRESETS,
  type TimerPreset,
  type Timers,
} from "./engine/rules";

export const START_BALANCE = 1000;
/** Quick picks for how many chips a new player sits down with. */
export const START_PRESETS = [500, 1000, 2500, 5000, 10000] as const;
export const START_LIMITS = { min: 100, max: 1_000_000 } as const;
export const clampStart = (n: number) =>
  Math.min(START_LIMITS.max, Math.max(START_LIMITS.min, Math.round(Number.isFinite(n) ? n : START_BALANCE)));
export const LOAN_AMOUNT = 500;
export const MIN_WAGER = 10;

export interface Profile {
  initials: string;
  balance: number;
  best: number; // highest balance ever held
  biggestWin: number; // biggest single-round net gain, after the fee
  rounds: number;
  wins: number;
  loans: number;
  lastPlayed: number;
  /** The round on this player's table. Wager and fee already left the balance. */
  round: Round | null;
}

interface State {
  profiles: Record<string, Profile>;
  active: string | null;
  lastMode: TableChoice;
  lastWager: number;
  muted: boolean;
  /** Chips a brand-new player starts with. Existing players keep theirs. */
  startBalance: number;
  timerPreset: TimerPreset;
  customTimers: Timers;
  /** Raw code of the house deck in play, if any. */
  deckCode: string | null;
  deckName: string | null;

  login: (initials: string) => void;
  logout: () => void;
  startRound: (choice: TableChoice, wager: number) => boolean;
  act: (a: Action) => Round | null;
  clearRound: () => void;
  takeLoan: () => void;
  setDeck: (code: string | null) => boolean;
  setTimers: (preset: TimerPreset, custom?: Timers) => void;
  toggleMute: () => void;
  forget: (initials: string) => void;
  setStartBalance: (n: number) => void;
  /** Delete every player on this device, with their chips and records. */
  resetAll: () => void;
}

export const newProfile = (initials: string, balance: number = START_BALANCE): Profile => ({
  initials,
  balance,
  best: balance,
  biggestWin: 0,
  rounds: 0,
  wins: 0,
  loans: 0,
  lastPlayed: Date.now(),
  round: null,
});

export const isLive = (r: Round | null | undefined): r is Round => !!r && r.phase !== "done";

export interface TableRules {
  feeRate: number;
  timers: Timers;
  /** Set by a house deck, so the player can't change them. */
  feeLocked: boolean;
  timersLocked: boolean;
}

/** The rules that apply to the next round: the house deck's, else the player's own. */
export function rulesFor(
  s: Pick<State, "timerPreset" | "customTimers">,
  preset: DeckPreset | null,
): TableRules {
  const own = s.timerPreset === "custom" ? s.customTimers : TIMER_PRESETS[s.timerPreset];
  return {
    feeRate: preset?.feeRate ?? DEFAULT_FEE_RATE,
    timers: preset?.timers ?? { pick: own.pick, open: own.open },
    feeLocked: preset?.feeRate != null,
    timersLocked: !!preset?.timers,
  };
}

/** Pick a table for "Surprise me", using crypto randomness. */
const drawMode = () => MODES[newSeed() % MODES.length];

export const useGame = create<State>()(
  persist(
    (set, get) => {
      /** Update the active profile in place. */
      const patchMe = (fn: (p: Profile) => Partial<Profile> | null) => {
        const s = get();
        const me = s.active ? s.profiles[s.active] : null;
        if (!me) return;
        const patch = fn(me);
        if (patch) set({ profiles: { ...s.profiles, [me.initials]: { ...me, ...patch } } });
      };

      return {
        profiles: {},
        active: null,
        lastMode: "stack",
        lastWager: 50,
        muted: false,
        startBalance: START_BALANCE,
        timerPreset: DEFAULT_TIMER_PRESET,
        customTimers: { pick: 20, open: 30 },
        deckCode: null,
        deckName: null,

        login: (initials) =>
          set((s) => {
            const key = initials.toUpperCase();
            const profiles = s.profiles[key] ? s.profiles : { ...s.profiles, [key]: newProfile(key, clampStart(s.startBalance)) };
            return { profiles, active: key };
          }),

        logout: () => set({ active: null }),

        startRound: (choice, wager) => {
          const s = get();
          const me = s.active ? s.profiles[s.active] : null;
          if (!me || isLive(me.round)) return false;
          const preset = s.deckCode ? decodeDeck(s.deckCode) : null;
          const rules = rulesFor(s, preset);
          if (!Number.isInteger(wager) || wager < 1 || wager > maxAffordable(me.balance, rules.feeRate)) return false;
          const wanted = preset?.mode ?? choice;
          const mode = wanted === "random" ? drawMode() : wanted;
          const fee = tableFee(wager, rules.feeRate);
          const round = createRound({
            mode,
            wager,
            seed: newSeed(),
            preset,
            fee,
            timers: rules.timers,
            randomTable: wanted === "random",
            now: Date.now(),
          });
          set({ lastMode: choice, lastWager: wager });
          // Wager and fee leave the balance immediately, so reloading can't dodge a bust.
          patchMe((p) => ({ round, balance: p.balance - wager - fee, lastPlayed: Date.now() }));
          return true;
        },

        act: (a) => {
          let result: Round | null = null;
          patchMe((me) => {
            const prev = me.round;
            if (!prev) return null;
            const next = reduce(prev, a, Date.now());
            result = next;
            if (next === prev) return null;
            if (next.phase === "done" && prev.phase !== "done") {
              const won = payout(next);
              const balance = me.balance + won;
              const cost = next.wager + next.fee;
              return {
                round: next,
                balance,
                best: Math.max(me.best, balance),
                biggestWin: Math.max(me.biggestWin, won - cost),
                rounds: me.rounds + 1,
                wins: me.wins + (won > cost ? 1 : 0),
                lastPlayed: Date.now(),
              };
            }
            return { round: next };
          });
          return result;
        },

        clearRound: () => patchMe((p) => (p.round && !isLive(p.round) ? { round: null } : null)),

        takeLoan: () =>
          patchMe((p) =>
            p.balance >= MIN_WAGER || isLive(p.round) ? null : { balance: p.balance + LOAN_AMOUNT, loans: p.loans + 1 },
          ),

        setDeck: (code) => {
          if (code === null) {
            set({ deckCode: null, deckName: null });
            return true;
          }
          const preset = decodeDeck(code);
          if (!preset) return false;
          set({ deckCode: code, deckName: preset.name || "House deck" });
          return true;
        },

        setTimers: (preset, custom) =>
          set((s) => ({
            timerPreset: preset,
            customTimers: custom
              ? { pick: clampTimer("pick", custom.pick), open: clampTimer("open", custom.open) }
              : s.customTimers,
          })),

        toggleMute: () => set((s) => ({ muted: !s.muted })),

        forget: (initials) =>
          set((s) => {
            const profiles = { ...s.profiles };
            delete profiles[initials];
            return { profiles, active: s.active === initials ? null : s.active };
          }),

        setStartBalance: (n) => set({ startBalance: clampStart(n) }),

        // Settings (clock, mute, house deck, starting chips) stay; only players go.
        resetAll: () => set({ profiles: {}, active: null, lastWager: 50 }),
      };
    },
    {
      name: "stack-and-deal",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      // v1 rounds have no fee or clocks: give them none, so they finish as before.
      migrate: (persisted, version) => {
        const s = persisted as State;
        if (version < 2 && s?.profiles) {
          for (const p of Object.values(s.profiles)) {
            if (p.round) {
              p.round = {
                fee: 0,
                randomTable: false,
                pickSeconds: 0,
                openSeconds: 0,
                pickDeadline: null,
                openDeadline: null,
                timedOut: false,
                autoPicked: false,
                peekUsed: false,
                ...(p.round as Partial<Round>),
              } as Round;
            }
          }
        }
        return s;
      },
    },
  ),
);

export const useMe = () => useGame((s) => (s.active ? (s.profiles[s.active] ?? null) : null));
export const useRound = () => useGame((s) => (s.active ? (s.profiles[s.active]?.round ?? null) : null));
