export const AUTH_CHANGE_EVENT = "sk:auth-change";

/** Lets client providers (e.g. the wishlist) react to sign-in/out without a full page reload. */
export function announceAuthChange(kind: "login" | "logout"): void {
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT, { detail: kind }));
}
