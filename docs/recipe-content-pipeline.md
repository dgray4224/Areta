# Recipe content pipeline

How to add new `recipes` content over time (see
docs/training-content-pipeline.md for the sibling pipeline this mirrors,
covering `training_programs` instead).

## When to invoke

Trigger phrases that mean "run this procedure":
- "Add more recipes."
- "Expand the [cuisine] section of the meal library."
- "We need more [breakfast/lunch/dinner/snack] variety."

## How this differs from the training-content pipeline

The training-content pipeline's safety net is **source verification**:
every program prescription must cite a real, fetched URL from a
credentialed specialist (`verify-sources.ts`). That doesn't fit recipes —
a recipe isn't citing anyone's methodology — and there is deliberately
**no manual review gate** here either (an explicit product decision: no
one on this team has the nutrition expertise to review at the volume
needed, and requiring it would bottleneck the whole effort).

So this pipeline substitutes **computed consistency checks**
(`scripts/recipe-content/validate-spec.ts`) as its safety net instead:
- macro-math consistency (`calories ≈ 4·protein + 4·carbs + 9·fat`)
- meal-type-appropriate calorie ranges
- an allergen cross-check: every Big-9 allergen implied by an ingredient
  name (via `scripts/recipe-content/allergen-keywords.ts`'s keyword map)
  must be tagged in `allergens`
- a dietary-tag sanity check: a "vegetarian"/"vegan"/"gluten-free" tag
  can't be contradicted by an ingredient that obviously violates it

**Be honest about the trade-off this represents**: these checks catch
internal inconsistency, not real-world nutritional accuracy. They don't
independently verify a recipe's numbers against a certified nutrition
database. New recipes land as `status: 'active'` directly (no `'review'`
step) — accepted risk, not an oversight. A quick plausibility skim of a
sample of any new batch is still worth doing (see the Verification step
below) — the checks aren't a substitute for that, just for line-by-line
expert review.

## Step-by-step procedure

### a. Draft a `RecipeContentBatch`

Write a new `.ts` file (convention: `scripts/recipe-content/drafts/<label>.ts`,
not committed if it's a one-off) with a named export:

```ts
import type { RecipeContentBatch } from "@/domains/recipes/content-spec";

export const batch: RecipeContentBatch = {
  recipes: [
    {
      name: "Chicken Tikka Masala Bowl",
      mealType: "dinner",
      cuisine: "indian",
      calories: 520,
      proteinG: 42,
      carbsG: 38,
      fatG: 20,
      fiberG: 5,
      prepMinutes: 15,
      cookMinutes: 25,
      servings: 1,
      dietaryTags: ["gluten-free", "high-protein"],
      allergens: ["milk"],
      ingredients: [
        { name: "Chicken breast", quantity: 6, unit: "oz", section: "protein" },
        { name: "Greek yogurt", quantity: 0.25, unit: "cup", section: "dairy" },
        // ...
      ],
      instructions: ["Marinate chicken in yogurt and spices...", "..."],
      storageInstructions: "Keeps 3 days refrigerated.",
      // photoUrl omitted -- no photo-sourcing pipeline exists yet.
    },
    // ...
  ],
};
```

See `domains/recipes/schema.ts` for the full field list and
`domains/recipes/content-spec.ts` for the batch shape. `cuisine` must be
one of the 8 values in `RECIPE_CUISINES` (american, italian, mexican,
chinese, japanese, thai, indian, mediterranean) — see that file's comment
for the consumer-research sourcing behind that list. `allergens` must be
drawn from `RECIPE_ALLERGENS` (the FDA "Big 9").

Aim for a spread across meal types and dietary tags within each batch,
not just cuisine — a batch that's all `high-protein` dinners doesn't move
the needle on variety as much as one that also covers vegetarian/vegan/
gluten-free/quick options.

### b. Run the pipeline

```bash
pnpm run content:add-recipes -- --spec scripts/recipe-content/drafts/<label>.ts
```

This runs, in order, and stops at the first failure:
1. **`validate-spec.ts`** — structural checks (via
   `recipeContentBatchSchema`) plus the computed-consistency checks
   described above and name-uniqueness (in-batch and against the live
   `recipes` table).
2. **`generate-migration.ts`** — writes a new
   `supabase/migrations/<NNNN>_recipes_<label>_<yyyy_mm>.sql` file, one
   `INSERT` per recipe, every row `status = 'active'`.

Each step can also be run standalone with the same `--spec` flag for
debugging (e.g. `pnpm dlx tsx scripts/recipe-content/validate-spec.ts --spec <path>`).

### c. Apply and verify

```bash
pnpm dlx supabase db push --linked
```

Then spot-check a handful of the new recipes by hand for plausibility —
not a full review, just enough to catch anything the automated checks
structurally can't (a nonsensical ingredient combination, a wildly
unrealistic prep time). Re-run
`select count(*), status from public.recipes group by status;` against
the linked project to confirm the new total.
