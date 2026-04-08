// =============================================================================
// Anonymous auth helpers — localStorage persistence for the anon session.
//
// We store the anonymous user_id in localStorage (not sessionStorage) so it
// survives page refreshes. Supabase also persists the anon JWT in localStorage,
// so both stay in sync across tabs.
//
// The banner-shown flag is keyed to the anonymous user_id so that:
//   • A new anonymous session always shows the banner on first tingle.
//   • Dismissing it once suppresses it for the lifetime of that anon session.
// =============================================================================

const ANON_USER_ID_KEY = "@tingle/anon_user_id";
const BANNER_SHOWN_PREFIX = "@tingle/banner_shown/";

// ---- Anonymous user ID ------------------------------------------------------

export function saveAnonUserId(id: string): void {
  try {
    localStorage.setItem(ANON_USER_ID_KEY, id);
  } catch {
    // Private browsing or storage quota — silent fail
  }
}

export function getStoredAnonUserId(): string | null {
  try {
    return localStorage.getItem(ANON_USER_ID_KEY);
  } catch {
    return null;
  }
}

export function clearStoredAnonUserId(): void {
  try {
    localStorage.removeItem(ANON_USER_ID_KEY);
  } catch {
    // ignore
  }
}

// ---- Banner shown flag -------------------------------------------------------

/** Mark that the guest banner has been shown for this anonymous session. */
export function markBannerShown(anonUserId: string): void {
  try {
    localStorage.setItem(`${BANNER_SHOWN_PREFIX}${anonUserId}`, "1");
  } catch {
    // ignore
  }
}

/** Returns true if the banner has already been shown for this anon session. */
export function hasBannerBeenShown(anonUserId: string): boolean {
  try {
    return localStorage.getItem(`${BANNER_SHOWN_PREFIX}${anonUserId}`) === "1";
  } catch {
    return false;
  }
}

/** Clean up banner flag after account is linked (no longer anonymous). */
export function clearBannerFlag(anonUserId: string): void {
  try {
    localStorage.removeItem(`${BANNER_SHOWN_PREFIX}${anonUserId}`);
  } catch {
    // ignore
  }
}
