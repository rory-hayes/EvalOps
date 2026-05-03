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
  await expect(page.getByLabel("Grader description")).toBeVisible();
  await page.getByLabel("Grader description").fill("Score escalation quality against the paid pilot handoff rubric.");
  await page.getByLabel("Judge model").fill("gpt-5.5");
  await page.getByLabel("Active in audit runs").uncheck();
  await page.getByRole("button", { name: /save grader config/i }).click();
  await expect(page.getByText("paused").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rubric", exact: true }).first()).toBeVisible();

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Audit Report", exact: true })).toBeVisible();
  await expect(page.getByText("Executive summary")).toBeVisible();
  await expect(page.getByText("Baseline scorecard")).toBeVisible();
  await expect(page.getByText("Business impact opportunities")).toBeVisible();
  const pdfDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export pdf/i }).click();
  const pdfDownload = await pdfDownloadPromise;
  expect(pdfDownload.suggestedFilename()).toContain("audit-report.pdf");
  await expect(page.getByText("issue.resolved")).toBeVisible();
  await expect(page.getByText("export.generated").first()).toBeVisible();

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
  await expect(page.locator("span").filter({ hasText: /^PII redaction$/ })).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^Short raw-data retention$/ })).toBeVisible();
  await expect(page.locator("span").filter({ hasText: /^Store derived evals only$/ })).toBeVisible();
  await expect(page.getByText("Data residency")).toBeVisible();
  await page.getByLabel("Privacy posture").selectOption("derived_only");
  await page.getByLabel("Project risks and goals").fill("Billing, Escalation, Privacy, Paid pilot");
  await page.getByRole("button", { name: /save privacy settings/i }).click();
  await expect(page.getByLabel("Privacy posture")).toHaveValue("derived_only");
  await expect(page.getByRole("button", { name: /Export CSV/i })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Data Inventory" })).toBeVisible();
  await expect(page.getByText("Raw uploads")).toBeVisible();
  await expect(page.getByText("Raw traces")).toBeVisible();
  await expect(page.getByText("Derived eval artifacts")).toBeVisible();
  await expect(page.getByText("Audit / receipt records")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Retention Status" })).toBeVisible();
  await expect(page.getByText("Derived-only mode keeps eval artifacts and safe metadata visible while raw trace content is minimized.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Export History / Receipts" })).toBeVisible();
  await expect(page.getByText("0 retained / 1 purged").first()).toBeVisible();
  await expect(page.getByText("Eval pack CSV")).toBeVisible();
  await expect(page.getByText("Audit report PDF")).toBeVisible();
  await expect(page.getByRole("button", { name: /Full project export/i })).toBeEnabled();
  await page.getByRole("button", { name: /Full project export/i }).click();
  await expect(page.getByText("Full project JSON")).toBeVisible();
  await expect(page.getByText("Full project export receipt")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download" }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete project data/i })).toBeEnabled();
  await page.getByRole("button", { name: /Delete project data/i }).click();
  await expect(page.getByRole("dialog", { name: "Delete project data" })).toBeVisible();
  await expect(page.getByText("Type Support Assistant Audit to confirm.")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Delete project data" })).toBeHidden();
  await expect(page.getByRole("main").getByRole("button", { name: "Sign out" })).toBeVisible();
});
