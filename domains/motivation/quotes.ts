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
  {
    id: "laotzu_thousand_miles",
    quote: "The journey of a thousand miles begins with a single step.",
    author: "Lao Tzu",
    themes: ["starting", "patience", "consistency"],
  },
  {
    id: "seneca_waste",
    quote: "It is not that we have a short time to live, but that we waste a lot of it.",
    author: "Seneca",
    themes: ["focus", "starting", "discipline"],
  },
  {
    id: "seneca_begin_at_once",
    quote: "Begin at once to live, and count each separate day as a separate life.",
    author: "Seneca",
    themes: ["starting", "consistency", "discipline"],
  },
  {
    id: "aurelius_impediment",
    quote: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
    themes: ["resilience", "perseverance", "focus"],
  },
  {
    id: "aurelius_be_one",
    quote: "Waste no more time arguing what a good man should be. Be one.",
    author: "Marcus Aurelius",
    themes: ["starting", "discipline", "focus"],
  },
  {
    id: "epictetus_say_what_you_would_be",
    quote: "First say to yourself what you would be; and then do what you have to do.",
    author: "Epictetus",
    themes: ["starting", "discipline", "focus"],
  },
  {
    id: "epictetus_master_of_himself",
    quote: "No man is free who is not master of himself.",
    author: "Epictetus",
    themes: ["discipline", "self-improvement", "consistency"],
  },
  {
    id: "nietzsche_stronger",
    quote: "That which does not kill us makes us stronger.",
    author: "Friedrich Nietzsche",
    themes: ["resilience", "perseverance", "health"],
  },
  {
    id: "emerson_pace_of_nature",
    quote: "Adopt the pace of nature: her secret is patience.",
    author: "Ralph Waldo Emerson",
    themes: ["patience", "consistency", "focus"],
  },
  {
    id: "shakespeare_by_degrees",
    quote: "How poor are they that have not patience! What wound did ever heal but by degrees?",
    author: "William Shakespeare",
    themes: ["patience", "resilience", "health"],
  },
  {
    id: "milne_rivers",
    quote: "Rivers know this: there is no hurry. We shall get there some day.",
    author: "A. A. Milne",
    themes: ["patience", "consistency", "resilience"],
  },
  {
    id: "frost_way_out",
    quote: "The best way out is always through.",
    author: "Robert Frost",
    themes: ["perseverance", "resilience", "courage"],
  },
  {
    id: "franklin_well_done",
    quote: "Well done is better than well said.",
    author: "Benjamin Franklin",
    themes: ["starting", "discipline", "focus"],
  },
  {
    id: "franklin_energy_persistence",
    quote: "Energy and persistence conquer all things.",
    author: "Benjamin Franklin",
    themes: ["perseverance", "consistency", "discipline"],
  },
  {
    id: "edison_perspiration",
    quote: "Genius is one percent inspiration and ninety-nine percent perspiration.",
    author: "Thomas Edison",
    themes: ["discipline", "consistency", "perseverance"],
  },
  {
    id: "king_infinite_hope",
    quote: "We must accept finite disappointment, but never lose infinite hope.",
    author: "Martin Luther King Jr.",
    themes: ["resilience", "patience", "perseverance"],
  },
  {
    id: "king_keep_moving",
    quote:
      "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.",
    author: "Martin Luther King Jr.",
    themes: ["perseverance", "consistency", "resilience"],
  },
  {
    id: "gandhi_indomitable_will",
    quote: "Strength does not come from physical capacity. It comes from an indomitable will.",
    author: "Mahatma Gandhi",
    themes: ["resilience", "health", "discipline"],
  },
  {
    id: "gandhi_live_learn",
    quote: "Live as if you were to die tomorrow. Learn as if you were to live forever.",
    author: "Mahatma Gandhi",
    themes: ["learning", "starting", "consistency"],
  },
  {
    id: "angelou_know_better",
    quote: "Do the best you can until you know better. Then when you know better, do better.",
    author: "Maya Angelou",
    themes: ["self-improvement", "learning", "patience"],
  },
  {
    id: "angelou_nothing_works",
    quote: "Nothing will work unless you do.",
    author: "Maya Angelou",
    themes: ["discipline", "starting", "consistency"],
  },
  {
    id: "roosevelt_what_you_can",
    quote: "Do what you can, with what you have, where you are.",
    author: "Theodore Roosevelt",
    themes: ["starting", "resilience", "focus"],
  },
  {
    id: "king_bj_champions",
    quote: "Champions keep playing until they get it right.",
    author: "Billie Jean King",
    themes: ["perseverance", "consistency", "discipline"],
  },
  {
    id: "jordan_failed",
    quote: "I've failed over and over and over again in my life. And that is why I succeed.",
    author: "Michael Jordan",
    themes: ["resilience", "perseverance", "self-improvement"],
  },
  {
    id: "williams_recover",
    quote: "A champion is defined not by their wins but by how they can recover when they fall.",
    author: "Serena Williams",
    themes: ["resilience", "perseverance", "health"],
  },
  {
    id: "rohn_only_place",
    quote: "Take care of your body. It's the only place you have to live.",
    author: "Jim Rohn",
    themes: ["health", "discipline", "self-improvement"],
  },
  {
    id: "rohn_bridge",
    quote: "Discipline is the bridge between goals and accomplishment.",
    author: "Jim Rohn",
    themes: ["discipline", "consistency", "focus"],
  },
  {
    id: "washington_lift_up",
    quote: "If you want to lift yourself up, lift up someone else.",
    author: "Booker T. Washington",
    themes: ["self-improvement", "motivation", "starting"],
  },
  {
    id: "gretzky_shots",
    quote: "You miss 100 percent of the shots you don't take.",
    author: "Wayne Gretzky",
    themes: ["starting", "courage", "motivation"],
  },
  {
    id: "proverb_fall_seven",
    quote: "Fall seven times, stand up eight.",
    author: "Japanese proverb",
    themes: ["resilience", "perseverance", "consistency"],
  },
];

export const MOTIVATION_QUOTE_IDS = MOTIVATION_QUOTES.map((q) => q.id) as [string, ...string[]];

export function getMotivationQuote(id: string): MotivationQuote | null {
  return MOTIVATION_QUOTES.find((q) => q.id === id) ?? null;
}
