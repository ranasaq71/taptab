import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import SignOut from "@/components/SignOut";

/** Sends each person to the right place after signing in. */
export default async function AppHome() {
  const s = await requireUser();
  if (s.isAdmin) redirect("/admin");
  if (s.memberships.length) redirect("/dashboard");
  return (
    <main className="auth">
      <span className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</span>
      <h1>You’re signed in</h1>
      <p className="muted">Your account ({s.user.email}) isn’t connected to a restaurant yet. Ask the restaurant owner to invite you, or contact TapTab support.</p>
      <SignOut />
    </main>
  );
}
