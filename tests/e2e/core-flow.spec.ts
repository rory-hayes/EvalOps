import { expect, test } from "@playwright/test";

test("user completes Eval Debt Audit flow end to end", async ({ page }) => {
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "Projects", exact: true })).toBeVisible();
  await page.getByRole("button", { name: /create project/i }).click();
  await expect(page.getByText("Selected")).toBeVisible();

  await page.goto("/trace-import");
  await page.locator('input[type="file"]').setInputFiles({
    name: "support.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "conversation_id,user_input,assistant_output\n" +
        "c_1,I asked three times and this is still not fixed,Try restarting the app.",
    ),
  });
  await page.getByRole("button", { name: /upload and process/i }).click();
  await expect(page.getByText("completed").first()).toBeVisible();
  await expect(page.getByText("Escalation").first()).toBeVisible();

  await page.goto("/eval-builder");
  await expect(page.getByText("Escalation handoff missing")).toBeVisible();
  await page.getByRole("button", { name: "Resolve" }).click();
  await expect(page.getByText("resolved").first()).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /export csv/i }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toContain("support-assistant-audit");

  await page.goto("/reports");
  await expect(page.getByRole("heading", { name: "Audit Report", exact: true })).toBeVisible();
  await expect(page.getByText("issue.resolved")).toBeVisible();
  await expect(page.getByText("export.generated")).toBeVisible();
});
