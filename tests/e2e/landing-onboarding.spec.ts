import { expect, test } from "@playwright/test";

test("root and legacy product routes land on the Evaller workspace", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Runs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();

  for (const legacyPath of [
    "/dashboard",
    "/projects",
    "/trace-import",
    "/eval-builder",
    "/graders",
    "/prompt-optimizer",
    "/routing-caching",
    "/reports",
    "/onboarding",
  ]) {
    await page.goto(legacyPath);
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  }
});

test("signup route is a dedicated Evaller account creation screen", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create your Evaller account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
