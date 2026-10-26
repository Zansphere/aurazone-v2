"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { Search, ShoppingCart, Heart, User, Menu, X, ChevronRight, LogOut, Package } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCartStore } from "@/stores/cart.store";
import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { SearchOverlay } from "./SearchOverlay";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { user, isAuthenticated, logout } = useAuthStore();
  const { cart, fetchCart } = useCartStore();
  const router = useRouter();

  // Global shortcut (Cmd+K / Ctrl+K) to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOverlayOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const { data: storesData } = useQuery({
    queryKey: ["stores", "navbar"],
    queryFn: () => api.get<any>("/stores?activeOnly=true"),
  });

  const activeStores = storesData?.data?.stores ?? [];
  const NAV_LINKS = [
    { href: "/products", label: "All Products" },
    ...activeStores.map((store: any) => ({
      href: `/store/${store.slug}`,
      label: store.name
    }))
  ];

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Cart icon badge displays the count of unique products in the cart
  const cartCount = new Set(
    cart?.items?.map((item) => item.productId || (item as any).variant?.product?.id || item.variantId)
  ).size;

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Lock body scroll when mobile drawer open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = async () => {
    await logout();
    setUserMenuOpen(false);
    router.push("/");
  };

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {isAuthenticated && user && !user.isEmailVerified && (
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 text-white text-[11px] font-medium py-1.5 px-4 text-center flex items-center justify-center gap-2 shadow-sm">
          <span>Please check your email inbox and click the verification link to activate your account.</span>
          <Link
            href={`/verify?sent=true&email=${encodeURIComponent(user.email)}`}
            className="underline font-bold text-amber-100 hover:text-white transition-colors ml-1"
          >
            View Instructions →
          </Link>
        </div>
      )}
      <header
        style={{ height: "var(--header-height)" }}
        className="relative w-full z-40 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)]/95 backdrop-blur-md px-4 md:px-8"
      >
        {/* Logo */}
        <Link href="/" className="text-lg font-bold font-[var(--font-heading)] text-[var(--color-text-primary)] shrink-0">
          AuraZone
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[var(--color-text-secondary)]">
          {NAV_LINKS.map(({ href, label }) => (
            <Link key={href} href={href} className="hover:text-[var(--color-text-primary)] transition-colors">
              {label}
            </Link>
          ))}
        </nav>

        {/* Right-side actions */}
        <div className="flex items-center gap-2">
          {/* Search Trigger (Live Elasticsearch Autocomplete) */}
          <button
            onClick={() => setSearchOverlayOpen(true)}
            className="hidden sm:flex items-center gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/60 px-3 py-1.5 text-xs text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-bg-muted)] transition-all mr-1"
          >
            <Search size={14} className="text-[var(--color-text-tertiary)]" />
            <span className="hidden md:inline">Search products, brands...</span>
            <kbd className="hidden lg:inline-flex items-center gap-0.5 text-[10px] font-mono bg-[var(--color-bg-surface)] px-1.5 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-tertiary)]">
              ⌘K
            </kbd>
          </button>

          {/* Mobile search icon */}
          <button
            onClick={() => setSearchOverlayOpen(true)}
            className="sm:hidden flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            aria-label="Search"
          >
            <Search size={18} />
          </button>
          <Link href="/wishlist" className="hidden md:flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors">
            <Heart size={18} />
          </Link>
          <button onClick={() => useCartStore.getState().setIsOpen(true)} className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors">
            <ShoppingCart size={18} />
            {cartCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--color-accent)] text-[9px] font-bold text-white">
                {cartCount > 9 ? "9+" : cartCount}
              </span>
            )}
          </button>

          {/* User menu */}
          {isAuthenticated ? (
            <div ref={userMenuRef} className="relative hidden md:block">
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-xs font-semibold hover:opacity-90 transition-opacity ml-1"
              >
                {initials}
              </button>
              {userMenuOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-lg)]"
                  style={{ animation: "dropdownIn 120ms ease-out both" }}
                >
                  <div className="border-b border-[var(--color-border)] px-3 py-2.5">
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{user?.fullName ?? "My Account"}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{user?.email}</p>
                  </div>
                  {[
                    { href: "/profile", label: "My Profile", icon: User },
                    { href: "/orders", label: "My Orders", icon: Package },
                    { href: "/wishlist", label: "Wishlist", icon: Heart },
                  ].map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                    >
                      <Icon size={14} className="text-[var(--color-text-tertiary)]" />
                      {label}
                    </Link>
                  ))}
                  <div className="border-t border-[var(--color-border)]">
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
                    >
                      <LogOut size={14} />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/profile"
              className="hidden md:flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              title="My Account"
              aria-label="My Account"
            >
              <User size={18} />
            </Link>
          )}

          {/* Hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex md:hidden h-9 w-9 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div
            className="absolute right-0 top-0 h-full w-72 bg-[var(--color-bg-surface)] shadow-[var(--shadow-xl)] flex flex-col"
            style={{ animation: "slideInRight 250ms ease-out both" }}
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
              <span className="text-base font-bold font-[var(--font-heading)]">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* User section */}
            {isAuthenticated ? (
              <div className="border-b border-[var(--color-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{user?.fullName ?? "My Account"}</p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] truncate">{user?.email}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-b border-[var(--color-border)] px-5 py-4 space-y-2">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Sign in
                </Link>
                <div className="flex gap-2">
                  <Link
                    href="/profile"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-muted)] rounded-lg transition-colors"
                  >
                    Guest Profile
                  </Link>
                  <Link
                    href="/track-order"
                    onClick={() => setMobileOpen(false)}
                    className="flex-1 text-center py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-muted)] rounded-lg transition-colors"
                  >
                    Track Order
                  </Link>
                </div>
              </div>
            )}

            {/* Nav links */}
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Shop</p>
              {NAV_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                >
                  {label}
                  <ChevronRight size={14} className="text-[var(--color-text-tertiary)]" />
                </Link>
              ))}

              {isAuthenticated && (
                <>
                  <p className="mt-4 px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">Account</p>
                  {[
                    { href: "/profile", label: "My Profile" },
                    { href: "/orders", label: "My Orders" },
                    { href: "/wishlist", label: "Wishlist" },
                    { href: "/addresses", label: "Addresses" },
                  ].map(({ href, label }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center justify-between rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
                    >
                      {label}
                      <ChevronRight size={14} className="text-[var(--color-text-tertiary)]" />
                    </Link>
                  ))}
                </>
              )}
            </nav>

            {/* Sign out */}
            {isAuthenticated && (
              <div className="border-t border-[var(--color-border)] px-3 py-3">
                <button
                  onClick={async () => { await handleLogout(); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger-bg)] transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Live Search Overlay */}
      <SearchOverlay
        isOpen={searchOverlayOpen}
        onClose={() => setSearchOverlayOpen(false)}
      />
    </>
  );
}