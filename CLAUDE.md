# CLAUDE.md

# LifeOS — Personal Execution and Weekly Regeneration Platform

> **Build status:** Phase 0 (Foundation) and Phase 1 (Onboarding and Personal OS) are complete, deployed, and verified against the live Supabase project. Phase 2 (Today screen and daily logging) is next. See [`README.md`](./README.md) for setup, current status detail, and known gaps — this file remains the product spec and stays unchanged as phases ship.

## 1. Product Mission

LifeOS is an AI-assisted personal operating system that turns goals, constraints, schedules, preferences, and logged behavior into an executable weekly plan.

It must answer:

1. Where am I?
2. Where am I trying to go?
3. What should I do today?
4. What should I buy this week?
5. What should I prepare on Sunday?
6. What is working?
7. What needs to improve?
8. How should next week change?

The core product is the **Weekly Regeneration Engine**.

---

## 2. Product Positioning

LifeOS is not merely:

- A habit tracker
- A calorie tracker
- A recovery app
- A learning app
- A journal
- A chatbot

Those are modules.

LifeOS is a personal planning, execution, analysis, and adaptation platform.

Primary differentiator:

> Every week, the operating system regenerates itself from the user's goals, plans, logs, outcomes, preferences, constraints, inventory, and schedule.

---

## 3. Core Loop

1. **Understand**
   - Onboard the user.
   - Learn goals, schedule, constraints, preferences, and current state.

2. **Plan**
   - Create phases, weekly outcomes, meals, shopping, preparation, learning, recovery, and daily actions.

3. **Execute**
   - Show a clear Today screen.
   - Make logging fast.

4. **Observe**
   - Collect objective and subjective data.

5. **Review**
   - Calculate progress.
   - Identify adherence, plan-design, outcome, and data-quality issues.

6. **Regenerate**
   - Preserve what worked.
   - Change what failed.
   - Generate the next weekly operating brief.

7. **Learn**
   - Store durable preferences, successful strategies, failed strategies, restrictions, and schedule patterns.

---

## 4. System Hierarchy

Identity  
→ Vision  
→ Domains  
→ Goals  
→ Phases  
→ Outcomes  
→ Systems  
→ Weekly Plan  
→ Daily Actions  
→ Logs  
→ Insights  
→ Adjustments

Every task must include a reason that connects it to a goal.

---

## 5. First-Week MVP

The founder must be able to use the app for a real week.

The MVP must support:

- Authentication
- Adaptive onboarding
- Personalized dashboard
- Daily action checklist
- Weight logging
- Sleep logging
- Nutrition logging
- Recovery logging
- Learning-session logging
- Saved meals
- Simple trends
- Weekly review
- AI-generated weekly operating brief
- Costco grocery list
- Sunday meal-prep plan
- User approval before plan activation
- Data export

Manual entry is acceptable for the first release.

Do not block the MVP on Apple Health, Garmin, calendars, notifications, or barcode scanning.

---

# 6. Build Phases

# 5A. Outcome-to-Operating-Parameters Engine

This engine is a foundational platform capability.

The user communicates in outcomes.

Examples:

- “I want to weigh 200 pounds by February.”
- “I want to return to jogging.”
- “I want to become employable as an AI solutions engineer.”
- “I want to finish one OMSA course successfully.”
- “I want to save $20,000.”
- “I want to sleep better.”

The platform translates each desired outcome into measurable operating parameters.

## Translation pipeline

1. Capture the desired outcome.
2. Capture the current state.
3. Capture the target date.
4. Capture constraints and preferences.
5. Identify missing information.
6. Ask only the questions required to make a responsible plan.
7. Calculate deterministic parameters where possible.
8. Use AI to interpret ambiguity and construct the plan.
9. Show the assumptions and reasoning.
10. Ask the user to approve the generated plan.
11. Monitor outcomes.
12. Recalculate parameters when evidence changes.

## Domain examples

### Weight loss

User provides:

- Current weight
- Goal weight
- Target date
- Height
- Activity level
- Recovery limitations
- Food preferences

LifeOS generates:

- Estimated energy expenditure
- Initial calorie range
- Protein range
- Expected rate of loss
- Meal structure
- Weekly adjustment rules

