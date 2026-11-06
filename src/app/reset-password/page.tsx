import AuthForm from "../login/AuthForm";
import { updatePassword } from "../login/actions";

export const metadata = { title: "Choose a password · TapTab" };

export default function Reset() {
  return (
    <main className="auth">
      <span className="wordmark">TapTab</span>
      <h1>Choose a password</h1>
      <AuthForm action={updatePassword} submit="Save password" fields={[
        { name: "password", label: "New password (8+ characters)", type: "password", autoComplete: "new-password" },
        { name: "confirm", label: "Type it again", type: "password", autoComplete: "new-password" },
      ]} />
    </main>
  );
}
