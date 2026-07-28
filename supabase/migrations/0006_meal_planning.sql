-- Phase 3: Outcome-to-Operating-Parameters engine, meal planning, grocery
-- list, and Sunday prep plan (CLAUDE.md §5A and "Phase 3" sections).

-- Generated, user-approvable operating parameters (CLAUDE.md's
-- GeneratedParameter type, §5A). Regenerating a parameter resets approval —
-- CLAUDE.md rule 24 requires approval before any generated parameter is
-- active, even a recalculated one.
create table public.generated_parameters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  domain text not null,
  name text not null,
  value jsonb not null,
  unit text,
  range_min numeric,
  range_max numeric,
  source text not null check (source in ('calculation', 'rule', 'ai_inference', 'professional_instruction')),
  assumptions text[] not null default '{}',
  rationale text not null,
  confidence numeric not null check (confidence between 0 and 1),
  safety_bounds text[] not null default '{}',
  review_date date,
  requires_user_approval boolean not null default true,
  requires_professional_approval boolean not null default false,
  approved boolean not null default false,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, domain, name)
);

create trigger set_generated_parameters_updated_at
  before update on public.generated_parameters
  for each row execute function public.set_updated_at();

alter table public.generated_parameters enable row level security;

create policy "generated_parameters_all_own" on public.generated_parameters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index generated_parameters_user_domain_idx on public.generated_parameters (user_id, domain);


-- Recipes are shared platform reference data, not per-user (CLAUDE.md rule
-- 3: nothing user-specific lives in platform logic/content). Every
-- authenticated user can read them; writes happen only via migration or the
-- service role, never through the app.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  calories numeric not null,
  protein_g numeric not null,
  carbs_g numeric not null,
  fat_g numeric not null,
  fiber_g numeric,
  prep_minutes integer not null default 0,
  cook_minutes integer not null default 0,
  servings integer not null default 1,
  dietary_tags text[] not null default '{}',
  ingredients jsonb not null,
  instructions text[] not null default '{}',
  storage_instructions text,
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "recipes_select_all" on public.recipes
  for select using (true);

create index recipes_meal_type_idx on public.recipes (meal_type);


create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  calorie_target numeric,
  protein_target numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

create trigger set_meal_plans_updated_at
  before update on public.meal_plans
  for each row execute function public.set_updated_at();

alter table public.meal_plans enable row level security;

create policy "meal_plans_all_own" on public.meal_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index meal_plans_user_week_idx on public.meal_plans (user_id, week_start desc);


create table public.meal_plan_items (
  id uuid primary key default gen_random_uuid(),
  meal_plan_id uuid not null references public.meal_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  meal_type text not null check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid not null references public.recipes (id),
  servings numeric not null default 1,
  created_at timestamptz not null default now()
);

alter table public.meal_plan_items enable row level security;

create policy "meal_plan_items_all_own" on public.meal_plan_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index meal_plan_items_plan_idx on public.meal_plan_items (meal_plan_id);


create table public.grocery_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete cascade,
  week_start date not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.grocery_lists enable row level security;

create policy "grocery_lists_all_own" on public.grocery_lists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index grocery_lists_user_week_idx on public.grocery_lists (user_id, week_start desc);


