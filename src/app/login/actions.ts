"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext, siteUrl } from "@/lib/site";

export type FormState = { error?: string; message?: string };
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function signIn(_: FormState, f: FormData): Promise<FormState> {
  const db = await supabaseServer();
  const { error } = await db.auth.signInWithPassword({ email: str(f, "email"), password: String(f.get("password") ?? "") });
  if (error) return { error: error.message === "Email not confirmed" ? "Please confirm your email first. Check your inbox." : "Wrong email or password." };
  redirect(safeNext(str(f, "next")));
}

export async function signUp(_: FormState, f: FormData): Promise<FormState> {
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const db = await supabaseServer();
  const { data, error } = await db.auth.signUp({
    email: str(f, "email"), password,
    options: { data: { full_name: str(f, "name") }, emailRedirectTo: `${await siteUrl()}/auth/confirm?next=/app` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect("/app"); // email confirmation turned off
  return { message: "Check your email and click the link to confirm your account." };
}

export async function sendReset(_: FormState, f: FormData): Promise<FormState> {
  const db = await supabaseServer();
  await db.auth.resetPasswordForEmail(str(f, "email"), { redirectTo: `${await siteUrl()}/auth/confirm?next=/reset-password` });
  // Same message either way, so nobody can use this form to check who has an account.
  return { message: "If that email has an account, a reset link is on its way." };
}

export async function updatePassword(_: FormState, f: FormData): Promise<FormState> {
  const password = String(f.get("password") ?? "");
  if (password.length < 8) return { error: "Use at least 8 characters." };
  if (password !== String(f.get("confirm") ?? "")) return { error: "The two passwords don’t match." };
  const db = await supabaseServer();
  const { error } = await db.auth.updateUser({ password });
  if (error) return { error: error.message };
  redirect("/app");
}
