import { getPlanLimit, type BillingPlanId, type UsageMetric } from "./plans";

export type MonthlyPeriod = {
  periodStart: string;
  periodEnd: string;
};

export type UsageEvent = {
  metric: UsageMetric;
  quantity: number;
  occurredAt: string | Date;
};

export type UsageSummary = Record<UsageMetric, number>;

export type QuotaDecisionInput = {
  planId: BillingPlanId;
  metric: UsageMetric;
  currentUsage: number;
  quantity?: number;
};

export type QuotaDecision = {
  allowed: boolean;
  limit: number;
  remaining: number;
  nextUsage: number;
  reason?: "quota_exceeded";
};

export function getCurrentMonthlyPeriod(now: Date = new Date()): MonthlyPeriod {
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  return {
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
  };
}

export function summarizeUsage(events: readonly UsageEvent[], period: MonthlyPeriod): UsageSummary {
  const summary = createEmptyUsageSummary();
  const periodStart = new Date(period.periodStart).getTime();
  const periodEnd = new Date(period.periodEnd).getTime();

  for (const event of events) {
    const occurredAt = new Date(event.occurredAt).getTime();

    if (occurredAt >= periodStart && occurredAt < periodEnd) {
      summary[event.metric] += event.quantity;
    }
  }

  return summary;
}

export function canConsumeQuota(input: QuotaDecisionInput): QuotaDecision {
  const quantity = input.quantity ?? 1;
  const limit = getPlanLimit(input.planId, input.metric);
  const nextUsage = input.currentUsage + quantity;
  const remaining = Math.max(limit - input.currentUsage, 0);

  if (nextUsage > limit) {
    return {
      allowed: false,
      limit,
      remaining,
      nextUsage,
      reason: "quota_exceeded",
    };
  }

  return {
    allowed: true,
    limit,
    remaining,
    nextUsage,
  };
}

export function createEmptyUsageSummary(): UsageSummary {
  return {
    projects: 0,
    uploads: 0,
    exports: 0,
    openai_generations: 0,
    seats: 0,
  };
}