create table public.grocery_items (
  id uuid primary key default gen_random_uuid(),
  grocery_list_id uuid not null references public.grocery_lists (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric,
  unit text,
  section text not null default 'other',
  needed_for text[] not null default '{}',
  is_checked boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.grocery_items enable row level security;

create policy "grocery_items_all_own" on public.grocery_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index grocery_items_list_idx on public.grocery_items (grocery_list_id);


-- Minimal inventory: grocery-list generation subtracts on-hand quantities
-- when present. No dedicated editing UI yet (see README known gaps) — an
-- empty inventory (the default for every user) is a no-op subtraction.
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  quantity numeric not null default 0,
  unit text,
  updated_at timestamptz not null default now(),
  unique (user_id, name, unit)
);

create trigger set_inventory_items_updated_at
  before update on public.inventory_items
  for each row execute function public.set_updated_at();

alter table public.inventory_items enable row level security;

create policy "inventory_items_all_own" on public.inventory_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


create table public.prep_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  meal_plan_id uuid references public.meal_plans (id) on delete cascade,
  week_start date not null,
  estimated_minutes integer,
  container_count integer,
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

alter table public.prep_plans enable row level security;

create policy "prep_plans_all_own" on public.prep_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index prep_plans_user_week_idx on public.prep_plans (user_id, week_start desc);


create table public.prep_steps (
  id uuid primary key default gen_random_uuid(),
  prep_plan_id uuid not null references public.prep_plans (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  step_number smallint not null,
  instruction text not null,
  created_at timestamptz not null default now()
);

alter table public.prep_steps enable row level security;

create policy "prep_steps_all_own" on public.prep_steps
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index prep_steps_plan_idx on public.prep_steps (prep_plan_id);


-- Seed recipe library: 6 recipes per meal type, generic and founder-agnostic
-- (CLAUDE.md rule 3). Ingredient "section" values match common store layout
-- for grocery-list grouping: produce, protein, dairy, pantry, frozen, other.

insert into public.recipes (name, meal_type, calories, protein_g, carbs_g, fat_g, fiber_g, prep_minutes, cook_minutes, servings, dietary_tags, ingredients, instructions, storage_instructions) values

('Veggie Egg Scramble', 'breakfast', 320, 22, 10, 22, 3, 5, 8, 1,
 array['vegetarian', 'gluten-free', 'high-protein'],
 '[{"name":"Eggs","quantity":2,"unit":"count","section":"dairy"},{"name":"Spinach","quantity":1,"unit":"cup","section":"produce"},{"name":"Bell pepper","quantity":0.5,"unit":"count","section":"produce"},{"name":"Onion","quantity":0.25,"unit":"count","section":"produce"},{"name":"Olive oil","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Dice onion and bell pepper, wilt spinach in a pan with olive oil.', 'Whisk eggs and pour into the pan.', 'Scramble until just set and serve.'],
 'Best fresh; leftovers keep 1 day refrigerated.'),

('Greek Yogurt Parfait', 'breakfast', 350, 25, 45, 8, 5, 3, 0, 1,
 array['vegetarian', 'quick'],
 '[{"name":"Greek yogurt","quantity":1,"unit":"cup","section":"dairy"},{"name":"Mixed berries","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Granola","quantity":0.25,"unit":"cup","section":"pantry"},{"name":"Honey","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Layer yogurt, berries, and granola in a bowl or jar.', 'Drizzle with honey.'],
 'Assemble fresh; keeps granola crisp if added last.'),

('Overnight Oats with Peanut Butter', 'breakfast', 420, 18, 55, 15, 9, 5, 0, 1,
 array['vegetarian', 'make-ahead'],
 '[{"name":"Rolled oats","quantity":0.5,"unit":"cup","section":"pantry"},{"name":"Milk","quantity":0.75,"unit":"cup","section":"dairy"},{"name":"Peanut butter","quantity":1,"unit":"tbsp","section":"pantry"},{"name":"Banana","quantity":0.5,"unit":"count","section":"produce"},{"name":"Chia seeds","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Combine oats, milk, peanut butter, and chia seeds in a jar.', 'Refrigerate overnight.', 'Top with sliced banana before eating.'],
 'Keeps 3-4 days refrigerated in a sealed jar.'),

('Protein Smoothie', 'breakfast', 380, 35, 35, 12, 6, 5, 0, 1,
 array['quick', 'high-protein', 'gluten-free'],
 '[{"name":"Protein powder","quantity":1,"unit":"scoop","section":"pantry"},{"name":"Banana","quantity":1,"unit":"count","section":"produce"},{"name":"Spinach","quantity":1,"unit":"cup","section":"produce"},{"name":"Almond milk","quantity":1,"unit":"cup","section":"dairy"},{"name":"Peanut butter","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Add all ingredients to a blender.', 'Blend until smooth.'],
 'Best fresh; can refrigerate up to 1 day in a sealed container.'),

('Turkey Sausage Breakfast Bowl', 'breakfast', 450, 32, 30, 22, 5, 10, 15, 1,
 array['gluten-free', 'high-protein'],
 '[{"name":"Turkey sausage","quantity":3,"unit":"oz","section":"protein"},{"name":"Sweet potato","quantity":1,"unit":"count","section":"produce"},{"name":"Eggs","quantity":2,"unit":"count","section":"dairy"},{"name":"Spinach","quantity":1,"unit":"cup","section":"produce"}]'::jsonb,
 array['Dice and roast or pan-fry sweet potato until tender.', 'Brown turkey sausage in a pan.', 'Wilt spinach, fry eggs, and assemble the bowl.'],
 'Components keep 3 days refrigerated; reheat and add fresh egg.'),

