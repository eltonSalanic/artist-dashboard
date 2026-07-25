import { WidgetTypes, type WidgetType } from './enums';

/** Predefined color themes a board can pick from. */
export const BoardPalettes = [
  'playful',
  'sunset',
  'ocean',
  'forest',
  'mono',
] as const;
export type BoardPalette = (typeof BoardPalettes)[number];

/**
 * Card color slots every palette fills. A widget stores which slot it paints
 * with, not a color — the palette decides what `c1`…`c4` actually look like.
 * `base` is the neutral card (the page's own card tokens, no re-point).
 */
export const WidgetColors = ['base', 'c1', 'c2', 'c3', 'c4'] as const;
export type WidgetColor = (typeof WidgetColors)[number];
export type PaletteSlot = Exclude<WidgetColor, 'base'>;

export interface BoardTheme {
  palette: BoardPalette;
  /** Per-widget slot override; absent means the widget's registry default. */
  widgets: Partial<Record<WidgetType, WidgetColor>>;
}

export const DEFAULT_BOARD_THEME: BoardTheme = {
  palette: 'playful',
  widgets: {},
};

export interface BoardPaletteInfo {
  id: BoardPalette;
  label: string;
  description: string;
  /** Display names for c1–c4, used for swatch labels. */
  slots: readonly { key: PaletteSlot; label: string }[];
}

/**
 * Palette metadata for the picker. Deliberately holds no color values: the
 * actual colors live in `globals.css` under `[data-palette="<id>"]`, so light
 * and dark variants stay in one place and swatches can preview themselves by
 * reading `var(--wc-1)` inside that scope.
 */
export const BOARD_PALETTES: readonly BoardPaletteInfo[] = [
  {
    id: 'playful',
    label: 'Playful Cards',
    description: 'The signature look — coral, lilac, lime and ink.',
    slots: [
      { key: 'c1', label: 'Coral' },
      { key: 'c2', label: 'Lilac' },
      { key: 'c3', label: 'Lime' },
      { key: 'c4', label: 'Ink' },
    ],
  },
  {
    id: 'sunset',
    label: 'Sunset',
    description: 'Late-set warmth: amber, rust, rose and plum.',
    slots: [
      { key: 'c1', label: 'Amber' },
      { key: 'c2', label: 'Rust' },
      { key: 'c3', label: 'Rose' },
      { key: 'c4', label: 'Plum' },
    ],
  },
  {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool and calm: teal, navy, seafoam and deep blue.',
    slots: [
      { key: 'c1', label: 'Teal' },
      { key: 'c2', label: 'Navy' },
      { key: 'c3', label: 'Seafoam' },
      { key: 'c4', label: 'Deep' },
    ],
  },
  {
    id: 'forest',
    label: 'Forest',
    description: 'Earthy and organic: moss, sage, clay and bark.',
    slots: [
      { key: 'c1', label: 'Moss' },
      { key: 'c2', label: 'Sage' },
      { key: 'c3', label: 'Clay' },
      { key: 'c4', label: 'Bark' },
    ],
  },
  {
    id: 'mono',
    label: 'Mono',
    description: 'No color at all — four steps of graphite.',
    slots: [
      { key: 'c1', label: 'Fog' },
      { key: 'c2', label: 'Slate' },
      { key: 'c3', label: 'Graphite' },
      { key: 'c4', label: 'Charcoal' },
    ],
  },
];

/**
 * Normalize whatever is in `Board.theme` into a full theme — the theming
 * counterpart to `withShippedWidgets`. The column starts out as `{}` and may
 * hold values written by an older (or newer) build, so anything unrecognized is
 * dropped rather than thrown: a board should never fail to render over a color.
 */
export function resolveBoardTheme(raw: unknown): BoardTheme {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return DEFAULT_BOARD_THEME;
  }
  const source = raw as { palette?: unknown; widgets?: unknown };
  const palette = isBoardPalette(source.palette)
    ? source.palette
    : DEFAULT_BOARD_THEME.palette;

  const widgets: BoardTheme['widgets'] = {};
  if (
    source.widgets &&
    typeof source.widgets === 'object' &&
    !Array.isArray(source.widgets)
  ) {
    for (const [key, value] of Object.entries(source.widgets)) {
      if (isWidgetType(key) && isWidgetColor(value)) widgets[key] = value;
    }
  }

  return { palette, widgets };
}

/** The slot a widget paints with: explicit override → registry default → base. */
export function resolveWidgetColor(
  theme: BoardTheme,
  widgetType: WidgetType,
  fallback: WidgetColor = 'base',
): WidgetColor {
  return theme.widgets[widgetType] ?? fallback;
}

function isBoardPalette(value: unknown): value is BoardPalette {
  return (
    typeof value === 'string' &&
    (BoardPalettes as readonly string[]).includes(value)
  );
}

function isWidgetType(value: unknown): value is WidgetType {
  return (
    typeof value === 'string' &&
    (WidgetTypes as readonly string[]).includes(value)
  );
}

function isWidgetColor(value: unknown): value is WidgetColor {
  return (
    typeof value === 'string' &&
    (WidgetColors as readonly string[]).includes(value)
  );
}
