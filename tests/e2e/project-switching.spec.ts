import { expect, test, type Locator, type Page } from "@playwright/test";

async function selectedProjectName(switcher: Locator) {
  return switcher.evaluate((element) => {
    if (!(element instanceof HTMLSelectElement)) return "";
    return element.selectedOptions[0]?.textContent?.trim() || "";
  });
}

test("user can switch the active project from the app header", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  if ((await page.getByText("Support Assistant Audit").count()) === 0) {
    await createAuditPlan(page, {
      name: "Support Assistant Audit",
      objective: "Measure support answer quality and escalation reliability.",
      goal: /Safe escalation/,
      risk: /Billing accuracy/,
      privacy: "Redact likely PII",
    });
    await page.goto("/projects");
    await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: /create audit plan/i }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("textbox", { name: "Project name" }).fill("Privacy Assistant Audit");
  await page.getByRole("button", { name: /Support assistant/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Evaluation objective" }).fill("Measure privacy deletion requests and safe confirmation behavior.");
  await page.getByRole("button", { name: /Policy compliance/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Data leakage/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Store derived evals only" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create audit plan" }).click();
  await expect(page).toHaveURL(/\/trace-import$/);

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

async function createAuditPlan(
  page: Page,
  input: {
    name: string;
    objective: string;
    goal: RegExp;
    risk: RegExp;
    privacy: string;
  },
) {
  await page.goto("/onboarding");
  await page.getByRole("textbox", { name: "Project name" }).fill(input.name);
  await page.getByRole("button", { name: /Support assistant/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Evaluation objective" }).fill(input.objective);
  await page.getByRole("button", { name: input.goal }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: input.risk }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: input.privacy }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create audit plan" }).click();
  await expect(page).toHaveURL(/\/trace-import$/);
}
