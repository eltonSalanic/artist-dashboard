import { formatDueDate } from "./task-bits";

describe("formatDueDate", () => {
  it("keeps the UTC calendar day (no local TZ shift)", () => {
    // UTC midnight of Jul 22 — in US timezones this is still Jul 21 locally.
    expect(formatDueDate("2026-07-22T00:00:00.000Z")).toBe(
      new Date("2026-07-22T00:00:00.000Z").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }),
    );
  });

  it("returns an em dash when missing", () => {
    expect(formatDueDate(null)).toBe("—");
  });
});
