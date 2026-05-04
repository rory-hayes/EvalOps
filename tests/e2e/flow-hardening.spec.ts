import { expect, type Page, type Route, test } from "@playwright/test";

test.setTimeout(120_000);

async function useIsolatedWorkspace(page: Page, key: string) {
  await page.setExtraHTTPHeaders({
    "x-evalops-test-user-id": `user_${key}`,
    "x-evalops-test-email": `${key}@example.test`,
    "x-evalops-test-org-id": `org_${key}`,
  });
}

function apiFailure(message: string) {
  return {
    ok: false,
    error: {
      code: "test_failure",
      message,
    },
  };
}

async function fulfillApiFailure(route: Route, message: string) {
  await route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify(apiFailure(message)),
  });
}

test("validation guardrails keep incomplete AI tests from running", async ({ page }) => {
  await useIsolatedWorkspace(page, "validation-guardrails");
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeEnabled();

  await page.getByRole("button", { name: "Add user scenario" }).click();
  await expect(page.getByText("Complete or delete empty user scenarios.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();

  await page.reload();
  await page.getByRole("button", { name: "Add success criterion" }).click();
  await expect(page.getByText("Complete or delete empty success criteria.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();

  await page.reload();
  await page.getByLabel("Quality bar value").fill("101");
  await expect(page.getByText("Set the quality bar between 50 and 100.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();
  await page.getByLabel("Quality bar value").blur();
  await expect(page.getByLabel("Quality bar value")).toHaveValue("100");

  await page.getByLabel("Quality bar value").fill("40");
  await expect(page.getByText("Set the quality bar between 50 and 100.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();
  await page.getByLabel("Quality bar value").blur();
  await expect(page.getByLabel("Quality bar value")).toHaveValue("50");

  await page.reload();
  await page.getByLabel("Delete scenario 3").click();
  await page.getByLabel("Delete scenario 2").click();
  await page.getByLabel("Delete scenario 1").click();
  await expect(page.getByText("Add at least one user scenario.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();

  await page.reload();
  await page.getByLabel("Delete success criterion 4").click();
  await page.getByLabel("Delete success criterion 3").click();
  await page.getByLabel("Delete success criterion 2").click();
  await page.getByLabel("Delete success criterion 1").click();
  await expect(page.getByText("Add at least one success criterion.").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeDisabled();
});

test("autosave preserves edited workspace inputs without a manual save", async ({ page }) => {
  await useIsolatedWorkspace(page, "autosave-edits");
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();

  const autosaveResponse = page.waitForResponse((response) =>
    response.url().includes("/api/evaller/workspace") && response.request().method() === "PUT",
  );
  await page.getByLabel("AI test name").fill("Autosaved Support Bot");
  await page.getByLabel("What are you testing?").fill("Whether unsaved edits survive refresh without a manual save.");
  await page.getByLabel("AI instructions").fill("You are a support AI. Offer a human handoff for risky account actions.");
  await autosaveResponse;
  await expect(page.getByText("Saved", { exact: true }).last()).toBeVisible({ timeout: 15_000 });

  await page.reload();
  await expect(page.getByLabel("AI test name")).toHaveValue("Autosaved Support Bot");
  await expect(page.getByLabel("What are you testing?")).toHaveValue("Whether unsaved edits survive refresh without a manual save.");
  await expect(page.getByLabel("AI instructions")).toHaveValue("You are a support AI. Offer a human handoff for risky account actions.");
});

test("value loop persists saved context, applied fixes, reruns, and prompt history", async ({ page }) => {
  await useIsolatedWorkspace(page, "value-persistence");
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();

  await page.getByLabel("AI test name").fill("Persistence Support Bot");
  await page.getByLabel("What are you testing?").fill("Whether prompt fixes improve support quality and remain visible after refresh.");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Workspace saved.")).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("AI test name")).toHaveValue("Persistence Support Bot");
  await expect(page.getByLabel("What are you testing?")).toHaveValue("Whether prompt fixes improve support quality and remain visible after refresh.");

  await page.getByRole("button", { name: "Run AI Test" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("0%", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Failure patterns")).toBeVisible();
  await expect(page.getByText("Missing acknowledges user frustration or urgency")).toBeVisible();
  await expect(page.getByText("Suggested prompt fixes")).toBeVisible();
  await expect(page.getByText("Add explicit support handoff and safety rules")).toBeVisible();
  await expect(page.getByText("Acknowledge user frustration or urgency before solving.")).toBeVisible();
  await expect(page.getByText("Missed:").first()).toBeVisible();

  await page.getByRole("button", { name: "Apply fix" }).first().click();
  await expect(page.getByText("Prompt fix applied. Run again to compare the next result.")).toBeVisible();
  await expect(page.getByLabel("AI instructions")).toHaveValue(/Evaller improvement/);

  await page.reload();
  await expect(page.getByLabel("AI instructions")).toHaveValue(/Evaller improvement/);
  await expect(page.getByRole("button", { name: "Applied" })).toBeVisible();

  await page.getByRole("button", { name: "Run Again" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("+100% pass-rate change from the previous run.")).toBeVisible();
  await expect(page.getByText("AI Release Readiness Report")).toBeVisible();
  await expect(page.getByText("Ready for release review")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply fix" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy report" })).toBeVisible();

  await page.getByLabel("Review comment").fill("Ready for support release review.");
  await page.getByRole("button", { name: "Add comment" }).click();
  await expect(page.getByText("Review comment added.")).toBeVisible();
  await expect(page.getByText("Ready for support release review.")).toBeVisible();

  await page.getByLabel("Approval note").fill("Approved for launch.");
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("Readiness report approved.")).toBeVisible();
  await expect(page.getByText("Approved").first()).toBeVisible();

  await page.reload();
  await expect(page.getByText("+100% pass-rate change from the previous run.")).toBeVisible();
  await expect(page.getByText("No open scenario failures in the latest run.")).toBeVisible();
  await expect(page.getByText("Approved").first()).toBeVisible();
  await expect(page.getByText("Ready for support release review.")).toBeVisible();

  await page.getByRole("link", { name: "Runs" }).click();
  await expect(page.getByText("Run History")).toBeVisible();
  await expect(page.getByText("Prompt v2: Add explicit support handoff and safety rules").first()).toBeVisible();
  await expect(page.getByText("Prompt v1")).toBeVisible();
  await expect(page.getByText("AI Release Readiness Report")).toBeVisible();
  await expect(page.getByText("Selected Run")).toBeVisible();

  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { name: "Prompt Versions" })).toBeVisible();
  await page.getByText("Prompt v1").first().click();
  await expect(page.getByText("Compare with Prompt v1")).toBeVisible();
  await expect(page.getByText(/Acknowledge user frustration or urgency before solving/)).toBeVisible();
  await page.getByRole("button", { name: "Restore as new active version" }).click();
  await expect(page.getByText("Prompt version restored as a new active version.")).toBeVisible();
  await expect(page.getByText("Prompt v3: Restore Prompt v1").first()).toBeVisible();
});

test("transient API failures are visible and recoverable", async ({ page }) => {
  await useIsolatedWorkspace(page, "api-recovery");

  const workspaceFailure = async (route: Route) => {
    await fulfillApiFailure(route, "Simulated workspace outage.");
  };
  await page.route("**/api/evaller/workspace", workspaceFailure);
  await page.goto("/workspace");
  await expect(page.getByText("Simulated workspace outage.")).toBeVisible();

  await page.unroute("**/api/evaller/workspace", workspaceFailure);
  await page.getByText("Refresh", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Run AI Test" })).toBeEnabled();

  const runFailure = async (route: Route) => {
    if (route.request().method() === "POST") {
      await fulfillApiFailure(route, "Simulated run outage.");
    } else {
      await route.fallback();
    }
  };
  await page.route("**/api/evals/run", runFailure);
  await page.getByRole("button", { name: "Run AI Test" }).click();
  await expect(page.getByText("Simulated run outage.")).toBeVisible();

  await page.unroute("**/api/evals/run", runFailure);
  await page.getByRole("button", { name: "Run AI Test" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Apply fix" }).first()).toBeVisible();

  const applyFixFailure = async (route: Route) => {
    await fulfillApiFailure(route, "Simulated apply-fix outage.");
  };
  await page.route("**/api/evals/run/*/apply-fix", applyFixFailure);
  await page.getByRole("button", { name: "Apply fix" }).first().click();
  await expect(page.getByText("Simulated apply-fix outage.")).toBeVisible();

  await page.unroute("**/api/evals/run/*/apply-fix", applyFixFailure);
  await page.getByRole("button", { name: "Apply fix" }).first().click();
  await expect(page.getByText("Prompt fix applied. Run again to compare the next result.")).toBeVisible();
});

test("mobile users can complete the run, fix, rerun, and history flow", async ({ page }) => {
  await useIsolatedWorkspace(page, "mobile-flow");
  await page.setViewportSize({ width: 390, height: 820 });
  await page.goto("/workspace");
  await expect(page.getByRole("heading", { name: "Workspace" })).toBeVisible();

  await page.getByRole("button", { name: "Run AI Test" }).click();
  await expect(page.getByText("AI test run completed.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Failure patterns")).toBeVisible();

  await page.getByRole("button", { name: "Apply fix" }).first().click();
  await expect(page.getByText("Prompt fix applied. Run again to compare the next result.")).toBeVisible();

  await page.getByRole("button", { name: "Run Again" }).click();
  await expect(page.getByText("+100% pass-rate change from the previous run.")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("AI Release Readiness Report")).toBeVisible();

  await page.getByRole("link", { name: "Runs" }).click();
  await expect(page.getByRole("heading", { name: "Runs" })).toBeVisible();
  await expect(page.getByText("Prompt v2: Add explicit support handoff and safety rules").first()).toBeVisible();
  await expect(page.getByText("Ready for release review")).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
