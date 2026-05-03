import { expect, test } from "@playwright/test";

test("public landing page leads into onboarding and app dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Create, maintain, and improve high-quality AI evals." })).toBeVisible();
  const startAuditSetup = page.getByRole("link", { name: "Start audit setup" }).first();
  await expect(startAuditSetup).toHaveAttribute("href", "/onboarding");
  await expect(page.getByRole("link", { name: "View sample report" })).toHaveAttribute("href", "#screens");

  await startAuditSetup.click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Set up your Eval Debt Audit" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Workflow/ })).toBeVisible();

  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("button", { name: /Goals/ })).toBeVisible();

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }).or(
      page.getByRole("heading", { name: "Eval Health Overview", exact: true }),
    ),
  ).toBeVisible();
});

test("signup route sends users into auth without a missing-route dead end", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/login\?next=(%2F|\/)projects$/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});
