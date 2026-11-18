import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser, resolveDashboard } from "@/lib/auth/session";
import SignOut from "@/components/SignOut";
import { exitSupport } from "@/app/admin/support";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await requireUser("/dashboard");
  const d = await resolveDashboard(s);
  if (!d) redirect(s.isAdmin ? "/admin" : "/app");
  const editor = d.role === "owner" || d.role === "manager";
  // Unread guest notes for the badge (the security rules hide notes from staff anyway).
  const unread = editor ? (await s.db.from("guest_notes").select("id", { count: "exact", head: true }).eq("location_id", d.location.id).is("read_at", null)).count ?? 0 : 0;
  return (
    <div className="shell">
      {d.support && (
        <div className="support-bar">
          <span>🛟 <b>Support mode:</b> you’re viewing <b>{d.location.name}</b> as TapTab admin. Changes you make here are real.</span>
          <form action={exitSupport}><button className="btn-sm">Exit to admin</button></form>
        </div>
      )}
      <header className="shell-top">
        <Link href="/dashboard" className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</Link>
        <span className="org">{d.location.name}</span>
        <nav className="shell-nav">
          <Link href="/dashboard">Overview</Link>
          <Link href="/dashboard/live">Live</Link>
          {editor && <Link href="/dashboard/analytics">Analytics</Link>}
          {editor && <Link href="/dashboard/hub">Hub</Link>}
          {editor && <Link href="/dashboard/menu">Menu</Link>}
          {editor && <Link href="/dashboard/tables">Tables</Link>}
          {editor && <Link href="/dashboard/staff">Staff</Link>}
          {editor && <Link href="/dashboard/notes">Notes{unread ? <span className="nav-badge">{unread}</span> : null}</Link>}
          {editor && <Link href="/dashboard/reviews">Reviews</Link>}
          {editor && <Link href="/dashboard/rewards">Rewards</Link>}
          {d.role === "owner" && <Link href="/dashboard/team">Team</Link>}
          {s.isAdmin && <Link href="/admin">Admin</Link>}
          <Link href="/reset-password">Password</Link>
          <SignOut />
        </nav>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
