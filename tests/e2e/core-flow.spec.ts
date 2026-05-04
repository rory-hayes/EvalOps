import { expect, test } from "@playwright/test";

test.setTimeout(120_000);

test("user completes the Evaller improve and run-again loop", async ({ page }) => {
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByText("AI Instructions")).toBeVisible();

  await page.getByLabel("AI test name").fill("QA Audit Support Bot");
  await page.getByLabel("What are you testing?").fill("Whether the support AI handles billing, privacy, and urgent setup issues before release.");

  await page.getByLabel("AI instructions").fill(
    [
      "You are a support AI for a B2B SaaS product.",
      "Be concise and helpful.",
      "Do not invent account actions.",
    ].join("\n"),
  );

  await page.getByRole("button", { name: "Add user scenario" }).click();
  await page.getByLabel("Scenario 4 title").fill("Refund escalation");
  await page.getByLabel("Scenario 4 message").fill("I need a refund today because your product broke our launch.");
  await page.getByLabel("Scenario 4 expected behavior").fill("Acknowledge urgency, avoid promising a refund, and offer human help.");

  await page.getByRole("button", { name: "Add success criterion" }).click();
  await page.getByRole("textbox", { name: "Success criterion 5" }).fill("Asks one clarifying question when account details are missing");
  await page.getByLabel("Quality bar value").fill("82");

  await page.getByLabel("AI instructions").fill("");
  await expect(page.getByText("Add AI instructions before running.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();

  await page.getByLabel("AI instructions").fill(
    [
      "You are a support AI for a B2B SaaS product.",
      "Be concise and helpful.",
      "Do not invent account actions.",
    ].join("\n"),
  );
  await page.getByRole("button", { name: "Run AI Test" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Latest Result")).toBeVisible();
  await expect(page.getByText("Failure patterns")).toBeVisible();
  await expect(page.getByText("Suggested prompt fixes")).toBeVisible();
  await expect(page.getByText("Failed").first()).toBeVisible();

  await page.getByRole("button", { name: "Apply fix" }).first().click();
  await expect(page.getByText("Prompt fix applied. Run again to compare the next result.")).toBeVisible();
  await expect(page.getByLabel("AI instructions")).toHaveValue(/Evaller improvement/);

  await page.getByRole("button", { name: "Run Again" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/pass-rate change from the previous run/)).toBeVisible();
  await expect(page.getByText("100%").first()).toBeVisible();
  await expect(page.getByText("AI Release Readiness Report")).toBeVisible();
  await expect(page.getByText("Ready for release review")).toBeVisible();
  await expect(page.getByText("No open scenario failures in the latest run.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy report" })).toBeVisible();

  await page.getByRole("link", { name: "Runs" }).click();
  await expect(page).toHaveURL(/\/runs$/);
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.getByText("Run History")).toBeVisible();
  await expect(page.getByText("Prompt v2").first()).toBeVisible();
  await expect(page.getByText("AI Release Readiness Report")).toBeVisible();

  await page.reload();
  await expect(page.getByText("Run History")).toBeVisible();
  await expect(page.getByText("Prompt v2").first()).toBeVisible();
  await expect(page.getByText("Ready for release review")).toBeVisible();
});
