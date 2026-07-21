import {
  DEFAULT_BOARD_LAYOUT,
  mergeLayouts,
  withShippedWidgets,
  type LayoutItem,
} from "@artist/shared";

const item = (
  widgetType: LayoutItem["widgetType"],
  overrides: Partial<LayoutItem> = {},
): LayoutItem => ({ widgetType, x: 0, y: 0, w: 4, h: 3, ...overrides });

describe("mergeLayouts", () => {
  const defaults: LayoutItem[] = [
    item("TODOS"),
    item("MY_TASKS", { x: 4 }),
    item("SHOWS", { y: 3 }),
  ];

  it("returns the default layout when the user has no saved layout", () => {
    expect(mergeLayouts(defaults, null)).toEqual(defaults);
    expect(mergeLayouts(defaults, [])).toEqual(defaults);
  });

  it("prefers the user's saved position for a widget", () => {
    const user = [item("TODOS", { x: 8, y: 2, w: 6 })];
    const merged = mergeLayouts(defaults, user);
    expect(merged.find((i) => i.widgetType === "TODOS")).toEqual(user[0]);
  });

  it("appends widgets newly added to the default below the user's grid", () => {
    const user = [item("TODOS", { y: 0, h: 5 })];
    const merged = mergeLayouts(defaults, user);
    const appended = merged.filter((i) => i.widgetType !== "TODOS");
    expect(appended.every((i) => i.y >= 5)).toBe(true);
  });

  it("drops widgets removed from the default even if the user saved them", () => {
    const user = [item("CALENDAR", { x: 2 })];
    const merged = mergeLayouts(defaults, user);
    expect(merged.some((i) => i.widgetType === "CALENDAR")).toBe(false);
    expect(merged).toHaveLength(defaults.length);
  });

  it("keeps the user's hidden flag", () => {
    const user = [item("SHOWS", { hidden: true })];
    const merged = mergeLayouts(defaults, user);
    expect(merged.find((i) => i.widgetType === "SHOWS")?.hidden).toBe(true);
  });
});

describe("withShippedWidgets", () => {
  it("adds widgets shipped after the board stored its default", () => {
    const stored = [item("TODOS", { w: 8, h: 6 })];
    const merged = withShippedWidgets(stored);

    expect(merged.map((i) => i.widgetType)).toEqual(
      DEFAULT_BOARD_LAYOUT.map((i) => i.widgetType),
    );
  });

  it("keeps the admin's stored position and hidden flag", () => {
    const stored = [item("TODOS", { x: 3, y: 7, w: 6, h: 2, hidden: true })];
    const merged = withShippedWidgets(stored);

    expect(merged.find((i) => i.widgetType === "TODOS")).toEqual(stored[0]);
  });

  it("falls back to the shipped layout for a board with no stored default", () => {
    expect(withShippedWidgets(null)).toEqual(DEFAULT_BOARD_LAYOUT);
    expect(withShippedWidgets([])).toEqual(DEFAULT_BOARD_LAYOUT);
  });
});
