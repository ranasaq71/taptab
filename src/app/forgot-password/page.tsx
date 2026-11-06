import Link from "next/link";
import AuthForm from "../login/AuthForm";
import { sendReset } from "../login/actions";

export const metadata = { title: "Reset password · TapTab" };

export default function Forgot() {
  return (
    <main className="auth">
      <Link href="/" className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</Link>
      <h1>Reset your password</h1>
      <p className="muted">We’ll email you a link to choose a new one.</p>
      <AuthForm action={sendReset} submit="Send reset link" fields={[{ name: "email", label: "Email", type: "email", autoComplete: "email" }]} />
      <p className="links"><Link href="/login">Back to sign in</Link></p>
    </main>
  );
}
