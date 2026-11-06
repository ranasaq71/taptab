import Link from "next/link";
import AuthForm from "./AuthForm";
import { signIn } from "./actions";

export const metadata = { title: "Sign in · TapTab" };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <main className="auth">
      <Link href="/" className="wordmark">TapTab</Link>
      <h1>Sign in</h1>
      {error && <p className="error">That link has expired or was opened in a different browser. If you just confirmed your email, simply sign in below.</p>}
      <AuthForm action={signIn} submit="Sign in" hidden={{ next: next ?? "/app" }} fields={[
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password", type: "password", autoComplete: "current-password" },
      ]} />
      <p className="links"><Link href="/forgot-password">Forgot password?</Link> · <Link href="/signup">Create an account</Link></p>
    </main>
  );
}
