import { describe, expect, it } from "vitest";
import {
  BILLING_PLAN_LIMITS,
  canAccessBilling,
  canUseBillingFeatures,
  getPlanLimit,
  isBillingPlanId,
  isBillingStatus,
} from "./plans";
import {
  canInviteRole,
  createInviteTokenHash,
  isInviteExpired,
  verifyInviteToken,
} from "./invites";
import {
  canPerformPermission,
  ROLE_PERMISSIONS,
} from "../permissions";
import {
  canConsumeQuota,
  getCurrentMonthlyPeriod,
  summarizeUsage,
} from "./usage";

describe("commercial plan helpers", () => {
  it("exposes the exact Milestone 6 plan defaults", () => {
    expect(BILLING_PLAN_LIMITS).toEqual({
      starter: {
        seats: 3,
        projects: 3,
        uploads: 25,
        exports: 20,
        openai_generations: 100,
      },
      growth: {
        seats: 10,
        projects: 15,
        uploads: 250,
        exports: 100,
        openai_generations: 1000,
      },
    });
    expect(getPlanLimit("starter", "uploads")).toBe(25);
    expect(getPlanLimit("growth", "openai_generations")).toBe(1000);
    expect(isBillingPlanId("starter")).toBe(true);
    expect(isBillingPlanId("enterprise")).toBe(false);
    expect(isBillingStatus("past_due")).toBe(true);
    expect(isBillingStatus("paused")).toBe(false);
  });

  it("gates billing-backed features by status", () => {
    expect(canUseBillingFeatures("setup_required")).toBe(false);
    expect(canUseBillingFeatures("trialing")).toBe(true);
    expect(canUseBillingFeatures("active")).toBe(true);
    expect(canUseBillingFeatures("past_due")).toBe(false);
    expect(canUseBillingFeatures("canceled")).toBe(false);
    expect(canUseBillingFeatures("incomplete")).toBe(false);
    expect(canAccessBilling("owner")).toBe(true);
    expect(canAccessBilling("admin")).toBe(false);
    expect(canAccessBilling("member")).toBe(false);
    expect(canAccessBilling("reviewer")).toBe(false);
  });
});

describe("commercial usage helpers", () => {
  it("returns deterministic UTC monthly period bounds", () => {
    expect(getCurrentMonthlyPeriod(new Date("2026-05-18T14:32:11.000Z"))).toEqual({
      periodStart: "2026-05-01T00:00:00.000Z",
      periodEnd: "2026-06-01T00:00:00.000Z",
    });
  });

  it("summarizes only usage inside the period", () => {
    const period = getCurrentMonthlyPeriod(new Date("2026-05-18T14:32:11.000Z"));

    expect(
      summarizeUsage(
        [
          { metric: "uploads", quantity: 2, occurredAt: "2026-04-30T23:59:59.999Z" },
          { metric: "uploads", quantity: 3, occurredAt: "2026-05-01T00:00:00.000Z" },
          { metric: "uploads", quantity: 4, occurredAt: "2026-05-20T08:00:00.000Z" },
          { metric: "exports", quantity: 1, occurredAt: "2026-05-20T08:00:00.000Z" },
          { metric: "uploads", quantity: 9, occurredAt: "2026-06-01T00:00:00.000Z" },
        ],
        period,
      ),
    ).toEqual({
      projects: 0,
      uploads: 7,
      exports: 1,
      openai_generations: 0,
      seats: 0,
    });
  });

  it("returns quota decisions for allowed, exact, and exceeded usage", () => {
    expect(canConsumeQuota({ planId: "starter", metric: "uploads", currentUsage: 24 })).toEqual({
      allowed: true,
      limit: 25,
      remaining: 1,
      nextUsage: 25,
    });
    expect(canConsumeQuota({ planId: "starter", metric: "uploads", currentUsage: 25 })).toEqual({
      allowed: false,
      limit: 25,
      remaining: 0,
      nextUsage: 26,
      reason: "quota_exceeded",
    });
    expect(canConsumeQuota({ planId: "growth", metric: "projects", currentUsage: 14, quantity: 2 })).toEqual({
      allowed: false,
      limit: 15,
      remaining: 1,
      nextUsage: 16,
      reason: "quota_exceeded",
    });
  });
});

describe("commercial invite helpers", () => {
  it("hashes and verifies invite tokens without exposing the original token", () => {
    const token = "invite_token_123";
    const hash = createInviteTokenHash(token);

    expect(hash).not.toBe(token);
    expect(hash).toHaveLength(64);
    expect(verifyInviteToken(token, hash)).toBe(true);
    expect(verifyInviteToken("wrong_token", hash)).toBe(false);
  });

  it("checks invite expiration using exclusive expiry bounds", () => {
    expect(isInviteExpired("2026-05-03T12:00:00.000Z", new Date("2026-05-03T11:59:59.999Z"))).toBe(false);
    expect(isInviteExpired("2026-05-03T12:00:00.000Z", new Date("2026-05-03T12:00:00.000Z"))).toBe(true);
  });

  it("prevents lower roles from inviting privileged roles", () => {
    expect(canInviteRole({ inviterRole: "owner", inviteeRole: "admin" })).toBe(true);
    expect(canInviteRole({ inviterRole: "admin", inviteeRole: "member" })).toBe(true);
    expect(canInviteRole({ inviterRole: "admin", inviteeRole: "owner" })).toBe(false);
    expect(canInviteRole({ inviterRole: "member", inviteeRole: "reviewer" })).toBe(false);
  });
});

describe("role permission helpers", () => {
  it("defines the role permission matrix", () => {
    expect(ROLE_PERMISSIONS.owner).toEqual({
      manageBilling: true,
      manageProjects: true,
      manageMembers: true,
      manageSettings: true,
      uploadTraces: true,
      runGenerations: true,
      exportReports: true,
      reviewEvals: true,
      viewReports: true,
    });
    expect(ROLE_PERMISSIONS.admin.manageBilling).toBe(false);
    expect(ROLE_PERMISSIONS.member.manageBilling).toBe(false);
    expect(ROLE_PERMISSIONS.member.reviewEvals).toBe(true);
    expect(ROLE_PERMISSIONS.reviewer.reviewEvals).toBe(true);
    expect(ROLE_PERMISSIONS.reviewer.uploadTraces).toBe(false);
  });

  it("checks permissions by role", () => {
    expect(canPerformPermission("owner", "manageMembers")).toBe(true);
    expect(canPerformPermission("admin", "manageSettings")).toBe(true);
    expect(canPerformPermission("member", "runGenerations")).toBe(true);
    expect(canPerformPermission("member", "manageMembers")).toBe(false);
    expect(canPerformPermission("reviewer", "viewReports")).toBe(true);
    expect(canPerformPermission("reviewer", "exportReports")).toBe(false);
  });
});
