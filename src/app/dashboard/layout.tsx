import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import SignOut from "@/components/SignOut";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser("/dashboard");
  if (!s.memberships.length) redirect(s.isAdmin ? "/admin" : "/app");
  const m = s.memberships[0];
  return (
    <div className="shell">
      <header className="shell-top">
        <Link href="/dashboard" className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</Link>
        <span className="org">{m.orgName}</span>
        <nav className="shell-nav">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/live">Live</Link>
          {(m.role === "owner" || m.role === "manager") && <Link href="/dashboard/hub">Hub</Link>}
          {(m.role === "owner" || m.role === "manager") && <Link href="/dashboard/menu">Menu</Link>}
          {(m.role === "owner" || m.role === "manager") && <Link href="/dashboard/tables">Tables</Link>}
          {(m.role === "owner" || m.role === "manager") && <Link href="/dashboard/staff">Staff</Link>}
          {m.role === "owner" && <Link href="/dashboard/team">Team</Link>}
          {s.isAdmin && <Link href="/admin">Admin</Link>}
          <SignOut />
        </nav>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