### Learning

User provides:

- Desired role or skill
- Current skill level
- Available time
- Target date
- Preferred learning style
- Existing projects

LifeOS generates:

- Skill map
- Sequence of topics
- Weekly study hours
- Project milestones
- Reading and practice cadence
- Evidence of mastery
- Review checkpoints

### Recovery

User provides:

- Desired functional outcome
- Surgery or injury information
- Clinician instructions
- Current restrictions
- Appointments

LifeOS generates only organizational parameters that remain within clinician instructions:

- Daily recovery checklist
- Appointment preparation
- Logging cadence
- Rest and work blocks
- Approved-task scheduling
- Questions for the care team

LifeOS must never invent medical clearance or advance a recovery protocol independently.

### Finance

User provides:

- Savings or debt outcome
- Current balances
- Income
- Expenses
- Target date
- Risk tolerance

LifeOS generates:

- Monthly contribution requirement
- Spending limits
- Milestones
- Scenario ranges
- Adjustment rules

## Parameter object

Every generated parameter should support:

```ts
type GeneratedParameter = {
  id: string;
  domain: string;
  name: string;
  value: number | string | boolean | null;
  unit?: string;
  range?: {
    min: number;
    max: number;
  };
  source: "calculation" | "rule" | "ai_inference" | "professional_instruction";
  assumptions: string[];
  rationale: string;
  confidence: number;
  safetyBounds?: string[];
  reviewDate?: string;
  requiresUserApproval: boolean;
  requiresProfessionalApproval?: boolean;
};
```

## Important design rule

Do not ask the user for a target that LifeOS can reasonably derive.

Bad:

- “What calorie target do you want?”
- “How many hours should you study?”
- “How much should you save each month?”
- “How often should you review progress?”

Better:

- “What outcome do you want?”
- “By when?”
- “What constraints should the plan respect?”
- “How aggressive or conservative should the plan feel?”
- “What has worked or failed before?”

LifeOS then proposes the operational settings.


## Phase 0 — Foundation

**Target: Day 1**

Build:

- Next.js
- TypeScript
- Tailwind CSS
- Supabase/PostgreSQL
- Authentication
- Database migrations
- Row-level security
- Environment validation
- Testing setup
- Error handling
- Responsive shell
- Vercel preview deployment

Done when a user can sign in and reach an authenticated empty dashboard.

---

## Phase 1 — Onboarding and Personal OS

**Target: Day 1–2**

The application begins with an interview.

### Identity and schedule

Ask:

- Name
- Time zone
- Units
- Typical wake time
- Typical bedtime
- Work status and hours
- School commitments
- Weekly review day
- Grocery day
- Meal-prep day
- Available learning time

### Goals

For each goal ask:

- Desired outcome
- Why it matters
- Target date
- Starting state
- Constraints
- Success criteria
- Priority
- Confidence
- Known obstacles

### Nutrition

Ask:

- Height
- Current weight
- Target weight
- Food preferences
- Allergies
- Disliked foods
- Favorite meals
- Meals per day
- Cooking ability
- Grocery stores
- Budget
- Appliances
- Tracking preference
- Protein target if known

### Recovery

Optional module:

- Surgery or injury date
- Current phase
- Clinician instructions
- Restrictions
- Mobility
- Physical therapy schedule
- Pain and swelling tracking
- Warning-sign acknowledgement

### Learning

Ask:

- Career direction
- Current skills
- Desired skills
- Current projects
- Preferred learning format
- Weekly available hours
- Formal course plans

### Coaching preferences

Ask:

- Direct or gentle tone
- Strict or flexible planning
- Reminder preference
- Desired explanation depth
- Whether missed tasks should be rescheduled
- Foods or activities never to recommend

### Onboarding output

Generate editable:

- Mission
- Active domains
- Ranked goals
- Current phases
- Initial weekly outcomes
- Daily check-in fields
- Known constraints
- Initial personalization profile

---

## Phase 2 — Today and Logging

**Target: Day 2–3**

The Today screen must show:

- Current phase
- Top three priorities
- Required tasks
- Optional tasks
- Planned meals
- Recovery actions
- Learning block
- Upcoming events
- Progress
- One recommended next action

