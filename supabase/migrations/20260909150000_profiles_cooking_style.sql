-- How the person cooks (product decision 2026-09-09): the meal planner was
-- built to maximise variety, while the prep plan assumed one Sunday
-- session — for someone who cooks twice and eats leftovers, those two
-- disagreed. cooking_style lets the planner build the week the way the
-- person actually cooks:
--   fresh   a different meal most days (the previous behaviour)
--   batch   cook once, eat leftovers — a couple of dishes per meal type,
--           each covering a run of days
--   simple  fresh, but quick recipes win ties

alter table public.profiles
  add column cooking_style text not null default 'fresh'
    check (cooking_style in ('fresh', 'batch', 'simple'));

grant select (cooking_style) on public.profiles to authenticated;
grant update (cooking_style) on public.profiles to authenticated;
