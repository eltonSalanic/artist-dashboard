import { BoardPalettes, type BoardPalette } from "@artist/shared";

/**
 * First-run state the web keeps in the browser. All of it is a convenience:
 * storage that throws (a private window) just means starting over.
 */

const SIGNED_UP_KEY = "band-wall.onboarding.signed-up";
const DRAFT_KEY = "band-wall.onboarding.band-draft";
const dismissKey = (boardId: string) =>
  `band-wall.onboarding.setup-dismissed.${boardId}`;

/** Set on sign-up, so the band step is numbered 2 of 3 rather than stand-alone. */
export function markSignedUp() {
  try {
    window.sessionStorage.setItem(SIGNED_UP_KEY, "1");
  } catch {
    // Storage unavailable (a private window): nothing to keep.
  }
}

export function justSignedUp(): boolean {
  try {
    return window.sessionStorage.getItem(SIGNED_UP_KEY) === "1";
  } catch {
    return false;
  }
}

function clearSignedUp() {
  try {
    window.sessionStorage.removeItem(SIGNED_UP_KEY);
  } catch {
    // Storage unavailable (a private window): nothing to keep.
  }
}

/**
 * The band named before it's paid for. The API only creates a band for a
 * subscriber, so the name and colour wait here through the checkout.
 */
export interface BandDraft {
  name: string;
  palette: BoardPalette;
}

export function loadBandDraft(): BandDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Partial<BandDraft>;
    if (typeof draft.name !== "string") return null;
    return {
      name: draft.name,
      palette: BoardPalettes.includes(draft.palette as BoardPalette)
        ? (draft.palette as BoardPalette)
        : "playful",
    };
  } catch {
    return null;
  }
}

export function saveBandDraft(draft: BandDraft) {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Storage unavailable (a private window): nothing to keep.
  }
}

/** The band exists now: forget the draft and the sign-up step numbering. */
export function finishBandDraft() {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage unavailable (a private window): nothing to keep.
  }
  clearSignedUp();
}

export function setupDismissed(boardId: string): boolean {
  try {
    return window.localStorage.getItem(dismissKey(boardId)) === "1";
  } catch {
    return false;
  }
}

export function dismissSetup(boardId: string) {
  try {
    window.localStorage.setItem(dismissKey(boardId), "1");
  } catch {
    // Storage unavailable (a private window): nothing to keep.
  }
}
