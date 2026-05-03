import { expect, test, type Locator } from "@playwright/test";

async function selectedProjectName(switcher: Locator) {
  return switcher.evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) return "";
    return element.selectedOptions[0]?.textContent?.trim() || "";
  });
}

test("user can switch the active project from the app header", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Create project" }).click();

  await page.getByRole("textbox", { name: "Project name" }).fill("Privacy Assistant Audit");
  await page
    .getByRole("textbox", { name: "Evaluation objective" })
    .fill("Measure privacy deletion requests and safe confirmation behavior.");
  await page.getByRole("textbox", { name: "Primary risks" }).fill("Privacy, Data deletion");
  await page.getByRole("button", { name: "Create project" }).click();

  const switcher = page.getByRole("combobox", { name: "Project switcher" });
  await expect(switcher).toBeVisible();
  await expect.poll(() => selectedProjectName(switcher)).toBe("Privacy Assistant Audit");

  await switcher.selectOption({ label: "Support Assistant Audit" });
  await expect.poll(() => selectedProjectName(switcher)).toBe("Support Assistant Audit");

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Eval Health Overview" })).toBeVisible();
  await expect(page.locator("main")).toContainText("Support Assistant Audit");

  await switcher.selectOption({ label: "Privacy Assistant Audit" });
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("Privacy Assistant Audit");
});