### Weight log

- Timestamp
- Weight
- Source
- Notes
- Seven-day moving average

### Sleep log

- Bedtime
- Wake time
- Total duration
- Quality
- Interruptions
- Source
- Notes

### Nutrition log

- Meal
- Food
- Quantity
- Unit
- Calories
- Protein
- Carbohydrates
- Fat
- Fiber
- Saved meal
- Notes

### Recovery log

- Pain
- Swelling
- Energy
- Brace compliance
- Medication adherence
- Elevation
- Ice
- Approved exercises
- Mobility
- Warning signs
- Notes

### Learning log

- Track
- Task
- Duration
- Focus
- Output
- Link
- Reflection
- Next step

### Task statuses

- Planned
- Completed
- Partially completed
- Skipped
- Deferred
- Not applicable

A skipped task may include a reason.

---

## Phase 3 — Goal Translation, Meal Planning, Costco List, and Sunday Prep

**Target: Day 3–4**

The user should not be expected to know technical operating parameters such as calorie targets, protein targets, weekly weight-loss rates, study-hour targets, recovery volume, or milestone pacing.

The user provides:

- Desired outcome
- Current state
- Target date
- Preferences
- Constraints
- Schedule
- Budget
- Relevant health or professional restrictions
- Confidence and willingness level

LifeOS derives the operating parameters.

### Example nutrition inputs from the user

- Current weight
- Goal weight
- Target date
- Height
- Age
- Sex, if the user chooses to provide it
- Typical activity
- Current recovery or mobility status
- Food preferences
- Allergies
- Budget
- Grocery store
- Cooking ability
- Available preparation time
- Favorite meals
- Foods disliked
- Number of meals preferred
- Household servings

### Parameters generated by LifeOS

- Estimated maintenance calories
- Initial calorie target
- Protein range
- Fat minimum
- Carbohydrate range
- Fiber target
- Hydration target
- Expected weekly rate of change
- Weigh-in cadence
- Adjustment thresholds
- Meal structure
- Grocery quantities
- Preparation quantities

All generated values must include:

- Assumptions
- Calculation method
- Confidence
- Safety bounds
- Explanation
- Review date
- Whether professional approval is recommended

The user may edit or reject any generated parameter.

### Meal-plan outputs

The meal planner consumes the approved parameters generated by the Outcome-to-Operating-Parameters Engine.

- Seven-day meal plan
- Daily calorie and protein totals
- Breakfasts
- Lunches
- Dinners
- Snacks
- Recipes
- Ingredient quantities
- Grocery list
- Sunday prep instructions
- Estimated prep time
- Storage instructions
- Container count
- Expected leftovers

### Grocery-list rules

- Combine duplicates
- Convert recipe needs into purchase quantities
- Subtract inventory
- Group by store section
- Explain why each item is needed
- Allow substitution
- Save actual quantity and price
- Carry remaining inventory forward

### Sunday prep plan

Generate an ordered workflow:

1. Preheat appliances.
2. Start the longest-cooking items.
3. Wash and cut produce.
4. Cook proteins.
5. Cook carbohydrates.
6. Portion meals.
7. Label containers.
8. Store food.
9. Update inventory.
10. Clean the kitchen.

---

## Phase 4 — Weekly Review and Regeneration

**Target: Day 4–5**

This is the highest-priority feature.

### Calculate

- Weekly weight change
- Seven-day average
- Protein adherence
- Calorie adherence
- Meal-plan adherence
- Average sleep
- Recovery adherence
- Pain trend
- Swelling trend
- Learning minutes
- Task completion
- Missed-task reasons
- Inventory changes
- Goal progress

### Ask the user

- What went well?
- What was difficult?
- What felt unrealistic?
- Which meals should return?
- Which meals should not return?
- What caused missed tasks?
- What should change?
- Are there new restrictions, appointments, or schedule changes?

### Issue classification

The system must distinguish:

#### Adherence issue
The plan may be good, but the user did not follow it.

#### Plan-design issue
The user tried, but the plan was unrealistic or unpleasant.

#### Outcome issue
The user followed the plan, but the desired result did not occur.

