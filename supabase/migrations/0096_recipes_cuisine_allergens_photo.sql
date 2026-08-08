-- Meal-library expansion (24 -> ~260 recipes), phase 1: schema. Adds
-- cuisine + allergens so a much larger library is actually browsable/
-- filterable by customers, not just more rows an algorithm silently
-- rotates through (see docs/recipe-content-pipeline.md for the batch
-- content that follows this migration).
--
-- cuisine is constrained to the 8 cuisines Americans most commonly eat,
-- per NRA "Global Palates", YouGov, and Google search-volume data (French
-- and Middle Eastern were considered and dropped -- neither ranked as a
-- top cuisine in any source checked).
--
-- allergens is constrained to the FDA "Big 9" major food allergens, not
-- free text like dietary_tags -- this keeps it filterable and keeps the
-- recipe-content pipeline's allergen cross-check (scripts/recipe-content/
-- validate-spec.ts) meaningful: a fixed vocabulary is what makes "does
-- every allergenic ingredient have a matching tag" checkable at all.
--
-- photo_url is added now as a column only -- population is a separate,
-- not-yet-decided follow-up (needs an image-sourcing decision: AI
-- generation, a stock-photo API, or bundled per-cuisine placeholder art).
-- Nullable and unused until that decision is made.
alter table public.recipes
  add column cuisine text
    check (cuisine in ('american', 'italian', 'mexican', 'chinese', 'japanese', 'thai', 'indian', 'mediterranean')),
  add column allergens text[] not null default '{}'
    check (allergens <@ array['milk', 'eggs', 'fish', 'shellfish', 'tree_nuts', 'peanuts', 'wheat', 'soybeans', 'sesame']::text[]),
  add column photo_url text;

create index recipes_cuisine_idx on public.recipes (cuisine);

-- Backfill the original 24 seeded recipes (migration 0006) so every row
-- has a cuisine and, where applicable, allergens -- consistent with what
-- the content pipeline will require of every new row. Cuisine/allergen
-- values below were determined by reading each recipe's actual
-- ingredient list (same keyword-based reasoning the pipeline's own
-- allergen cross-check applies to new content), not guessed.
update public.recipes set cuisine = 'mexican' where name in ('Black Bean Tacos', 'Black Bean and Rice Bowl', 'Chicken Burrito Bowl');
update public.recipes set cuisine = 'chinese' where name in ('Beef and Broccoli', 'Chicken Stir Fry');
update public.recipes set cuisine = 'mediterranean' where name in ('Hummus and Veggies');
update public.recipes set cuisine = 'american' where cuisine is null;

update public.recipes set allergens = array['milk', 'wheat'] where name = 'Cottage Cheese Toast';
update public.recipes set allergens = array['milk'] where name = 'Greek Yogurt Parfait';
update public.recipes set allergens = array['milk', 'peanuts'] where name = 'Overnight Oats with Peanut Butter';
update public.recipes set allergens = array['tree_nuts', 'peanuts'] where name = 'Protein Smoothie';
update public.recipes set allergens = array['eggs'] where name in ('Turkey Sausage Breakfast Bowl', 'Veggie Egg Scramble', 'Hard-Boiled Eggs');
update public.recipes set allergens = array['fish'] where name in ('Baked Cod with Quinoa', 'Baked Salmon with Roasted Vegetables');
update public.recipes set allergens = array['soybeans'] where name in ('Beef and Broccoli', 'Chicken Stir Fry');
update public.recipes set allergens = array['milk'] where name in ('Chicken Burrito Bowl', 'Grilled Chicken Salad', 'Cottage Cheese with Pineapple', 'Greek Yogurt with Honey', 'Protein Shake');
update public.recipes set allergens = array['fish', 'milk', 'wheat'] where name = 'Tuna Salad Lettuce Wraps';
update public.recipes set allergens = array['wheat'] where name = 'Turkey and Avocado Wrap';
update public.recipes set allergens = array['tree_nuts'] where name = 'Apple with Almond Butter';
update public.recipes set allergens = array['sesame'] where name = 'Hummus and Veggies';
-- Black Bean Tacos, Turkey Chili, Black Bean and Rice Bowl, Lentil Soup:
-- no Big-9 allergen present in their ingredient lists -- left at the
-- column default '{}'.
