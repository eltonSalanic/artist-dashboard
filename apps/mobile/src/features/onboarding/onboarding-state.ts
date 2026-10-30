import AsyncStorage from '@react-native-async-storage/async-storage';
import { BoardPalettes, type BoardPalette } from '@artist/shared';
import { reportError } from '@/lib/report-error';

/**
 * What the person came in to do, set on the welcome screens just before the
 * session lands. Signing in swaps the whole stack, so the signed-in screens
 * read it to carry on: "signup" numbers the band step 2 of 3, "joined" opens
 * the welcome to the band they were invited to. In memory only: a cold start
 * later is no longer the first run.
 */
export type OnboardingIntent = 'signup' | 'joined';

let intent: OnboardingIntent | null = null;

export const setOnboardingIntent = (next: OnboardingIntent | null) => {
  intent = next;
};
export const onboardingIntent = () => intent;
/** Reads the intent once: the welcome it opens is shown a single time. */
export const takeOnboardingIntent = () => {
  const taken = intent;
  intent = null;
  return taken;
};

/**
 * The band being named before it is paid for. The API only creates a band for
 * a subscriber, so the name and colour wait on the phone until the purchase
 * is confirmed, and survive the paywall being closed or the app being quit.
 */
export interface BandDraft {
  name: string;
  palette: BoardPalette;
}

const DRAFT_KEY = 'artist.onboarding.bandDraft';

export async function loadBandDraft(): Promise<BandDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<BandDraft>;
    if (typeof draft.name !== 'string') return null;
    return {
      name: draft.name,
      palette: BoardPalettes.includes(draft.palette as BoardPalette)
        ? (draft.palette as BoardPalette)
        : 'playful',
    };
  } catch (error) {
    reportError(error, { where: 'onboarding.loadDraft' });
    return null;
  }
}

export function saveBandDraft(draft: BandDraft) {
  AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(draft)).catch((error: unknown) =>
    reportError(error, { where: 'onboarding.saveDraft' }),
  );
}

export function clearBandDraft() {
  AsyncStorage.removeItem(DRAFT_KEY).catch((error: unknown) =>
    reportError(error, { where: 'onboarding.clearDraft' }),
  );
}

const dismissKey = (boardId: string) => `artist.onboarding.setupDismissed.${boardId}`;

/** Whether the owner closed the hub's setup checklist for this band. */
export async function setupDismissed(boardId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(dismissKey(boardId))) === '1';
  } catch {
    return false;
  }
}

export function dismissSetup(boardId: string) {
  AsyncStorage.setItem(dismissKey(boardId), '1').catch((error: unknown) =>
    reportError(error, { where: 'onboarding.dismissSetup' }),
  );
}
