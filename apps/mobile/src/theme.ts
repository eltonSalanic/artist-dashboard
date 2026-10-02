import { useColorScheme } from 'react-native';

/**
 * A placeholder palette, not the design system.
 *
 * **P6 owns the real token layer**, and it has more to do than the plan
 * assumed: `packages/shared/src/theme.ts` holds palette *metadata* only — the
 * actual colours live in `apps/web/src/app/globals.css` under
 * `[data-palette="…"]`, which Metro cannot read. Making board palettes match
 * across platforms means lifting those values out of CSS into
 * `packages/shared` first.
 *
 * Until then: just enough neutral colour for two screens to look deliberate in
 * light and dark, with no board palette involved.
 */
export interface Palette {
  background: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  danger: string;
  onAccent: string;
}

const palettes: Record<'light' | 'dark', Palette> = {
  light: {
    background: '#ffffff',
    card: '#f4f4f5',
    border: '#e4e4e7',
    text: '#09090b',
    muted: '#71717a',
    accent: '#208aef',
    danger: '#b91c1c',
    onAccent: '#ffffff',
  },
  dark: {
    background: '#09090b',
    card: '#18181b',
    border: '#27272a',
    text: '#fafafa',
    muted: '#a1a1aa',
    accent: '#4aa3ff',
    danger: '#f87171',
    onAccent: '#09090b',
  },
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? palettes.dark : palettes.light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = { md: 10, lg: 16 } as const;