('Cottage Cheese Toast', 'breakfast', 300, 24, 30, 9, 4, 5, 3, 1,
 array['vegetarian', 'quick'],
 '[{"name":"Cottage cheese","quantity":0.5,"unit":"cup","section":"dairy"},{"name":"Whole grain bread","quantity":1,"unit":"slice","section":"bakery"},{"name":"Tomato","quantity":0.5,"unit":"count","section":"produce"},{"name":"Everything bagel seasoning","quantity":1,"unit":"tsp","section":"pantry"}]'::jsonb,
 array['Toast the bread.', 'Top with cottage cheese and sliced tomato.', 'Finish with seasoning.'],
 'Best fresh; assemble right before eating.'),

('Grilled Chicken Salad', 'lunch', 450, 40, 15, 25, 5, 10, 12, 1,
 array['gluten-free', 'high-protein'],
 '[{"name":"Chicken breast","quantity":5,"unit":"oz","section":"protein"},{"name":"Mixed greens","quantity":2,"unit":"cup","section":"produce"},{"name":"Cherry tomatoes","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Cucumber","quantity":0.5,"unit":"count","section":"produce"},{"name":"Feta cheese","quantity":2,"unit":"tbsp","section":"dairy"},{"name":"Olive oil vinaigrette","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Grill or pan-sear chicken breast until cooked through, then slice.', 'Toss greens, tomatoes, and cucumber.', 'Top with chicken, feta, and vinaigrette.'],
 'Store dressing separately; keeps 3 days refrigerated.'),

('Turkey and Avocado Wrap', 'lunch', 420, 30, 38, 16, 8, 8, 0, 1,
 array['quick'],
 '[{"name":"Turkey breast","quantity":4,"unit":"oz","section":"protein"},{"name":"Whole wheat tortilla","quantity":1,"unit":"count","section":"bakery"},{"name":"Avocado","quantity":0.5,"unit":"count","section":"produce"},{"name":"Lettuce","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Tomato","quantity":0.5,"unit":"count","section":"produce"},{"name":"Mustard","quantity":1,"unit":"tsp","section":"pantry"}]'::jsonb,
 array['Lay turkey, avocado, lettuce, and tomato on the tortilla.', 'Add mustard, roll tightly, and slice in half.'],
 'Keeps 1 day refrigerated; wrap tightly to prevent drying out.'),

('Black Bean and Rice Bowl', 'lunch', 480, 18, 75, 12, 15, 10, 20, 1,
 array['vegetarian', 'vegan', 'gluten-free'],
 '[{"name":"Black beans","quantity":1,"unit":"cup","section":"pantry"},{"name":"Brown rice","quantity":0.75,"unit":"cup cooked","section":"pantry"},{"name":"Corn","quantity":0.5,"unit":"cup","section":"frozen"},{"name":"Salsa","quantity":0.25,"unit":"cup","section":"pantry"},{"name":"Avocado","quantity":0.5,"unit":"count","section":"produce"},{"name":"Lime","quantity":0.5,"unit":"count","section":"produce"}]'::jsonb,
 array['Cook rice according to package directions.', 'Warm black beans and corn.', 'Assemble bowl and top with salsa, avocado, and a squeeze of lime.'],
 'Components keep 4 days refrigerated separately.'),

('Tuna Salad Lettuce Wraps', 'lunch', 340, 32, 18, 14, 4, 10, 0, 1,
 array['quick', 'high-protein'],
 '[{"name":"Canned tuna","quantity":5,"unit":"oz","section":"pantry"},{"name":"Greek yogurt","quantity":2,"unit":"tbsp","section":"dairy"},{"name":"Celery","quantity":0.25,"unit":"cup","section":"produce"},{"name":"Lettuce leaves","quantity":4,"unit":"count","section":"produce"},{"name":"Whole grain crackers","quantity":6,"unit":"count","section":"pantry"}]'::jsonb,
 array['Mix tuna, greek yogurt, and diced celery.', 'Spoon into lettuce leaves.', 'Serve with crackers.'],
 'Tuna salad keeps 2 days refrigerated.'),

('Chicken Burrito Bowl', 'lunch', 550, 42, 55, 18, 10, 15, 20, 1,
 array['gluten-free', 'high-protein'],
 '[{"name":"Chicken thigh","quantity":5,"unit":"oz","section":"protein"},{"name":"Brown rice","quantity":0.75,"unit":"cup cooked","section":"pantry"},{"name":"Black beans","quantity":0.5,"unit":"cup","section":"pantry"},{"name":"Salsa","quantity":0.25,"unit":"cup","section":"pantry"},{"name":"Shredded cheese","quantity":2,"unit":"tbsp","section":"dairy"},{"name":"Lettuce","quantity":0.5,"unit":"cup","section":"produce"}]'::jsonb,
 array['Season and cook chicken thigh, then slice.', 'Cook rice and warm black beans.', 'Assemble bowl with rice, beans, chicken, salsa, cheese, and lettuce.'],
 'Components keep 4 days refrigerated separately.'),

