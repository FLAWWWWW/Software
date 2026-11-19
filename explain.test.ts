import { describe, it, expect } from "vitest";
import { checkAvailability, ROOM } from "../src/lib/availability";
import { explainAvailability, mockAdapter, toInput, validateInput, validateOutput, Adapter } from "../src/lib/explain";
const NOW = 480;
const avail = checkAvailability(ROOM, { start: 600, end: 660 }, NOW);       // 10:00-11:00
const overlap = checkAvailability(ROOM, { start: 570, end: 660 }, NOW);     // 09:30-11:00
const run = (r: any, a: Adapter, ms?: number) => explainAvailability(r, a, ms);

describe("AC2 explanation agrees with decision", () => {
  it("T10 mock, available", async () => { const o = await run(avail, mockAdapter); expect(o.source).toBe("generated"); expect(o.explanation).toContain("is available"); });
  it("T11 mock, overlap", async () => { const o = await run(overlap, mockAdapter); expect(o.explanation).toContain("not available"); expect(o.explanation).toContain("overlaps"); });
  it("T12 model says 'available' for an unavailable result -> rejected, fallback", async () => {
    const o = await run(overlap, async () => ({ explanation: "Good news, the room is available." }));
    expect(o.source).toBe("fallback"); expect(o.explanation).toMatch(/^Not available/);
  });
  it("T13 model invents a time -> rejected", async () => {
    const o = await run(avail, async () => ({ explanation: "The room is available, but someone booked it at 12:15." }));
    expect(o.source).toBe("fallback");
  });
});
describe("AC3 input validation", () => {
  const ok = toInput(avail);
  it("T14 empty input rejected", () => expect(validateInput(null)).not.toBeNull());
  it("T15 empty label rejected", () => expect(validateInput({ ...ok, roomLabel: "  " })).not.toBeNull());
  it("T16 too long label rejected", () => expect(validateInput({ ...ok, roomLabel: "A".repeat(500) })).toMatch(/too long/));
  it("T17 malformed time rejected", () => expect(validateInput({ ...ok, start: "9am" })).toMatch(/HH:MM/));
  it("T18 status/reason mismatch rejected", () => expect(validateInput({ ...ok, isAvailable: false })).toMatch(/disagree/));
});
describe("AC4 failures produce a safe fallback", () => {
  it("T19 timeout", async () => { const o = await run(avail, () => new Promise(() => {}), 50); expect(o).toMatchObject({ source: "fallback", error: "Timeout" }); });
  it("T20 API error", async () => { const o = await run(avail, async () => { throw new Error("API error 500"); }); expect(o.source).toBe("fallback"); });
  it("T21 missing key", async () => { const o = await run(avail, async () => { throw new Error("API key unavailable"); }); expect(o.error).toBe("API key unavailable"); });
  it("T22 malformed output", async () => { const o = await run(avail, async () => "oops"); expect(o.source).toBe("fallback"); });
  it("T23 three sentences rejected", async () => { const o = await run(avail, async () => ({ explanation: "It is available. Yes. Really." })); expect(o.source).toBe("fallback"); });
});
describe("Safety", () => {
  it("T24 prompt injection in output (link/markup) rejected", async () => {
    const o = await run(avail, async () => ({ explanation: "The room is available. <script>x</script>" })); expect(o.source).toBe("fallback"); });
  it("T25 explanation never changes the deterministic result", async () => {
    const before = JSON.stringify(overlap); await run(overlap, async () => ({ explanation: "The room is available." }));
    expect(JSON.stringify(overlap)).toBe(before); expect(overlap.isAvailable).toBe(false); });
});

describe("Regression tests after agentic review (F1, F3, F4)", () => {
  it("T26 F4: model claims 'booking confirmed' -> rejected (AC5)", async () => {
    const o = await run(avail, async () => ({ explanation: "Your booking is confirmed." })); expect(o.source).toBe("fallback"); });
  it("T27 F3: contradictory text (not available + is available) -> rejected (AC2)", async () => {
    const o = await run(overlap, async () => ({ explanation: "Not available because of overlap, but the room is available." })); expect(o.source).toBe("fallback"); });
  it("T28 F1: NaN time -> clean message, LLM not called", async () => {
    let called = false; const o = await run(checkAvailability(ROOM, { start: NaN, end: 660 }, NOW), async () => { called = true; return {}; });
    expect(called).toBe(false); expect(o.explanation).not.toContain("NaN"); expect(o.source).toBe("fallback"); });
  it("T29 F1: end 25:00 -> clean message, LLM not called", async () => {
    let called = false; const o = await run(checkAvailability(ROOM, { start: 600, end: 1500 }, NOW), async () => { called = true; return {}; });
    expect(called).toBe(false); expect(o.explanation).not.toContain("25:00"); });
});
