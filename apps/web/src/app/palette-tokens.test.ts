import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BOARD_PALETTE_COLORS,
  BRAND_ACCENTS,
  BoardPalettes,
  SLOT_ALPHAS,
  SURFACE_TOKENS,
  WidgetColors,
  oklchCss,
  type ColorScheme,
  type Oklch,
  type PaletteSlot,
} from "@artist/shared";

/**
 * `globals.css` renders the web app; `packages/shared/src/palettes.ts` renders
 * the mobile app. The same colours are written in both, because generating the
 * stylesheet from the package would mean rewriting a hand-tuned file, and a
 * mobile phase has no business doing that.
 *
 * This is what makes the duplication safe: edit either side and the mismatch is
 * named here. It is also what would make generating the CSS a safe follow-up,
 * since it pins the current output exactly.
 */

// Comments are stripped first: the declarations are parsed by splitting on
// `;`, and a comment sitting between two declarations otherwise gets glued to
// the front of the next property name.
const css = readFileSync(join(__dirname, "globals.css"), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Declarations inside the first rule with this exact selector. */
function block(selector: string): Record<string, string> {
  const start = css.indexOf(`${selector} {`);
  if (start === -1) throw new Error(`No rule for \`${selector}\` in globals.css`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const body = css.slice(open + 1, close);

  const out: Record<string, string> = {};
  for (const line of body.split(";")) {
    const [prop, ...rest] = line.split(":");
    if (rest.length === 0) continue;
    const name = prop.trim();
    if (!name.startsWith("--")) continue;
    out[name] = normalize(rest.join(":"));
  }
  return out;
}

/**
 * Makes a CSS value comparable to `oklchCss` output: collapse whitespace, and
 * turn a percentage alpha into the decimal the package writes. `12%` and `0.12`
 * are the same colour and the test should not care which spelling is in the
 * file.
 */
function normalize(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\/\s*([\d.]+)%/, (_m, pct: string) => `/ ${Number(pct) / 100}`);
}

/** `cardForeground` → `--card-foreground`. */
function custom(token: string): string {
  return `--${token.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
}

const schemes: { scheme: ColorScheme; selector: string }[] = [
  { scheme: "light", selector: ":root" },
  { scheme: "dark", selector: ".dark" },
];

describe("surface tokens match the shared package", () => {
  for (const { scheme, selector } of schemes) {
    describe(`${scheme} (${selector})`, () => {
      const declared = block(selector);

      for (const [token, value] of Object.entries(SURFACE_TOKENS[scheme])) {
        it(`${custom(token)}`, () => {
          expect(declared[custom(token)]).toBe(oklchCss(value as Oklch));
        });
      }
    });
  }
});

describe("brand accents match the shared package", () => {
  for (const { scheme, selector } of schemes) {
    describe(`${scheme} (${selector})`, () => {
      const declared = block(selector);

      for (const [name, pair] of Object.entries(BRAND_ACCENTS[scheme])) {
        it(`--${name}`, () => {
          expect(declared[`--${name}`]).toBe(oklchCss(pair.bg));
          expect(declared[`--${name}-foreground`]).toBe(oklchCss(pair.fg));
        });
      }
    });
  }
});

describe("board palettes match the shared package", () => {
  const slots = WidgetColors.filter(
    (c): c is PaletteSlot => c !== "base",
  );

  // `playful` points its slots at the brand accents instead of restating them,
  // so it tracks their light/dark tuning. The accents themselves are checked
  // above; here it is the aliasing that matters.
  it("playful aliases the brand accents rather than repeating values", () => {
    const declared = block('[data-palette="playful"]');
    const expected = ["coral", "lilac", "lime", "ink"];
    slots.forEach((slot, i) => {
      const n = slot.slice(1);
      expect(declared[`--wc-${n}`]).toBe(`var(--${expected[i]})`);
      expect(declared[`--wc-${n}-fg`]).toBe(`var(--${expected[i]}-foreground)`);
    });
  });

  for (const palette of BoardPalettes.filter((p) => p !== "playful")) {
    describe(palette, () => {
      const light = block(`[data-palette="${palette}"]`);
      const dark = block(`.dark [data-palette="${palette}"]`);

      for (const slot of slots) {
        const n = slot.slice(1);

        it(`${slot} light`, () => {
          const pair = BOARD_PALETTE_COLORS[palette].light[slot];
          expect(light[`--wc-${n}`]).toBe(oklchCss(pair.bg));
          expect(light[`--wc-${n}-fg`]).toBe(oklchCss(pair.fg));
        });

        it(`${slot} dark overrides the card and inherits the text colour`, () => {
          const pair = BOARD_PALETTE_COLORS[palette].dark[slot];
          expect(dark[`--wc-${n}`]).toBe(oklchCss(pair.bg));
          // The dark rule deliberately does not restate `-fg`: the text colour
          // is the same in both schemes, so the package's dark foreground must
          // equal its light one or mobile would diverge from the cascade.
          expect(dark[`--wc-${n}-fg`]).toBeUndefined();
          expect(pair.fg).toEqual(BOARD_PALETTE_COLORS[palette].light[slot].fg);
        });
      }
    });
  }
});

describe("the coloured-card formula matches the shared alphas", () => {
  const declared = block('[data-wc]:not([data-wc="base"])');

  // CSS mixes the foreground with `transparent`, which is the same thing as the
  // foreground at that alpha — which is what `slotTokens` computes.
  const mixed = (token: string): number => {
    const value = declared[custom(token)];
    const match = /color-mix\(in oklab, var\(--wc-fg\) ([\d.]+)%, transparent\)/.exec(
      value ?? "",
    );
    if (!match) throw new Error(`${custom(token)} is not a color-mix: ${value}`);
    return Number(match[1]) / 100;
  };

  for (const [token, alpha] of Object.entries(SLOT_ALPHAS)) {
    it(`${custom(token)} is the foreground at ${alpha * 100}%`, () => {
      expect(mixed(token)).toBeCloseTo(alpha, 10);
    });
  }

  it("re-points the solid tokens to the slot's own pair", () => {
    expect(declared["--card"]).toBe("var(--wc)");
    expect(declared["--card-foreground"]).toBe("var(--wc-fg)");
    expect(declared["--foreground"]).toBe("var(--wc-fg)");
    expect(declared["--primary"]).toBe("var(--wc-fg)");
    expect(declared["--primary-foreground"]).toBe("var(--wc)");
  });

  it("covers every token the shared formula overrides, and no more", () => {
    // If the CSS grows an override the package does not know about, a coloured
    // card looks different on the two platforms. This is the box that notices.
    expect(Object.keys(declared).sort()).toEqual(
      [
        "--accent",
        "--accent-foreground",
        "--border",
        "--card",
        "--card-foreground",
        "--foreground",
        "--input",
        "--muted",
        "--muted-foreground",
        "--primary",
        "--primary-foreground",
        "--ring",
        "--secondary",
        "--secondary-foreground",
      ].sort(),
    );
  });
});
