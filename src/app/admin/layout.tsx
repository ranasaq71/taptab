import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import SignOut from "@/components/SignOut";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="shell">
      <header className="shell-top no-print">
        <Link href="/admin" className="wordmark"><img src="/brand/taptab-icon.png" alt="" width={30} height={28} />TapTab</Link>
        <span className="org">Admin</span>
        <nav className="shell-nav"><Link href="/admin">Restaurants</Link><Link href="/admin/guests">Guests</Link><SignOut /></nav>
      </header>
      <main className="shell-main">{children}</main>
    </div>
  );
}
