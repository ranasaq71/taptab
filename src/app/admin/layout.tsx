import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import SignOut from "@/components/SignOut";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="shell">
      <header className="shell-top no-print">
        <Link href="/admin" className="wordmark">TapTab</Link>
        <span className="org">Admin</span>
        <nav className="shell-nav"><Link href="/admin">Restaurants</Link><SignOut /></nav>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
