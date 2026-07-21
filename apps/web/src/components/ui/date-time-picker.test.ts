import {
  monthGrid,
  parseValue,
  serialize,
  timeRows,
} from "./date-time-picker";

describe("parseValue", () => {
  it("reads a date-only value as local midnight", () => {
    const parsed = parseValue("2026-07-21");
    expect(parsed).toEqual(new Date(2026, 6, 21, 0, 0));
  });

  it("reads a datetime value as local wall time", () => {
    expect(parseValue("2026-07-21T21:30")).toEqual(new Date(2026, 6, 21, 21, 30));
  });

  it("returns null for an unset or malformed value", () => {
    expect(parseValue("")).toBeNull();
    expect(parseValue("tomorrow")).toBeNull();
  });
});

describe("serialize", () => {
  it("round-trips through parseValue in both modes", () => {
    expect(serialize(parseValue("2026-07-21")!, "date")).toBe("2026-07-21");
    expect(serialize(parseValue("2026-01-05T09:05")!, "datetime")).toBe(
      "2026-01-05T09:05",
    );
  });

  it("drops the time in date mode", () => {
    expect(serialize(new Date(2026, 6, 21, 21, 30), "date")).toBe("2026-07-21");
  });
});

describe("monthGrid", () => {
  it("always returns 42 cells starting on a Sunday", () => {
    const cells = monthGrid(new Date(2026, 6, 1));
    expect(cells).toHaveLength(42);
    expect(cells[0].getDay()).toBe(0);
  });

  it("spills into the adjacent months", () => {
    // Jul 2026 starts on a Wednesday, so the grid opens on Jun 28.
    const cells = monthGrid(new Date(2026, 6, 1));
    expect(cells[0]).toEqual(new Date(2026, 5, 28));
    expect(cells[41]).toEqual(new Date(2026, 7, 8));
  });
});

describe("timeRows", () => {
  it("covers the day at the requested step", () => {
    const rows = timeRows(15, null);
    expect(rows).toHaveLength(96);
    expect(rows[0]).toBe(0);
    expect(rows.at(-1)).toBe(23 * 60 + 45);
  });

  it("folds in a selection that falls between steps", () => {
    const rows = timeRows(15, new Date(2026, 6, 21, 9, 7));
    expect(rows).toContain(9 * 60 + 7);
    expect(rows.indexOf(9 * 60 + 7)).toBe(rows.indexOf(9 * 60) + 1);
  });
});
