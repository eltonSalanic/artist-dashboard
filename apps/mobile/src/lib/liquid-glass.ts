import { Platform } from 'react-native';

/**
 * Whether the system draws its chrome in Liquid Glass: iOS 26 and later.
 *
 * Apple keeps glass to the navigation layer (bars, toolbar buttons, sheets) and
 * draws it there itself, so this gates *native* treatments only: bar items made
 * by the system rather than drawn by us, and sheets left see-through for the
 * system's glass. Cards and lists stay solid either way. Reduce Transparency is
 * the system's to honour on its own glass, so it needs no check here.
 */
export const LIQUID_GLASS =
  process.env.EXPO_OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;

/**
 * A sheet screen's own background: on iOS 26 the page colour laid over the
 * system's glass at 80%, everywhere else the page colour itself.
 *
 * Clear glass let the band's wall show through so strongly that a coral or
 * lime card under the sheet fought the grey second lines of its rows. Tinted
 * like this the sheet keeps the glass's edge, inset and light, and reads as the
 * cream page it opened from. Expects a `#rrggbb` colour, as the theme's are.
 */
export function sheetBackground(page: string): string {
  return LIQUID_GLASS ? `${page}cc` : page;
}