('Lentil Soup', 'lunch', 380, 22, 60, 4, 16, 15, 35, 2,
 array['vegetarian', 'vegan'],
 '[{"name":"Lentils","quantity":1,"unit":"cup","section":"pantry"},{"name":"Carrots","quantity":2,"unit":"count","section":"produce"},{"name":"Celery","quantity":2,"unit":"stalk","section":"produce"},{"name":"Onion","quantity":1,"unit":"count","section":"produce"},{"name":"Vegetable broth","quantity":4,"unit":"cup","section":"pantry"},{"name":"Cumin","quantity":1,"unit":"tsp","section":"pantry"}]'::jsonb,
 array['Saute diced onion, carrots, and celery.', 'Add lentils, broth, and cumin.', 'Simmer 30 minutes until lentils are tender.'],
 'Keeps 5 days refrigerated or 3 months frozen.'),

('Baked Salmon with Roasted Vegetables', 'dinner', 520, 40, 25, 28, 6, 10, 25, 1,
 array['gluten-free', 'high-protein'],
 '[{"name":"Salmon fillet","quantity":6,"unit":"oz","section":"protein"},{"name":"Broccoli","quantity":1,"unit":"cup","section":"produce"},{"name":"Carrots","quantity":1,"unit":"cup","section":"produce"},{"name":"Olive oil","quantity":1,"unit":"tbsp","section":"pantry"},{"name":"Lemon","quantity":0.5,"unit":"count","section":"produce"}]'::jsonb,
 array['Preheat oven to 400F.', 'Toss vegetables in olive oil and spread on a sheet pan with the salmon.', 'Roast 20-25 minutes until salmon flakes easily.', 'Finish with a squeeze of lemon.'],
 'Keeps 3 days refrigerated.'),

('Turkey Chili', 'dinner', 430, 38, 35, 15, 10, 15, 40, 2,
 array['gluten-free', 'make-ahead'],
 '[{"name":"Ground turkey","quantity":1,"unit":"lb","section":"protein"},{"name":"Kidney beans","quantity":1,"unit":"can","section":"pantry"},{"name":"Diced tomatoes","quantity":1,"unit":"can","section":"pantry"},{"name":"Onion","quantity":1,"unit":"count","section":"produce"},{"name":"Bell pepper","quantity":1,"unit":"count","section":"produce"},{"name":"Chili spice blend","quantity":2,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Brown ground turkey with diced onion and bell pepper.', 'Add beans, tomatoes, and chili spices.', 'Simmer 30 minutes, stirring occasionally.'],
 'Keeps 5 days refrigerated or 3 months frozen.'),

('Chicken Stir Fry', 'dinner', 500, 40, 50, 14, 6, 15, 15, 1,
 array['high-protein'],
 '[{"name":"Chicken breast","quantity":6,"unit":"oz","section":"protein"},{"name":"Broccoli","quantity":1,"unit":"cup","section":"produce"},{"name":"Bell pepper","quantity":1,"unit":"count","section":"produce"},{"name":"Snap peas","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Soy sauce","quantity":2,"unit":"tbsp","section":"pantry"},{"name":"Brown rice","quantity":0.75,"unit":"cup cooked","section":"pantry"}]'::jsonb,
 array['Slice chicken and vegetables.', 'Stir-fry chicken until cooked through, then set aside.', 'Stir-fry vegetables, return chicken, add soy sauce, and serve over rice.'],
 'Keeps 3 days refrigerated.'),

('Beef and Broccoli', 'dinner', 540, 38, 45, 20, 5, 15, 15, 1,
 array['high-protein'],
 '[{"name":"Lean beef strips","quantity":6,"unit":"oz","section":"protein"},{"name":"Broccoli","quantity":1.5,"unit":"cup","section":"produce"},{"name":"Garlic","quantity":2,"unit":"clove","section":"produce"},{"name":"Soy sauce","quantity":2,"unit":"tbsp","section":"pantry"},{"name":"Brown rice","quantity":0.75,"unit":"cup cooked","section":"pantry"}]'::jsonb,
 array['Sear beef strips over high heat, then set aside.', 'Stir-fry broccoli and garlic.', 'Return beef, add soy sauce, and serve over rice.'],
 'Keeps 3 days refrigerated.'),

