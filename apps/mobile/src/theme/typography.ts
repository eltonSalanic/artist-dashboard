import type { TextStyle } from 'react-native';

/**
 * Named text styles mirroring Apple's ramp, so sizes feel native rather than
 * invented. The system font is deliberate: no font files are bundled, so text
 * renders in San Francisco or Roboto. That means mobile does not match the web
 * app's typeface — the native face is worth more here than the match.
 *
 * **No colour in this file.** The palette is a light/dark pair read through a
 * hook, so a static style object cannot know it; `ThemedText` applies tone at
 * render time. Baking a colour in here would quietly pin every label to one
 * scheme.
 */
export const type = {
  largeTitle: { fontSize: 34, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: '600', letterSpacing: -0.2 },
  headline: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17, fontWeight: '400' },
  subhead: { fontSize: 15, fontWeight: '400' },
  footnote: { fontSize: 13, fontWeight: '400' },
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;
