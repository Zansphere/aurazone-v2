"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, ShoppingCart, Heart, MapPin, ArrowLeft, LogIn } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";

const ACCOUNT_TABS = [
  { href: "/profile",   label: "Profile",   icon: User },
  { href: "/orders",    label: "Orders",    icon: ShoppingCart },
  { href: "/wishlist",  label: "Wishlist",  icon: Heart },
  { href: "/addresses", label: "Addresses", icon: MapPin },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();

  return (
    <div className="section-container py-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors"
      >
        <ArrowLeft size={14} /> Back to shop
      </Link>
      
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            {isAuthenticated ? "My Account" : "Account & Orders"}
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
            {isAuthenticated
              ? `Signed in as ${user?.fullName || user?.email}`
              : "Browsing as Guest — Track orders or sign in to customize profile"}
          </p>
        </div>

        {!isAuthenticated && (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
            >
              <LogIn size={14} /> Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 py-2 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              Create Account
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden md:block w-52 shrink-0 space-y-3">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-3 space-y-1">
            {ACCOUNT_TABS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/profile" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)]"
                  }`}
                >
                  <Icon size={16} /> {label}
                </Link>
              );
            })}
          </div>

          {!isAuthenticated && (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 text-xs text-[var(--color-text-secondary)] space-y-2">
              <span className="inline-block rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2 py-0.5 text-[10px] font-semibold">
                Guest Mode
              </span>
              <p>
                Sign in to save addresses, manage preferences, and sync your orders across devices.
              </p>
              <Link
                href="/login"
                className="block text-center rounded-lg bg-[var(--color-bg-muted)] py-1.5 font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
              >
                Sign In Now
              </Link>
            </div>
          )}
        </aside>

        {/* Mobile tab pills */}
        <div className="md:hidden flex gap-1.5 overflow-x-auto pb-2 mb-2 w-full scrollbar-hide">
          {ACCOUNT_TABS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/profile" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                  active
                    ? "bg-[var(--color-primary)] text-white shadow-sm"
                    : "bg-[var(--color-bg-surface)] border border-[var(--color-border)] text-[var(--color-text-secondary)]"
                }`}
              >
                <Icon size={14} /> {label}
              </Link>
            );
          })}
        </div>

        {/* Page content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}