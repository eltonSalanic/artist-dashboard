import { buildMonthGrid, monthRange } from "./month-grid";
import type { CalendarItemDto } from "@/features/planning/types";

const item = (
  overrides: Partial<CalendarItemDto> & { date: string },
): CalendarItemDto => ({
  kind: "EVENT",
  id: "e1",
  title: "Gig",
  ...overrides,
});

describe("monthRange", () => {
  it("starts on the Sunday on or before the 1st", () => {
    // March 2026 starts on a Sunday, so the range starts on the 1st itself.
    const { from } = monthRange(2026, 2);
    expect(from.getDay()).toBe(0);
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(2);
  });

  it("backs up into the previous month when the 1st is mid-week", () => {
    // April 2026 starts on a Wednesday → range starts Sunday March 29.
    const { from } = monthRange(2026, 3);
    expect(from.getDay()).toBe(0);
    expect(from.getMonth()).toBe(2);
    expect(from.getDate()).toBe(29);
  });

  it("spans exactly 42 days", () => {
    const { from, to } = monthRange(2026, 3);
    const days = Math.round((to.getTime() - from.getTime()) / 86_400_000);
    expect(days).toBe(42);
  });
});

describe("buildMonthGrid", () => {
  it("always returns 42 cells", () => {
    expect(buildMonthGrid(2026, 3, []).length).toBe(42);
  });

  it("marks days outside the month as out-of-month", () => {
    const cells = buildMonthGrid(2026, 3, []); // April 2026
    expect(cells[0].inMonth).toBe(false); // March 29
    expect(cells[0].date.getDate()).toBe(29);
    expect(cells[3].inMonth).toBe(true); // April 1
    expect(cells[3].date.getDate()).toBe(1);
  });

  it("buckets items into their local day", () => {
    const items = [
      item({ id: "a", date: new Date(2026, 3, 10, 20, 0).toISOString() }),
      item({ id: "b", date: new Date(2026, 3, 10, 8, 0).toISOString() }),
      item({ id: "c", date: new Date(2026, 3, 11, 9, 0).toISOString() }),
    ];
    const cells = buildMonthGrid(2026, 3, items);

    const april10 = cells.find(
      (c) => c.inMonth && c.date.getDate() === 10,
    );
    const april11 = cells.find(
      (c) => c.inMonth && c.date.getDate() === 11,
    );
    expect(april10?.items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(april11?.items.map((i) => i.id)).toEqual(["c"]);
  });

  it("flags today only on the matching cell", () => {
    const today = new Date(2026, 3, 15);
    const cells = buildMonthGrid(2026, 3, [], today);
    const flagged = cells.filter((c) => c.isToday);

    expect(flagged).toHaveLength(1);
    expect(flagged[0].date.getDate()).toBe(15);
  });

  it("buckets date-only tasks/goals by UTC calendar day", () => {
    const cells = buildMonthGrid(2026, 6, [
      item({
        kind: "TASK",
        id: "t1",
        title: "Ship",
        // Jul 22 UTC midnight — local US evening of Jul 21
        date: "2026-07-22T00:00:00.000Z",
      }),
    ]);
    const jul22 = cells.find((c) => c.inMonth && c.date.getDate() === 22);
    const jul21 = cells.find((c) => c.inMonth && c.date.getDate() === 21);
    expect(jul22?.items.map((i) => i.id)).toEqual(["t1"]);
    expect(jul21?.items ?? []).toEqual([]);
  });

  it("drops items outside the visible range into no cell", () => {
    const cells = buildMonthGrid(2026, 3, [
      item({ id: "far", date: new Date(2026, 7, 1, 12, 0).toISOString() }),
    ]);
    expect(cells.every((c) => c.items.length === 0)).toBe(true);
  });
});
