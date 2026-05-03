import { expect, test } from "@playwright/test";

test("user completes Eval Debt Audit flow end to end", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("What EvalOps will generate")).toBeVisible();
  await expect(page.locator("span").filter({ hasText: "Redact likely PII" }).first()).toBeVisible();
  await expect(page.getByText("Primary goals")).toBeVisible();
  await expect(page.getByText("Selected")).toBeVisible();

  await page.goto("/trace-import");
  await expect(page.getByText("Schema mapping preview")).toBeVisible();
  await expect(page.getByText("Redaction controls")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles({
    name: "support.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "conversation_id,user_input,assistant_output\n" +
        "c_1,I asked three times and this is still not fixed,Try restarting the app.",
    ),
  });
  await expect(page.getByText("Selected: support.csv")).toBeVisible();
  await page.getByRole("button", { name: /upload and process/i }).click();
  await expect(page.getByText("completed").first()).toBeVisible();
  await expect(page.getByText("Escalation").first()).toBeVisible();
  await expect(page.getByText("Import progress")).toBeVisible();

  await page.goto("/eval-builder");
  await expect(page.getByLabel("Filter eval cases")).toBeVisible();
  await expect(page.getByText("Bulk tagging")).toBeVisible();
  await expect(page.getByText("Inline case editing")).toBeVisible();
  await expect(page.getByText("Escalation handoff missing")).toBeVisible();
  await page.getByRole("textbox", { name: "Review comment" }).fill("Resolved during E2E review.");
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("resolved").first()).toBeVisible();
  await expect(page.getByText("Resolved during E2E review.")).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("support-assistant-audit");

  await page.goto("/graders");
  await expect(page.getByText("Threshold configuration")).toBeVisible();
  await expect(page.getByText("Calibration reference set")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rubric", exact: true }).first()).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Audit Report", exact: true })).toBeVisible();
  await expect(page.getByText("Executive summary")).toBeVisible();
  await expect(page.getByText("Baseline scorecard")).toBeVisible();
  await expect(page.getByText("Business impact opportunities")).toBeVisible();
  await expect(page.getByRole("button", { name: /PDF coming soon/i })).toBeDisabled();
  await expect(page.getByText("issue.resolved")).toBeVisible();
  await expect(page.getByText("export.generated")).toBeVisible();

  await page.goto("/prompt-optimizer");
  await expect(page.getByText("Likely prompt issues")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Candidate prompt body" }).first()).toBeVisible();
  await expect(page.getByText("Latency").first()).toBeVisible();
  await page.getByRole("button", { name: "Promote candidate" }).first().click();
  await expect(page.getByRole("dialog", { name: "Promote prompt candidate" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Promote prompt candidate" })).toBeHidden();

  await page.goto("/routing-caching");
  await expect(page.getByText("High-risk route review")).toBeVisible();
  await expect(page.getByText("Operational actions")).toBeVisible();

  await page.goto("/settings");
  await expect(page.getByText("PII redaction")).toBeVisible();
  await expect(page.getByText("Short raw-data retention")).toBeVisible();
  await expect(page.getByText("Store derived evals only")).toBeVisible();
  await expect(page.getByText("Data residency")).toBeVisible();
  await expect(page.getByRole("button", { name: /Export project data/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete project data/i })).toBeVisible();
  await expect(page.getByRole("main").getByRole("button", { name: "Sign out" })).toBeVisible();
});
