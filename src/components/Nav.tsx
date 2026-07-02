"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  PawPrint,
  Users,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cases", label: "Cases", icon: PawPrint },
  { href: "/owners", label: "Owners", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop sidebar links */}
      <nav className="hidden md:flex flex-col gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-colors ${
              isActive(href)
                ? "bg-accent-soft text-accent-deep"
                : "text-ink-soft hover:bg-accent-soft/50 hover:text-ink"
            }`}
          >
            <Icon size={18} strokeWidth={2.4} />
            {label}
          </Link>
        ))}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-surface/95 backdrop-blur border-t border-line flex justify-around pb-[env(safe-area-inset-bottom)]">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center gap-0.5 px-3 pt-2 pb-1.5 text-[11px] font-bold ${
              isActive(href) ? "text-accent-deep" : "text-muted"
            }`}
          >
            <Icon size={20} strokeWidth={2.4} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
