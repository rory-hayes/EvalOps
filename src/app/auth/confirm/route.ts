import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { resolveAuthRedirectPath } from "@/app/login/redirects";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const redirectTo = request.nextUrl.clone();
  applyRedirectPath(redirectTo, resolveAuthRedirectPath(searchParams.get("next") || "/onboarding"));

  const supabase = await createSupabaseServerClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  redirectTo.pathname = "/login";
  redirectTo.searchParams.set("error", "The sign-in link is invalid or expired.");
  return NextResponse.redirect(redirectTo);
}

function applyRedirectPath(url: URL, path: string) {
  const resolved = new URL(path, "https://evalops.local");
  url.pathname = resolved.pathname;
  url.search = resolved.search;
  url.hash = resolved.hash;
}
