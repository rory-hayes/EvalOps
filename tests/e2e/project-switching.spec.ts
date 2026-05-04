import { expect, test } from "@playwright/test";

test("templates and settings stay focused on the Evaller loop", async ({ page }) => {
  await page.goto("/templates");
  await expect(page.getByRole("heading", { name: "Templates", exact: true })).toBeVisible();
  await expect(page.getByText("Support AI Release Check")).toBeVisible();
  await expect(page.getByText("More Templates Later")).toBeVisible();
  await page.getByRole("button", { name: "Use template" }).click();
  await expect(page).toHaveURL(/\/workspace$/);
  await expect(page.getByLabel("Quality bar value")).toHaveValue("85");

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.getByText("OpenAI credentials")).toBeVisible();
  await expect(page.getByText("Server-side only")).toBeVisible();
  await expect(page.getByText("Customer API key entry", { exact: true })).toBeVisible();
});

test("mobile layout exposes the four product-led routes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Runs" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Templates" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
});
