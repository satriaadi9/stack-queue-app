import { beforeEach, describe, expect, it } from "vitest";
import { clampStart, START_BALANCE, START_LIMITS, useGame } from "@/lib/store";

const fresh = useGame.getState();

describe("players on this device", () => {
  beforeEach(() => useGame.setState({ ...fresh, profiles: {}, active: null, startBalance: START_BALANCE }, true));

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
    expect(clampStart(5)).toBe(START_LIMITS.min);
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
