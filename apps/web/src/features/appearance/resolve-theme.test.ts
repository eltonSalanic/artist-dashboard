import {
  DEFAULT_BOARD_THEME,
  resolveBoardTheme,
  resolveWidgetColor,
  type BoardTheme,
} from "@artist/shared";

describe("resolveBoardTheme", () => {
  it("falls back to the default theme for an unset column", () => {
    expect(resolveBoardTheme({})).toEqual(DEFAULT_BOARD_THEME);
    expect(resolveBoardTheme(null)).toEqual(DEFAULT_BOARD_THEME);
    expect(resolveBoardTheme(undefined)).toEqual(DEFAULT_BOARD_THEME);
  });

  it("ignores non-object JSON instead of throwing", () => {
    expect(resolveBoardTheme("playful")).toEqual(DEFAULT_BOARD_THEME);
    expect(resolveBoardTheme([{ palette: "ocean" }])).toEqual(
      DEFAULT_BOARD_THEME,
    );
  });

  it("keeps a known palette and its widget assignments", () => {
    expect(
      resolveBoardTheme({ palette: "ocean", widgets: { FOCUS: "c3" } }),
    ).toEqual({ palette: "ocean", widgets: { FOCUS: "c3" } });
  });

  it("drops an unknown palette but keeps valid widget assignments", () => {
    expect(
      resolveBoardTheme({ palette: "neon", widgets: { GOALS: "c1" } }),
    ).toEqual({ palette: "playful", widgets: { GOALS: "c1" } });
  });

  it("drops unknown widget types and unknown slots", () => {
    expect(
      resolveBoardTheme({
        palette: "mono",
        widgets: { SHOWS: "c4", NOT_A_WIDGET: "c1", GOALS: "chartreuse" },
      }),
    ).toEqual({ palette: "mono", widgets: { SHOWS: "c4" } });
  });

  it("tolerates a malformed widgets value", () => {
    expect(resolveBoardTheme({ palette: "forest", widgets: "c1" })).toEqual({
      palette: "forest",
      widgets: {},
    });
  });
});

describe("resolveWidgetColor", () => {
  const theme: BoardTheme = { palette: "sunset", widgets: { FOCUS: "c2" } };

  it("prefers the board's explicit assignment over the registry default", () => {
    expect(resolveWidgetColor(theme, "FOCUS", "c1")).toBe("c2");
  });

  it("uses the registry default when the widget has no assignment", () => {
    expect(resolveWidgetColor(theme, "GOALS", "c3")).toBe("c3");
  });

  it("falls back to the neutral card with no assignment and no default", () => {
    expect(resolveWidgetColor(theme, "TODOS")).toBe("base");
  });

  it("honours an explicit 'base' assignment over a colored default", () => {
    const cleared: BoardTheme = { palette: "sunset", widgets: { FOCUS: "base" } };
    expect(resolveWidgetColor(cleared, "FOCUS", "c1")).toBe("base");
  });
});
