import type { RecipeContentBatch } from "@/domains/recipes/content-spec";

/**
 * Popularity expansion, final recipe (2026-08-16).
 *
 * Batch 4b's rice section came out at 13 rather than the planned 14,
 * leaving the expansion at 299. This is the missing one — kept as its own
 * file rather than edited into 4b, because 4b's generated migration was
 * already applied and its draft must keep matching what actually shipped.
 */
export const batch: RecipeContentBatch = {
  recipes: [
    {
      name: "Arroz con Pollo",
      mealType: "dinner",
      cuisine: "mexican",
      dishType: "rice",
      calories: 596,
      proteinG: 42,
      carbsG: 60,
      fatG: 20,
      fiberG: 7,
      prepMinutes: 20,
      cookMinutes: 40,
      servings: 1,
      dietaryTags: ["high-protein", "high-fiber"],
      allergens: [],
      ingredients: [
        { name: "Chicken thighs, bone-in", quantity: 6, unit: "oz", section: "protein" },
        { name: "Long-grain white rice", quantity: 0.66, unit: "cup", section: "grains" },
        { name: "Chicken broth", quantity: 1.25, unit: "cup", section: "pantry" },
        { name: "Yellow onion, diced", quantity: 0.5, unit: "each", section: "produce" },
        { name: "Red bell pepper, diced", quantity: 0.5, unit: "each", section: "produce" },
        { name: "Frozen peas", quantity: 0.33, unit: "cup", section: "produce" },
        { name: "Ground cumin", quantity: 1, unit: "tsp", section: "pantry" },
        { name: "Turmeric", quantity: 0.5, unit: "tsp", section: "pantry" },
        { name: "Garlic, minced", quantity: 3, unit: "clove", section: "produce" },
        { name: "Olive oil", quantity: 1, unit: "tbsp", section: "pantry" },
        { name: "Fresh cilantro", quantity: 3, unit: "tbsp", section: "produce" },
      ],
      instructions: [
        "Brown the chicken skin-side down until the skin is genuinely crisp, then remove. Everything after this cooks in that rendered fat.",
        "Soften the onion, pepper, and garlic in the fat, then add cumin and turmeric and cook 30 seconds.",
        "Stir in the dry rice and toast it 2 minutes so the grains stay separate.",
        "Add broth, nestle the chicken back on top skin-side up so it stays crisp above the liquid, cover, and cook 20 minutes on low.",
        "Scatter the peas over, replace the lid, and rest off the heat 10 minutes before fluffing. Do not stir during cooking.",
      ],
      storageInstructions: "Keeps 4 days; add a splash of broth when reheating.",
    },
  ],
};