('Baked Cod with Quinoa', 'dinner', 450, 38, 35, 16, 5, 10, 20, 1,
 array['gluten-free', 'high-protein'],
 '[{"name":"Cod fillet","quantity":6,"unit":"oz","section":"protein"},{"name":"Quinoa","quantity":0.5,"unit":"cup dry","section":"pantry"},{"name":"Asparagus","quantity":1,"unit":"cup","section":"produce"},{"name":"Lemon","quantity":0.5,"unit":"count","section":"produce"},{"name":"Olive oil","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Preheat oven to 400F and cook quinoa according to package directions.', 'Bake cod and asparagus with olive oil for 15-18 minutes.', 'Finish with lemon and serve over quinoa.'],
 'Keeps 3 days refrigerated.'),

('Black Bean Tacos', 'dinner', 420, 16, 60, 14, 14, 15, 10, 2,
 array['vegetarian', 'vegan'],
 '[{"name":"Black beans","quantity":1.5,"unit":"cup","section":"pantry"},{"name":"Corn tortillas","quantity":4,"unit":"count","section":"bakery"},{"name":"Cabbage slaw mix","quantity":1,"unit":"cup","section":"produce"},{"name":"Avocado","quantity":1,"unit":"count","section":"produce"},{"name":"Salsa","quantity":0.25,"unit":"cup","section":"pantry"},{"name":"Lime","quantity":1,"unit":"count","section":"produce"}]'::jsonb,
 array['Warm black beans with a pinch of cumin.', 'Warm tortillas.', 'Fill with beans, slaw, avocado, and salsa; finish with lime.'],
 'Beans keep 4 days refrigerated; assemble tacos fresh.'),

('Apple with Almond Butter', 'snack', 250, 6, 28, 14, 6, 2, 0, 1,
 array['vegan', 'quick', 'gluten-free'],
 '[{"name":"Apple","quantity":1,"unit":"count","section":"produce"},{"name":"Almond butter","quantity":1.5,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Slice apple and serve with almond butter.'],
 'Best fresh.'),

('Hard-Boiled Eggs', 'snack', 140, 12, 1, 10, 0, 2, 10, 1,
 array['gluten-free', 'quick', 'high-protein'],
 '[{"name":"Eggs","quantity":2,"unit":"count","section":"dairy"}]'::jsonb,
 array['Boil eggs 10-12 minutes, then cool in ice water and peel.'],
 'Keeps 1 week refrigerated, unpeeled.'),

('Greek Yogurt with Honey', 'snack', 180, 18, 20, 3, 0, 2, 0, 1,
 array['vegetarian', 'quick'],
 '[{"name":"Greek yogurt","quantity":1,"unit":"cup","section":"dairy"},{"name":"Honey","quantity":1,"unit":"tbsp","section":"pantry"}]'::jsonb,
 array['Stir honey into yogurt and serve.'],
 'Best fresh.'),

('Hummus and Veggies', 'snack', 200, 7, 22, 10, 6, 5, 0, 1,
 array['vegan', 'quick', 'gluten-free'],
 '[{"name":"Hummus","quantity":0.25,"unit":"cup","section":"pantry"},{"name":"Carrots","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Celery","quantity":0.5,"unit":"cup","section":"produce"},{"name":"Bell pepper","quantity":0.5,"unit":"count","section":"produce"}]'::jsonb,
 array['Slice vegetables into sticks and serve with hummus.'],
 'Keeps 3 days refrigerated.'),

('Protein Shake', 'snack', 160, 25, 8, 3, 1, 2, 0, 1,
 array['quick', 'high-protein', 'gluten-free'],
 '[{"name":"Protein powder","quantity":1,"unit":"scoop","section":"pantry"},{"name":"Milk or water","quantity":1,"unit":"cup","section":"dairy"}]'::jsonb,
 array['Shake or blend protein powder with milk or water.'],
 'Best fresh.'),

('Cottage Cheese with Pineapple', 'snack', 220, 22, 22, 4, 1, 2, 0, 1,
 array['vegetarian', 'quick', 'gluten-free'],
 '[{"name":"Cottage cheese","quantity":0.75,"unit":"cup","section":"dairy"},{"name":"Pineapple chunks","quantity":0.5,"unit":"cup","section":"produce"}]'::jsonb,
 array['Combine cottage cheese and pineapple in a bowl.'],
 'Best fresh; keeps 1 day refrigerated.');
