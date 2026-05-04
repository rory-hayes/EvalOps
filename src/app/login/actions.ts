"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasSupabasePublicConfig } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { resolveAuthRedirectPath } from "./redirects";

export async function login(formData: FormData) {
  if (!hasSupabasePublicConfig()) {
    redirectWithError("Supabase authentication is not configured.");
  }

  const credentials = readCredentials(formData);
  if (!credentials.ok) {
    redirectWithError(credentials.error);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(credentials.data);

  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath("/", "layout");
  redirect(resolveAuthRedirectPath(String(formData.get("next") || "")));
}

export async function signup(formData: FormData) {
  const next = resolveAuthRedirectPath(String(formData.get("next") || "/workspace"));
  const errorPath = signupErrorPath(formData, next);

  if (!hasSupabasePublicConfig()) {
    redirectWithError("Supabase authentication is not configured.", errorPath);
  }

  const credentials = readCredentials(formData);
  if (!credentials.ok) {
    redirectWithError(credentials.error, errorPath);
  }

  const supabase = await createSupabaseServerClient();
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin") || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const { data, error } = await supabase.auth.signUp({
    ...credentials.data,
    options: {
      emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    redirectWithError(error.message, errorPath);
  }

  revalidatePath("/", "layout");
  if (data.session) {
    redirect(next);
  }
  redirectWithMessage("Check your email to confirm your account, then sign in.", next);
}

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !email.includes("@")) {
    return { ok: false as const, error: "Enter a valid email address." };
  }

  if (password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  return { ok: true as const, data: { email, password } };
}

function redirectWithError(message: string, path = "/login"): never {
  const separator = path.includes("?") ? "&" : "?";
  redirect(`${path}${separator}error=${encodeURIComponent(message)}`);
}

function redirectWithMessage(message: string, next = "/workspace"): never {
  redirect(`/login?message=${encodeURIComponent(message)}&next=${encodeURIComponent(next)}`);
}

function signupErrorPath(formData: FormData, next: string) {
  return formData.get("source") === "signup"
    ? `/signup?next=${encodeURIComponent(next)}`
    : "/login";
}