#### Data-quality issue
There is insufficient reliable data.

Never reduce every problem to discipline.

### Weekly Operating Brief

Before generating the next week, recalculate any operating parameter whose assumptions or observed outcomes changed.

Examples:

- Adjust calorie targets when actual weight trend differs from the expected trend.
- Adjust learning workload when completion and fatigue indicate that the plan is too aggressive.
- Adjust meal complexity when preparation adherence is low.
- Adjust reminders when the user consistently completes tasks without them.
- Preserve clinician-controlled recovery restrictions unless the user records a new professional instruction.

Generate:

1. Executive summary
2. Current phase
3. Goal status
4. Progress
5. What worked
6. What needs improvement
7. Risks
8. Top three priorities
9. Recovery plan
10. Nutrition plan
11. Costco list
12. Sunday prep plan
13. Learning plan
14. Appointments
15. Daily schedule
16. Highest-leverage action
17. Changes from last week
18. Reason for each change

The user must approve the plan before it becomes active.

---

# 7. How the AI Learns

The AI must not claim to retrain a foundation model from one user's data.

Personalization uses five layers.

## Layer 1 — Structured State

Source-of-truth facts and approved generated parameters:

- Goals
- Phases
- Restrictions
- Schedule
- Targets
- Inventory
- Active plans
- Appointments
- Generated parameters
- Parameter assumptions
- Parameter approval status
- Parameter review dates

## Layer 2 — Event Log

Append meaningful events:

- Meal logged
- Weight logged
- Task completed
- Task skipped
- Plan edited
- Meal liked or disliked
- Recommendation accepted or rejected
- Restriction changed
- Appointment added

Preserve history.

## Layer 3 — Derived Metrics

Use deterministic code for:

- Moving averages
- Trend slopes
- Adherence rates
- Completion rates
- Time allocation
- Streaks
- Inventory consumption
- Variability

Do not use an LLM for calculations that code can perform.

## Layer 4 — Durable Memory

Store concise facts such as:

- Likes egg-based breakfasts
- Prefers Sunday meal prep
- Dislikes repetitive turkey meals
- Focuses better in the morning
- Needs low-effort meals during early recovery
- Often misses hydration later in the day

Memory types:

- Preference
- Constraint
- Successful strategy
- Failed strategy
- Stable schedule
- Motivation
- Communication preference

Each memory includes:

- Evidence
- Confidence
- Date created
- Last confirmed
- Review or expiration date
- User-confirmed status

## Layer 5 — AI Interpretation

The AI receives a compact context package:

- Current state
- Goals
- Restrictions
- Recent metrics
- Previous plan
- Adherence
- Feedback
- Durable memories
- Inventory
- Upcoming schedule
- Relevant historical comparison

The AI returns validated structured JSON.

It must not silently overwrite source-of-truth records.

---

# 8. Recommendation Feedback Loop

For every recommendation:

1. Save the recommendation.
2. Save why it was made.
3. Record whether the user accepted it.
4. Record whether the user followed it.
5. Record the outcome.
6. Classify the result:
   - Helpful
   - Neutral
   - Harmful
   - Unknown
7. Update the strategy history.
8. Use successful strategies more often while preserving variety.

Example:

- Recommendation: Prepare five chicken bowls.
- Accepted: Yes.
- Followed: Four of five.
- Rating: 4/5.
- Outcome: Protein adherence improved.
- Learning: Chicken bowls are a successful weekday lunch strategy.

---

# 9. AI Context Builders

Do not send the full database to the model.

## Daily context

- Current phase
- Today's schedule
- Today's tasks
- Current targets
- Recent warning flags
- Relevant inventory
- Relevant preferences

## Weekly context

- Goal status
- Seven-day metrics
- Previous plan
- Adherence
- Feedback
- Durable memory
- Upcoming calendar
- Inventory
- Phase rules

## Domain contexts

Create separate builders for:

- Nutrition
- Recovery
- Learning
- Work
- General planning

---

# 10. AI Output Contract

Use validated structured outputs.

