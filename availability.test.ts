import { describe, it, expect } from "vitest";
import { checkAvailability, ROOM } from "../src/lib/availability";
const NOW = 480; // 08:00
const t = (h: number, m = 0) => h * 60 + m;
describe("AC1 availability rules unchanged", () => {
  it("T01 free slot is available", () => expect(checkAvailability(ROOM, { start: t(10), end: t(11) }, NOW).reasonCode).toBe("AVAILABLE"));
  it("T02 overlap with 09:00-10:00", () => expect(checkAvailability(ROOM, { start: t(9, 30), end: t(11) }, NOW).reasonCode).toBe("OVERLAP"));
  it("T03 touching boundary is allowed", () => expect(checkAvailability(ROOM, { start: t(10), end: t(11) }, NOW).isAvailable).toBe(true));
  it("T04 blocked room", () => expect(checkAvailability({ ...ROOM, blocked: true }, { start: t(10), end: t(11) }, NOW).reasonCode).toBe("ROOM_BLOCKED"));
  it("T05 end before start is invalid", () => expect(checkAvailability(ROOM, { start: t(11), end: t(10) }, NOW).reasonCode).toBe("INVALID_TIME"));
  it("T06 past start", () => expect(checkAvailability(ROOM, { start: t(7), end: t(8) }, NOW).reasonCode).toBe("PAST_START"));
  it("T07 start equal to now is rejected", () => expect(checkAvailability(ROOM, { start: NOW, end: t(9) }, NOW).reasonCode).toBe("PAST_START"));
  it("T08 longer than 2 hours", () => expect(checkAvailability(ROOM, { start: t(14), end: t(17) }, NOW).reasonCode).toBe("TOO_LONG"));
  it("T09 NaN time is invalid", () => expect(checkAvailability(ROOM, { start: NaN, end: t(11) }, NOW).reasonCode).toBe("INVALID_TIME"));
});
