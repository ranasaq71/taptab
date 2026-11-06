import Link from "next/link";
import AuthForm from "../login/AuthForm";
import { signUp } from "../login/actions";

export const metadata = { title: "Create account · TapTab" };

export default function Signup() {
  return (
    <main className="auth">
      <Link href="/" className="wordmark">TapTab</Link>
      <h1>Create your account</h1>
      <p className="muted">Restaurant owners: if TapTab invited you, use the link in your invite email instead.</p>
      <AuthForm action={signUp} submit="Create account" fields={[
        { name: "name", label: "Your name", autoComplete: "name" },
        { name: "email", label: "Email", type: "email", autoComplete: "email" },
        { name: "password", label: "Password (8+ characters)", type: "password", autoComplete: "new-password" },
      ]} />
      <p className="links">Already have an account? <Link href="/login">Sign in</Link></p>
    </main>
  );
}