```ts
type WeeklyOperatingBrief = {
  weekStart: string;
  executiveSummary: string;
  currentPhase: {
    id: string;
    name: string;
    mission: string;
  };
  progress: Array<{
    goalId: string;
    status: "ahead" | "on_track" | "at_risk" | "insufficient_data";
    summary: string;
    evidence: string[];
  }>;
  priorities: Array<{
    title: string;
    reason: string;
    domain: string;
    priority: 1 | 2 | 3;
  }>;
  changes: Array<{
    field: string;
    previousValue: unknown;
    proposedValue: unknown;
    reason: string;
    confidence: number;
  }>;
  mealPlan: MealPlan;
  groceryList: GroceryItem[];
  prepPlan: PrepStep[];
  learningPlan: LearningPlan;
  risks: Risk[];
  requiresApproval: true;
};
```

Validate with Zod.

Reject malformed output.

Provide deterministic fallback behavior.

---

# 11. Medical Safety

The recovery module may organize clinician-provided instructions.

It must not independently advance:

- Weight bearing
- Range of motion
- Brace settings
- Exercise intensity
- Running
- Jumping
- Return to sport
- Medication changes

Clinician instructions override generated plans.

The system may organize an instruction but may not invent one.

Warning signs must prompt the user to contact the appropriate care team or emergency service.

Do not diagnose.

---

# 12. Database Entities

Recommended:

- users
- profiles
- domains
- goals
- phases
- phase_rules
- plans
- weekly_briefs
- daily_actions
- action_events
- metrics
- metric_events
- foods
- meals
- meal_items
- recipes
- grocery_lists
- grocery_items
- inventory_items
- prep_plans
- prep_steps
- recovery_logs
- medical_instructions
- sleep_logs
- weight_logs
- learning_tracks
- learning_tasks
- study_sessions
- appointments
- journal_entries
- weekly_reviews
- memories
- recommendations
- recommendation_outcomes
- ai_runs
- ai_context_snapshots
- user_feedback

Principles:

- Multi-tenant
- Row-level security
- Timestamps
- Provenance
- Generated-plan versioning
- Historical preservation
- Explicit units
- Integration-ready source fields

---

# 13. Technology

## Web MVP

- Next.js
- TypeScript
- App Router
- Tailwind CSS
- Supabase
- PostgreSQL
- Zod
- React Hook Form
- Lightweight charting
- Vercel
- Sentry or equivalent
- Vitest
- Playwright

## AI

Create a provider abstraction.

```ts
interface AIProvider {
  generateStructured<T>(
    request: StructuredGenerationRequest<T>
  ): Promise<StructuredGenerationResult<T>>;
}
```

Support OpenAI, Anthropic, and future providers without spreading provider-specific code throughout the app.

---

# 14. Apple Health Roadmap

## MVP

Use fast manual entry for:

- Total sleep
- Bedtime
- Wake time
- Sleep quality
- Weight
- Steps or activity if desired

## Later

Use a native iOS or React Native companion to read HealthKit data with permission.

Potential data:

- Sleep stages
- Sleep duration
- Heart rate
- Resting heart rate
- HRV
- Steps
- Workouts
- Active energy
- Weight

Store:

- Source
- Import timestamp
- Device
- User override
- Deduplication key

A browser-only application should not be expected to provide the best direct HealthKit integration.

---

# 15. UX Requirements

## Today screen

Useful within five seconds.

Show:

- Top three priorities
- Next action
- Planned meals
- Recovery tasks
- Learning block
- Quick-log controls

## Logging

Most logs should take less than 15 seconds.

Use:

- Saved meals
- Recent foods
- Defaults
- Duplicate yesterday
- One-tap completion
- Sliders
- Quick notes
- Batch actions

## Weekly Reset

Flow:

1. Review calculated metrics.
2. Answer five to eight questions.
3. Review insights.
4. Generate proposed week.
5. Edit.
6. Approve.
7. Generate grocery and prep plan.
8. Activate the week.

---

# 16. Monetization Direction

## Free

- One active operating system
- Manual logging
- Basic weekly planning
- Limited history
- Basic charts

## Pro

- AI onboarding
- Weekly regeneration
- AI summaries
- Grocery and prep generation
- Multiple goals
- Durable memory
- Advanced analytics
- Wearable integration
- Calendar integration
- Document context
- Export and backup

