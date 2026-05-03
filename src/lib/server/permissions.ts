export type OrganizationRole = "owner" | "admin" | "member" | "reviewer";

export type RolePermission =
  | "manageBilling"
  | "manageProjects"
  | "manageMembers"
  | "manageSettings"
  | "uploadTraces"
  | "runGenerations"
  | "exportReports"
  | "reviewEvals"
  | "viewReports";

export type RolePermissionSet = Record<RolePermission, boolean>;

export const ROLE_PERMISSIONS = {
  owner: {
    manageBilling: true,
    manageProjects: true,
    manageMembers: true,
    manageSettings: true,
    uploadTraces: true,
    runGenerations: true,
    exportReports: true,
    reviewEvals: true,
    viewReports: true,
  },
  admin: {
    manageBilling: false,
    manageProjects: true,
    manageMembers: true,
    manageSettings: true,
    uploadTraces: true,
    runGenerations: true,
    exportReports: true,
    reviewEvals: true,
    viewReports: true,
  },
  member: {
    manageBilling: false,
    manageProjects: true,
    manageMembers: false,
    manageSettings: false,
    uploadTraces: true,
    runGenerations: true,
    exportReports: true,
    reviewEvals: true,
    viewReports: true,
  },
  reviewer: {
    manageBilling: false,
    manageProjects: false,
    manageMembers: false,
    manageSettings: false,
    uploadTraces: false,
    runGenerations: false,
    exportReports: false,
    reviewEvals: true,
    viewReports: true,
  },
} as const satisfies Record<OrganizationRole, RolePermissionSet>;

export function canPerformPermission(role: OrganizationRole, permission: RolePermission): boolean {
  return ROLE_PERMISSIONS[role][permission];
}
