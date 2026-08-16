-- Crossover meal slots. `meal_type` stays the recipe's primary/default
-- slot; this is the list of OTHER slots it also fits.
--
-- Added because lunch and dinner are largely the same food, but the four
-- places that enforce meal_type (generation pooling, swap, assign, and the
-- picker API) treated it as a hard partition. Measured cost: a vegan
-- planning lunch could choose from 25 recipes when 48 were suitable;
-- gluten-free saw 38 of 79. Every one of the 261 dinners already sat
-- inside lunch's own plausible calorie band, so the split was a label,
-- not a nutritional guard.
--
-- Per-recipe rather than a blanket lunch/dinner merge, so a dish that
-- genuinely belongs to one slot (pancakes, an all-day braise) can say so.
alter table public.recipes
  add column also_suitable_for text[] not null default '{}';

-- Elements must be real meal types, and must never repeat meal_type --
-- a recipe is not "also suitable for" the slot it already is, and
-- allowing it would double-count in unioned pools.
alter table public.recipes
  add constraint recipes_also_suitable_for_check check (
    also_suitable_for <@ array['breakfast','lunch','dinner','snack']::text[]
    and not (meal_type = any(also_suitable_for))
  );

-- Backfill: lunch <-> dinner crossover only, bounded by each slot's own
-- plausible calorie range (see CALORIE_RANGE in
-- scripts/recipe-content/validate-spec.ts). Breakfast and snack are left
-- with no crossover on purpose -- nobody wants pancakes proposed for
-- dinner, and that partition is doing real work.
--
-- Deliberately NOT filtered on cook time: a 3-hour braise is a perfectly
-- normal meal-prepped lunch, and conflating effort with suitability would
-- exclude exactly the batch-cooking dishes people plan ahead for.
update public.recipes
set also_suitable_for = array['lunch']
where meal_type = 'dinner' and calories between 300 and 800;

update public.recipes
set also_suitable_for = array['dinner']
where meal_type = 'lunch' and calories between 350 and 950;

create index if not exists recipes_also_suitable_for_idx
  on public.recipes using gin (also_suitable_for);
