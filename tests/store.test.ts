import { beforeEach, describe, expect, it } from "vitest";
import { BOARD_SIZE, encodeDeck } from "@/lib/engine/deck-code";
import { parseOp } from "@/lib/engine/ops";
import { clampStart, START_BALANCE, START_LIMITS, useGame } from "@/lib/store";

const code = (startChips: number | null, fixed = false) =>
  encodeDeck({
    name: "T",
    mode: null,
    slots: Array.from({ length: BOARD_SIZE }, () => (fixed ? parseOp("+1") : null)),
    maxPicks: 5,
    shuffle: false,
    feeRate: null,
    timers: null,
    startChips,
  });

const fresh = useGame.getState();

describe("players on this device", () => {
  beforeEach(() =>
    useGame.setState({ ...fresh, profiles: {}, active: null, startBalance: START_BALANCE, deckCode: null, deckName: null }, true),
  );

  it("a house deck's starting chips beat the device setting", () => {
    const g = useGame.getState();
    g.setStartBalance(5000);
    expect(g.setDeck(code(250))).toBe(true);
    g.login("HSE");
    expect(useGame.getState().profiles.HSE.balance).toBe(250);
    useGame.getState().setDeck(code(null));
    useGame.getState().login("DEV");
    expect(useGame.getState().profiles.DEV.balance).toBe(5000);
  });

  it("a charm is paid up front with the wager and fee", () => {
    const g = useGame.getState();
    g.login("LUK");
    expect(g.startRound("stack", 100, "legendary")).toBe(true);
    const me = useGame.getState().profiles.LUK;
    expect(me.balance).toBe(1000 - 100 - 10 - 40);
    expect(me.round?.charm).toBe("legendary");
    expect(me.round?.charmCost).toBe(40);
    expect(useGame.getState().lastCharm).toBe("legendary");
  });

  it("refuses a charm you can't afford, or one a fully set deck can't use", () => {
    const g = useGame.getState();
    g.setStartBalance(150);
    g.login("BRK");
    expect(g.startRound("stack", 130, "legendary")).toBe(false); // 130 + 13 + 52 > 150
    expect(useGame.getState().profiles.BRK.balance).toBe(150);
    g.setDeck(code(null, true));
    expect(g.startRound("stack", 50, "steady")).toBe(false);
    expect(g.startRound("stack", 50)).toBe(true);
  });

  it("new players start with 1,000 by default", () => {
    useGame.getState().login("abc");
    const p = useGame.getState().profiles.ABC;
    expect(p.balance).toBe(1000);
    expect(p.best).toBe(1000);
  });

  it("new players get the chosen starting chips, existing ones keep theirs", () => {
    useGame.getState().login("OLD");
    useGame.getState().setStartBalance(5000);
    useGame.getState().login("NEW");
    useGame.getState().login("OLD");
    const { profiles } = useGame.getState();
    expect(profiles.NEW.balance).toBe(5000);
    expect(profiles.NEW.best).toBe(5000);
    expect(profiles.OLD.balance).toBe(1000);
  });

  it("starting chips are kept within limits", () => {
    expect(START_LIMITS.min).toBe(10);
    expect(clampStart(5)).toBe(10);
    expect(clampStart(10)).toBe(10);
    expect(clampStart(9e9)).toBe(START_LIMITS.max);
    expect(clampStart(2500.4)).toBe(2500);
    expect(clampStart(NaN)).toBe(START_BALANCE);
  });

  it("reset deletes every player but keeps settings", () => {
    const g = useGame.getState();
    g.setStartBalance(2500);
    g.setTimers("blitz");
    g.login("AAA");
    g.login("BBB");
    g.startRound("stack", 100);
    useGame.getState().resetAll();
    const s = useGame.getState();
    expect(s.profiles).toEqual({});
    expect(s.active).toBeNull();
    expect(s.startBalance).toBe(2500);
    expect(s.timerPreset).toBe("blitz");
  });
});
