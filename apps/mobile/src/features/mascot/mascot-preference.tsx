import { createContext, use, useCallback, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { reportError } from '@/lib/report-error';

/**
 * Which mascot this phone shows: dez or bunz.
 *
 * Kept on the phone, like the selected board: it's a look, not account data,
 * and `AsyncStorage` rather than the keychain because it is no secret. Held in
 * context at the root, above the sign-in screens, so picking one on the You tab
 * swaps every mascot on screen at once.
 */
const STORAGE_KEY = 'artist.mascot';

export const MASCOTS = ['dez', 'bunz'] as const;
export type MascotChoice = (typeof MASCOTS)[number];
const DEFAULT: MascotChoice = 'dez';

const isMascot = (value: string | null): value is MascotChoice =>
  (MASCOTS as readonly (string | null)[]).includes(value);

interface MascotPreference {
  mascot: MascotChoice;
  setMascot: (mascot: MascotChoice) => void;
}

const MascotContext = createContext<MascotPreference | null>(null);

export function MascotProvider({ children }: { children: ReactNode }) {
  const [mascot, setStored] = useState<MascotChoice>(DEFAULT);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (mounted && isMascot(value)) setStored(value);
      })
      .catch((error: unknown) => {
        // A failed read just means the default mascot.
        reportError(error, { where: 'mascotPreference' });
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setMascot = useCallback((next: MascotChoice) => {
    setStored(next);
    void AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {
      // The choice still applies for this session; only the memory is lost.
    });
  }, []);

  return <MascotContext.Provider value={{ mascot, setMascot }}>{children}</MascotContext.Provider>;
}

/**
 * Outside the provider (the crash screen can render above it) this is dez,
 * with nothing to set.
 */
const FALLBACK: MascotPreference = { mascot: DEFAULT, setMascot: () => {} };

export function useMascot(): MascotPreference {
  return use(MascotContext) ?? FALLBACK;
}