Future:

- Family plans
- Coach or clinician collaboration
- Template marketplace
- Employer wellness

Do not build billing in the first-week MVP.

---

# 17. Development Seed Profile

Create editable development data:

- Age: 31
- Height: 5 feet 9 inches
- Current weight: approximately 220 pounds
- Target weight: 200 pounds
- Surgery date: July 29, 2026
- Recovery: patellar tendon repair
- Work: remote during recovery
- Fall education: semester off
- Spring education: OMSA begins in early January
- Learning goals:
  - AI engineering
  - Microsoft Fabric
  - Data engineering
  - Production application development
- Grocery store: Costco
- Meal-prep day: Sunday
- Favorite meal category: breakfast
- Wearable: Apple Watch
- Protein target: editable, initially 170 grams
- Weekly review: Sunday

Never bake this profile into platform core logic.

---

# 18. One-Week Schedule

## Day 1

- Repository
- Auth
- Database
- Onboarding
- Seed profile
- Preview deployment

## Day 2

- Today screen
- Daily actions
- Weight log
- Sleep log
- Recovery log
- Learning log

## Day 3

- Outcome-to-Operating-Parameters Engine
- Deterministic nutrition calculations
- Nutrition logging
- Saved foods
- Saved meals
- Daily totals
- Basic trends

## Day 4

- Weekly review
- Derived metrics
- Grocery-list data model
- Meal-plan and prep-plan schemas

## Day 5

- AI context builder
- Structured weekly generation
- Approval workflow
- Weekly Operating Brief
- Costco list
- Sunday prep plan
- Export
- End-to-end testing

If scope slips, preserve:

1. Logging
2. Weekly review
3. Weekly regeneration

Defer cosmetic features first.

---

# 19. MVP Definition of Done

The founder can:

1. State a desired outcome without supplying technical targets.
2. Review and approve the operating parameters generated by LifeOS.
3. Open Today.
2. Know what to do.
3. Log the day.
4. Review trends.
5. Complete Sunday review.
6. Generate a new weekly plan.
7. Receive a Costco list.
8. Receive Sunday prep steps.
9. Understand why the plan changed.
10. Approve and activate the week.

The app replaces spreadsheets and manual Sunday planning for one complete week.

---

# 20. Claude Development Rules

1. Read this file first.
2. Preserve the Weekly Regeneration loop.
3. Do not hardcode one user's life into platform logic.
4. Separate domain modules from platform core.
5. Build complete vertical slices.
6. Use deterministic code for calculations.
7. Use AI for interpretation and generation.
8. Validate all AI output.
9. Preserve recommendation evidence.
10. Require approval before changing active plans.
11. Do not invent medical progression.
12. Optimize for mobile and low-energy use.
13. Avoid unnecessary dependencies.
14. Keep secrets server-side.
15. Use strong typing.
16. Build loading, empty, success, and error states.
17. Test critical calculations.
18. Explain files changed.
19. Explain how to test.
20. State limitations honestly.
21. Ask users for outcomes, constraints, and preferences—not technical parameters the system can derive.
22. Show assumptions and calculations for generated parameters.
23. Recalculate parameters from observed outcomes rather than relying on static defaults.
24. Require user approval before generated parameters become active.

---

# 21. First Claude Code Prompt

> Read CLAUDE.md completely. Build Phase 0 and Phase 1 as one cohesive production-quality vertical slice. Create a Next.js TypeScript application with Supabase authentication, database migrations, row-level security, responsive adaptive onboarding, and a personalized dashboard generated from onboarding responses. Use Zod validation, clean service boundaries, development-only seed data, and automated tests for critical logic. Do not implement AI yet, but design the schema and provider interfaces so validated structured weekly generation can be added in Phase 4. Include deployment instructions, files changed, testing steps, and known limitations.

---

# 22. North-Star Experience

Every Sunday LifeOS should say:

> Here is what changed.  
> Here is what worked.  
> Here is what did not.  
> Here is why.  
> Here is what to buy.  
> Here is what to prepare.  
> Here is what to do each day.  
> Here is the single most important thing this week.

That experience is the product.
