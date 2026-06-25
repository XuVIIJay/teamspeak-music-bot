import { describe, it, expect } from "vitest";
import {
  decideOccupancyAction,
  occupancyFromClientList,
  shouldResumeOnReturn,
} from "./auto-pause.js";

describe("decideOccupancyAction", () => {
  it("pauses when empty while playing and enabled", () => {
    expect(decideOccupancyAction("playing", false, true, 0)).toBe("pause");
  });
  it("does not pause when the feature is disabled", () => {
    expect(decideOccupancyAction("playing", false, false, 0)).toBe("none");
  });
  it("does not pause when idle (nothing playing)", () => {
    expect(decideOccupancyAction("idle", false, true, 0)).toBe("none");
  });
  it("does not pause when already paused", () => {
    expect(decideOccupancyAction("paused", false, true, 0)).toBe("none");
  });
  it("resumes when re-populated and we auto-paused", () => {
    expect(decideOccupancyAction("paused", true, true, 2)).toBe("resume");
  });
  it("does NOT resume a user-paused track on re-population", () => {
    expect(decideOccupancyAction("paused", false, true, 2)).toBe("none");
  });
  it("does nothing when re-populated and already playing", () => {
    expect(decideOccupancyAction("playing", false, true, 2)).toBe("none");
  });
  it("resume is independent of the enabled flag (we already auto-paused)", () => {
    expect(decideOccupancyAction("paused", true, false, 1)).toBe("resume");
  });
});

describe("occupancyFromClientList", () => {
  it("returns null when the query failed (0 clients — bot itself is always present)", () => {
    // This is the bug fix: a clientlist timeout makes getClientsInChannel()
    // return [], which must be treated as "unknown", NOT as an empty channel.
    expect(occupancyFromClientList(0)).toBeNull();
  });
  it("returns 0 other users when only the bot is in the channel", () => {
    expect(occupancyFromClientList(1)).toBe(0);
  });
  it("excludes the bot itself from the count", () => {
    expect(occupancyFromClientList(2)).toBe(1);
    expect(occupancyFromClientList(5)).toBe(4);
  });
  it("never yields a negative count (guards the -1 that caused false pauses)", () => {
    expect(occupancyFromClientList(-3)).toBeNull();
  });
});

describe("shouldResumeOnReturn (event-driven auto-resume)", () => {
  it("resumes when we auto-paused and are still paused", () => {
    // The reported gap: someone returns after an auto-pause. clientlist can't
    // confirm it (it times out while they're present), so we resume from the
    // clientEnter event alone.
    expect(shouldResumeOnReturn(true, "paused")).toBe(true);
  });
  it("does NOT resume a track the user paused by hand", () => {
    expect(shouldResumeOnReturn(false, "paused")).toBe(false);
  });
  it("does nothing if already playing (e.g. the bot's own enter at connect)", () => {
    // autoPaused is cleared to false on connect, so the bot's own clientEnter
    // is a no-op; this also covers the playing/auto-paused-flag-stale case.
    expect(shouldResumeOnReturn(false, "playing")).toBe(false);
    expect(shouldResumeOnReturn(true, "playing")).toBe(false);
  });
  it("does nothing when idle (nothing to resume)", () => {
    expect(shouldResumeOnReturn(true, "idle")).toBe(false);
    expect(shouldResumeOnReturn(false, "idle")).toBe(false);
  });
});
