/**
 * Copy for the review-day push. The push leads with the brief's
 * highest-leverage action -- the one specific sentence this week's
 * rewrite hangs on -- rather than "your review is ready", so the
 * lock screen already carries the week-one bet (docs/persona.md).
 */
export const REVIEW_PUSH_TITLE = "Your week, rewritten";
export const REVIEW_PUSH_FALLBACK_BODY = "See what changed for next week and why.";
export const REVIEW_PUSH_BODY_MAX = 140;

/** The action without its bold/italic markers, short enough for a lock
 * screen; the generic line only when a brief somehow has none. */
export function reviewPushBody(action: string | null | undefined): string {
  const plain = (action ?? "").replace(/\*\*|__|\*|_/g, "").replace(/\s+/g, " ").trim();
  if (!plain) return REVIEW_PUSH_FALLBACK_BODY;
  if (plain.length <= REVIEW_PUSH_BODY_MAX) return plain;
  const cut = plain.slice(0, REVIEW_PUSH_BODY_MAX - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : cut.length)}…`;
}
