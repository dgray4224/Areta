import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Requires a local Supabase stack (`supabase start`, Docker) running
 * alongside `pnpm dev`. Email confirmation is on (CLAUDE.md decision), so
 * this reads the confirmation link back out of Supabase CLI's local mail
 * testing server (Mailpit-compatible REST API) at the port configured in
 * supabase/config.toml's [local_smtp] block (default 54324) instead of a
 * real inbox.
 */
const MAIL_API_BASE = "http://127.0.0.1:54324/api/v1";

async function getConfirmationLink(request: APIRequestContext, email: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const listRes = await request.get(`${MAIL_API_BASE}/messages`);
    if (listRes.ok()) {
      const body = await listRes.json();
      const match = (body.messages ?? []).find((m: { To?: { Address: string }[] }) =>
        m.To?.some((to) => to.Address === email)
      );
      if (match) {
        const detailRes = await request.get(`${MAIL_API_BASE}/message/${match.ID}`);
        const detail = await detailRes.json();
        const html: string = detail.HTML ?? detail.Text ?? "";
        const linkMatch = html.match(/href="([^"]*\/auth\/confirm[^"]*)"/i);
        if (linkMatch) return linkMatch[1].replace(/&amp;/g, "&");
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`No confirmation email found for ${email} in the local mail testing server`);
}

test("signup, confirm, onboard, and reach a personalized dashboard", async ({ page, request }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const password = "correct-horse-battery-staple-1";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page.getByText("Check your email")).toBeVisible();

  const confirmationLink = await getConfirmationLink(request, email);
  await page.goto(confirmationLink);

  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /log in/i }).click();

  await expect(page).toHaveURL(/\/onboarding\/identity/);
  await page.getByLabel("Preferred Name").fill("E2E Tester");
  await page.getByLabel("Time zone").fill("America/New_York");
  await page.getByLabel("Typical wake time").fill("07:00");
  await page.getByLabel("Typical bedtime").fill("23:00");
  await page.getByRole("button", { name: /continue/i }).click();

  // V1 onboarding offers a single "Health" area, which unlocks the
  // Nutrition and Exercise steps (see V1_DOMAIN_KEYS in domains/goals/schema.ts).
  await expect(page).toHaveURL(/\/onboarding\/goals/);
  await page.getByRole("button", { name: "Health" }).click();
  await page.getByLabel("Goal").fill("Ship the Areta MVP");
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/onboarding\/nutrition/);
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/onboarding\/exercise/);
  await page.getByRole("button", { name: /continue/i }).click();

  await expect(page).toHaveURL(/\/onboarding\/review/);
  await page.getByRole("button", { name: /approve and activate/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("E2E Tester")).toBeVisible();
  await expect(page.getByText("Ship the Areta MVP")).toBeVisible();
});
