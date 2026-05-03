import { createHash, timingSafeEqual } from "node:crypto";
import type { OrganizationRole } from "../permissions";

const ROLE_RANKS = {
  owner: 4,
  admin: 3,
  member: 2,
  reviewer: 1,
} as const satisfies Record<OrganizationRole, number>;

export type InviteRoleDecisionInput = {
  inviterRole: OrganizationRole;
  inviteeRole: OrganizationRole;
};

export function createInviteTokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function verifyInviteToken(token: string, expectedHash: string): boolean {
  const actualHash = createInviteTokenHash(token);

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}

export function isInviteExpired(expiresAt: string | Date, now: Date = new Date()): boolean {
  return new Date(expiresAt).getTime() <= now.getTime();
}

export function canInviteRole(input: InviteRoleDecisionInput): boolean {
  if (input.inviterRole !== "owner" && input.inviterRole !== "admin") {
    return false;
  }

  return ROLE_RANKS[input.inviterRole] > ROLE_RANKS[input.inviteeRole];
}
