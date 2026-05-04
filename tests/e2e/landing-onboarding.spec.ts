import { expect, test } from "@playwright/test";

test("public landing page leads into onboarding and app dashboard", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Create, maintain, and improve high-quality AI evals." })).toBeVisible();
  const getStarted = page.getByRole("link", { name: "Get Started" }).first();
  await expect(getStarted).toHaveAttribute("href", "/signup?next=/onboarding");
  await expect(page.getByRole("link", { name: "View sample report" })).toHaveAttribute("href", "#screens");

  await getStarted.click();
  await expect(page).toHaveURL(/\/signup\?next=(%2F|\/)onboarding$/);
  await expect(page.getByRole("heading", { name: "Create your EvalOps account" })).toBeVisible();

  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByRole("heading", { name: "Create your first Eval Debt Audit" })).toBeVisible();
  await expect(page.getByText("Audit blueprint")).toBeVisible();
  await expect(page.getByText("Trace import next")).toBeVisible();

  await page.getByRole("textbox", { name: "Project name" }).fill("Support Assistant Audit");
  await page.getByRole("button", { name: /Support assistant/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("textbox", { name: "Evaluation objective" }).fill("Measure answer quality, escalation safety, and refund policy reliability.");
  await page.getByRole("button", { name: /Groundedness/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: /Billing accuracy/ }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("radio", { name: "Redact likely PII" }).check();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create audit plan" }).click();
  await expect(page).toHaveURL(/\/trace-import$/);
  await expect(page.getByText("Schema mapping preview")).toBeVisible();

  await page.goto("/dashboard");
  await expect(
    page.getByRole("heading", { name: "Projects", exact: true }).or(
      page.getByRole("heading", { name: "Eval Health Overview", exact: true }),
    ),
  ).toBeVisible();
});

test("signup route is a dedicated account creation screen", async ({ page }) => {
  await page.goto("/signup");
  await expect(page).toHaveURL(/\/signup$/);
  await expect(page.getByRole("heading", { name: "Create your EvalOps account" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
});
