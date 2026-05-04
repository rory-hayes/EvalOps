import { describe, expect, it } from "vitest";
import { validateRunnableWorkspace } from "./schemas";
import type { EvallerWorkspace } from "./types";

describe("Evaller workspace validation", () => {
  it("blocks missing instructions, scenarios, criteria, and invalid quality bar", () => {
    const workspace = buildWorkspace({
      instructions: "",
      scenarios: [],
      successCriteria: [],
      qualityBar: 101,
    });

    const validation = validateRunnableWorkspace(workspace);

    expect(validation.ok).toBe(false);
    expect(validation.issues).toEqual(
      expect.arrayContaining([
        "Add the AI instructions before running a test.",
        "Add at least one user scenario.",
        "Add at least one success criterion.",
        "Set the quality bar between 50 and 100.",
      ]),
    );
  });

  it("accepts a complete support AI test draft", () => {
    const validation = validateRunnableWorkspace(buildWorkspace({}));
    expect(validation.ok).toBe(true);
    expect(validation.issues).toEqual([]);
  });
});

function buildWorkspace(overrides: {
  instructions?: string;
  scenarios?: EvallerWorkspace["scenarios"];
  successCriteria?: EvallerWorkspace["successCriteria"];
  qualityBar?: number;
}): EvallerWorkspace {
  const now = "2026-05-04T12:00:00.000Z";
  return {
    user: { id: "user_1", email: "founder@example.test" },
    aiTest: {
      id: "ai_test_1",
      organizationId: "org_1",
      ownerUserId: "user_1",
      name: "Support AI",
      description: "Test support AI.",
      qualityBar: overrides.qualityBar ?? 80,
      activePromptVersionId: "prompt_1",
      createdAt: now,
      updatedAt: now,
    },
    activePrompt: {
      id: "prompt_1",
      aiTestId: "ai_test_1",
      organizationId: "org_1",
      version: 1,
      label: "Prompt v1",
      instructions: overrides.instructions ?? "Offer safe support answers.",
      isActive: true,
      createdAt: now,
    },
    promptVersions: [],
    scenarios: overrides.scenarios ?? [
      {
        id: "scenario_1",
        aiTestId: "ai_test_1",
        organizationId: "org_1",
        title: "Billing",
        message: "I was charged twice.",
        expectedBehavior: "",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    successCriteria: overrides.successCriteria ?? [
      {
        id: "criterion_1",
        aiTestId: "ai_test_1",
        organizationId: "org_1",
        text: "Offers a human handoff for billing, privacy, or urgent issues",
        sortOrder: 0,
        createdAt: now,
        updatedAt: now,
      },
    ],
    runs: [],
    membershipRole: "owner",
    members: [],
    invitations: [],
  };
}
