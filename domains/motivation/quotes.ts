/**
 * A small, hand-vetted bank of real, attributed quotes for the weekly
 * motto (domains/review/brief-schema.ts `weeklyMottoId`). The AI picks an
 * `id` from this list — it never generates or recalls a quote freely — so
 * a fabricated or misattributed quote is structurally impossible to reach
 * the UI (the forced-tool-use schema only accepts ids that exist here).
 *
 * Kept intentionally short: every entry is a single, well-documented line
 * from a clearly known primary source (a book, speech, or interview), not
 * an internet "commonly attributed to" quote. Extend carefully — verify a
 * new entry's source before adding it, not just its popularity.
 */
export type MotivationQuote = {
  id: string;
  quote: string;
  author: string;
  themes: string[];
};

export const MOTIVATION_QUOTES: MotivationQuote[] = [
  {
    id: "roosevelt_dare",
    quote: "It is hard to fail, but it is worse never to have tried to succeed.",
    author: "Theodore Roosevelt",
    themes: ["perseverance", "courage", "starting"],
  },
  {
    id: "curie_understood",
    quote: "Nothing in life is to be feared, it is only to be understood.",
    author: "Marie Curie",
    themes: ["learning", "focus", "resilience"],
  },
  {
    id: "keller_overcoming",
    quote: "Although the world is full of suffering, it is also full of the overcoming of it.",
    author: "Helen Keller",
    themes: ["resilience", "health", "perseverance"],
  },
  {
    id: "keller_character",
    quote:
      "Character cannot be developed in ease and quiet. Only through experience of trial and suffering can the soul be strengthened.",
    author: "Helen Keller",
    themes: ["discipline", "resilience", "self-improvement"],
  },
  {
    id: "washington_obstacles",
    quote:
      "Success is to be measured not so much by the position that one has reached in life as by the obstacles which he has overcome.",
    author: "Booker T. Washington",
    themes: ["perseverance", "self-improvement", "resilience"],
  },
  {
    id: "earhart_decision",
    quote: "The most difficult thing is the decision to act, the rest is merely tenacity.",
    author: "Amelia Earhart",
    themes: ["starting", "discipline", "focus"],
  },
  {
    id: "confucius_slowly",
    quote: "It does not matter how slowly you go as long as you do not stop.",
    author: "Confucius",
    themes: ["consistency", "patience", "perseverance"],
  },
  {
    id: "aurelius_power",
    quote: "You have power over your mind — not outside events. Realize this, and you will find strength.",
    author: "Marcus Aurelius",
    themes: ["focus", "resilience", "discipline"],
  },
  {
    id: "epictetus_react",
    quote: "It's not what happens to you, but how you react to it that matters.",
    author: "Epictetus",
    themes: ["resilience", "focus", "patience"],
  },
  {
    id: "angelou_reduced",
    quote:
      "You may not control all the events that happen to you, but you can decide not to be reduced by them.",
    author: "Maya Angelou",
    themes: ["resilience", "self-improvement", "health"],
  },
  {
    id: "e_roosevelt_thing",
    quote: "You must do the thing you think you cannot do.",
    author: "Eleanor Roosevelt",
    themes: ["courage", "starting", "self-improvement"],
  },
  {
    id: "douglass_struggle",
    quote: "If there is no struggle, there is no progress.",
    author: "Frederick Douglass",
    themes: ["discipline", "perseverance", "consistency"],
  },
  {
    id: "rudolph_dreams",
    quote: "Never underestimate the power of dreams and the influence of the human spirit.",
    author: "Wilma Rudolph",
    themes: ["motivation", "health", "resilience"],
  },
  {
    id: "addams_action",
    quote: "Action indeed is the sole medium of expression for ethics.",
    author: "Jane Addams",
    themes: ["starting", "focus", "discipline"],
  },
];

export const MOTIVATION_QUOTE_IDS = MOTIVATION_QUOTES.map((q) => q.id) as [string, ...string[]];

export function getMotivationQuote(id: string): MotivationQuote | null {
  return MOTIVATION_QUOTES.find((q) => q.id === id) ?? null;
}
