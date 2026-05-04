const DEFAULT_AUTH_REDIRECT = "/workspace";

const WORKSPACE_PATHS = [
  "/workspace",
  "/runs",
  "/templates",
  "/settings",
];

export function resolveAuthRedirectPath(next: string) {
  if (!next.startsWith("/") || next.startsWith("//")) return DEFAULT_AUTH_REDIRECT;

  try {
    const url = new URL(next, "https://evaller.local");
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
