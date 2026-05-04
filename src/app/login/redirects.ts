const DEFAULT_AUTH_REDIRECT = "/projects";

const WORKSPACE_PATHS = [
  "/onboarding",
  "/dashboard",
  "/projects",
  "/trace-import",
  "/eval-builder",
  "/graders",
  "/prompt-optimizer",
  "/routing-caching",
  "/reports",
  "/settings",
];

export function resolveAuthRedirectPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_AUTH_REDIRECT;

  try {
    const url = new URL(next, "https://evalops.local");
    const pathname = url.pathname;
    const allowed = WORKSPACE_PATHS.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    );

    if (!allowed) return DEFAULT_AUTH_REDIRECT;

    return `${pathname}${url.search}${url.hash}`;
  } catch {
    return DEFAULT_AUTH_REDIRECT;
  }
}
