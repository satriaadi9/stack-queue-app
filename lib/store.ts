"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { decodeDeck, type Mode } from "./engine/deck-code";
import { newSeed } from "./engine/rng";
import { createRound, payout, reduce, type Action, type Round } from "./engine/round";

export const START_BALANCE = 1000;
export const LOAN_AMOUNT = 500;
export const MIN_WAGER = 10;

export interface Profile {
  initials: string;
  balance: number;
  best: number; // highest balance ever held
  biggestWin: number; // biggest single-round net gain
  rounds: number;
  wins: number;
  loans: number;
  lastPlayed: number;
  /** The round on this player's table. Wager already left the balance. */
  round: Round | null;
}

interface State {
  profiles: Record<string, Profile>;
  active: string | null;
  lastMode: Mode;
  lastWager: number;
  muted: boolean;
  /** Raw code of the house deck in play, if any. */
  deckCode: string | null;
  deckName: string | null;

  login: (initials: string) => void;
  logout: () => void;
  startRound: (mode: Mode, wager: number) => boolean;
  act: (a: Action) => Round | null;
  clearRound: () => void;
  takeLoan: () => void;
  setDeck: (code: string | null) => boolean;
  toggleMute: () => void;
  forget: (initials: string) => void;
}

export const newProfile = (initials: string): Profile => ({
  initials,
  balance: START_BALANCE,
  best: START_BALANCE,
  biggestWin: 0,
  rounds: 0,
  wins: 0,
  loans: 0,
  lastPlayed: Date.now(),
  round: null,
});

export const isLive = (r: Round | null | undefined): r is Round => !!r && r.phase !== "done";

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
        deckCode: null,
        deckName: null,

        login: (initials) =>
          set((s) => {
            const key = initials.toUpperCase();
            const profiles = s.profiles[key] ? s.profiles : { ...s.profiles, [key]: newProfile(key) };
            return { profiles, active: key };
          }),

        logout: () => set({ active: null }),

        startRound: (mode, wager) => {
          const s = get();
          const me = s.active ? s.profiles[s.active] : null;
          if (!me || isLive(me.round)) return false;
          if (!Number.isInteger(wager) || wager < 1 || wager > me.balance) return false;
          const preset = s.deckCode ? decodeDeck(s.deckCode) : null;
          const round = createRound({ mode: preset?.mode ?? mode, wager, seed: newSeed(), preset });
          set({ lastMode: mode, lastWager: wager });
          // The wager leaves the balance immediately, so reloading can't dodge a bust.
          patchMe((p) => ({ round, balance: p.balance - wager, lastPlayed: Date.now() }));
          return true;
        },

        act: (a) => {
          let result: Round | null = null;
          patchMe((me) => {
            const prev = me.round;
            if (!prev) return null;
            const next = reduce(prev, a);
            result = next;
            if (next === prev) return null;
            if (next.phase === "done" && prev.phase !== "done") {
              const won = payout(next);
              const balance = me.balance + won;
              return {
                round: next,
                balance,
                best: Math.max(me.best, balance),
                biggestWin: Math.max(me.biggestWin, won - next.wager),
                rounds: me.rounds + 1,
                wins: me.wins + (won > next.wager ? 1 : 0),
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

        toggleMute: () => set((s) => ({ muted: !s.muted })),

        forget: (initials) =>
          set((s) => {
            const profiles = { ...s.profiles };
            delete profiles[initials];
            return { profiles, active: s.active === initials ? null : s.active };
          }),
      };
    },
    {
      name: "stack-and-deal",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
    },
  ),
);

export const useMe = () => useGame((s) => (s.active ? (s.profiles[s.active] ?? null) : null));
export const useRound = () => useGame((s) => (s.active ? (s.profiles[s.active]?.round ?? null) : null));
