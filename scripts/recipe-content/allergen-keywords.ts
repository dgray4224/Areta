import type { RecipeAllergen } from "@/domains/recipes/types";

/**
 * Keyword map used by validate-spec.ts's allergen cross-check: "does any
 * ingredient name in this recipe imply an allergen that isn't tagged."
 * Deliberately heuristic, not exhaustive -- this is a safety net that
 * substitutes for expert nutrition review (see docs/recipe-content-
 * pipeline.md), not a certified allergen database. Keywords lean toward
 * specific terms (e.g. "udon"/"ramen noodle" rather than a bare "noodle")
 * to avoid false-positiving on things like rice noodles in Thai recipes --
 * false negatives are still possible, which is why every generated recipe
 * is still worth a plausibility skim per the pipeline's verification step.
 */
export const ALLERGEN_KEYWORDS: Record<RecipeAllergen, string[]> = {
  milk: ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "ghee", "whey", "casein", "paneer"],
  eggs: ["egg"],
  fish: [
    "salmon",
    "cod",
    "tuna",
    "tilapia",
    "halibut",
    "trout",
    "anchov",
    "fish sauce",
    "bass",
    "mahi",
    "sardine",
    "fish fillet",
    "mackerel",
    "eel",
    "unagi",
    "yellowtail",
    "snapper",
    "branzino",
  ],
  shellfish: ["shrimp", "prawn", "crab", "lobster", "scallop", "clam", "mussel", "oyster", "squid", "calamari"],
  tree_nuts: ["almond", "walnut", "cashew", "pecan", "pistachio", "hazelnut", "macadamia", "brazil nut", "pine nut"],
  peanuts: ["peanut"],
  wheat: [
    "wheat",
    "flour",
    "bread",
    "tortilla",
    "pasta",
    "breadcrumb",
    "cracker",
    "pita",
    "naan",
    "couscous",
    "barley",
    "udon",
    "ramen noodle",
    "egg noodle",
    "soy sauce",
    "panko",
    "bulgur",
    "orzo",
    "semolina",
    "phyllo",
  ],
  soybeans: ["soy", "tofu", "edamame", "miso", "tempeh"],
  sesame: ["sesame", "tahini"],
};

/** Meat/poultry/fish/shellfish keywords used by the vegetarian/vegan
 * dietary-tag sanity check -- broader than the allergen fish/shellfish
 * lists above since e.g. "chicken" isn't a Big-9 allergen but is very
 * much not vegetarian. */
export const MEAT_KEYWORDS = [
  "chicken",
  "beef",
  "pork",
  "turkey",
  "lamb",
  "bacon",
  "sausage",
  "ham",
  "gelatin",
  "duck",
  "goat",
  ...ALLERGEN_KEYWORDS.fish,
  ...ALLERGEN_KEYWORDS.shellfish,
];

/** On top of MEAT_KEYWORDS, a vegan claim also excludes honey and any
 * dairy/egg ingredient (milk/eggs are fine for "vegetarian" but not
 * "vegan"). */
export const VEGAN_EXTRA_EXCLUDE_KEYWORDS = ["honey", ...ALLERGEN_KEYWORDS.milk, ...ALLERGEN_KEYWORDS.eggs];
