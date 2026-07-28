"use server";

import type { ActionResult } from "@/platform/auth/actions";
import { approveMealPlan } from "@/domains/mealplan/service";
import { generateAndSaveGroceryList } from "@/domains/grocery/service";
import { generateAndSavePrepPlan } from "@/domains/prep/service";

/** Approving a meal plan (CLAUDE.md rule 10: require approval before a
 * generated plan becomes active) cascades into the grocery list and Sunday
 * prep plan, since both are derived directly from the approved plan. */
export async function approveMealPlanAndGenerateDownstream(userId: string): Promise<ActionResult> {
  const approveResult = await approveMealPlan(userId);
  if (!approveResult.ok) return approveResult;

  const groceryResult = await generateAndSaveGroceryList(userId);
  if (!groceryResult.ok) return groceryResult;

  const prepResult = await generateAndSavePrepPlan(userId);
  if (!prepResult.ok) return prepResult;

  return { ok: true, data: undefined };
}
