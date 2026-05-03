import { canPerformPermission, type OrganizationRole } from "../permissions";

export type BillingPlanId = "starter" | "growth";

export type BillingStatus =
  | "setup_required"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete";

export type UsageMetric = "projects" | "uploads" | "exports" | "openai_generations" | "seats";

export type PlanLimits = Record<UsageMetric, number>;

export const BILLING_PLAN_LIMITS = {
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
} as const satisfies Record<BillingPlanId, PlanLimits>;

const BILLING_PLAN_IDS = new Set<BillingPlanId>(["starter", "growth"]);
const BILLING_STATUSES = new Set<BillingStatus>([
  "setup_required",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "incomplete",
]);

export function isBillingPlanId(value: string): value is BillingPlanId {
  return BILLING_PLAN_IDS.has(value as BillingPlanId);
}

export function isBillingStatus(value: string): value is BillingStatus {
  return BILLING_STATUSES.has(value as BillingStatus);
}

export function getPlanLimit(planId: BillingPlanId, metric: UsageMetric): number {
  return BILLING_PLAN_LIMITS[planId][metric];
}

export function canUseBillingFeatures(status: BillingStatus): boolean {
  return status === "trialing" || status === "active";
}

export function canAccessBilling(role: OrganizationRole): boolean {
  return canPerformPermission(role, "manageBilling");
}
