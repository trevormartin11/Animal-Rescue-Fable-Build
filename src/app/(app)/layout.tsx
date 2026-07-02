import Link from "next/link";
import { LogOut } from "lucide-react";
import { Nav } from "@/components/Nav";
import { BiscuitLogo } from "@/components/BiscuitLogo";
import { SyncNowButton } from "@/components/SyncNowButton";
import { logout } from "@/app/actions/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen md:grid md:grid-cols-[230px_1fr]">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col gap-6 border-r border-line bg-surface/60 px-4 py-6 sticky top-0 h-screen">
        <Link href="/" className="flex items-center gap-2.5 px-2">
          <BiscuitLogo size={34} />
          <div>
            <div className="font-display text-2xl font-semibold leading-none">Biscuit</div>
            <div className="text-[11px] font-bold text-muted mt-0.5">Rowley Family Giving</div>
          </div>
        </Link>
        <Nav />
        <div className="mt-auto space-y-3 px-2">
          <div className="text-xs text-muted truncate">{user?.email}</div>
          <form action={logout}>
            <button className="flex items-center gap-2 text-sm font-bold text-ink-soft hover:text-accent-deep transition-colors">
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col min-h-screen">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-cream/95 backdrop-blur px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <BiscuitLogo size={26} />
            <span className="font-display text-xl font-semibold">Biscuit</span>
          </Link>
          <SyncNowButton />
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8 pb-24 md:pb-8 max-w-5xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
