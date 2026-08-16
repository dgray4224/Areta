import type { RecipeDishType } from "@/domains/recipes/types";

/**
 * Display names for RECIPE_DISH_TYPES. Kept beside the vocabulary rather
 * than inline in each picker because three surfaces render these chips
 * (the trainer recipe form, the web meal picker, and mobile's own mirror
 * of this file), and a label drifting between them reads as two
 * different categories to the user.
 *
 * Deliberately plural and plain-spoken -- these are browse chips someone
 * scans while hungry, not taxonomy labels.
 */
export const DISH_TYPE_LABELS: Record<RecipeDishType, string> = {
  soup: "Soup",
  stew: "Stew",
  chili: "Chili",
  curry: "Curry",
  salad: "Salad",
  sandwich: "Sandwich",
  burger: "Burger",
  wrap: "Wrap",
  burrito: "Burrito",
  tacos: "Tacos",
  pizza: "Pizza",
  pasta: "Pasta",
  noodles: "Noodles",
  rice: "Rice",
  bowl: "Bowl",
  stir_fry: "Stir-fry",
  grilled: "Grilled",
  bbq: "BBQ",
  casserole: "Casserole",
  seafood: "Seafood",
  eggs: "Eggs",
  pancakes: "Pancakes",
  oatmeal: "Oatmeal",
  toast: "Toast",
  baked: "Baked",
  smoothie: "Smoothie",
  dip: "Dip",
  snack_bite: "Snacks",
};
