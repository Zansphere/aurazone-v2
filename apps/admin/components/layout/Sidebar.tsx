"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Store, Tag, Package, ShoppingCart,
  CreditCard, Truck, BarChart3, Bell, Settings,
  Layers, ChevronLeft, ChevronRight, Users, X, MessageSquare,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useUiStore } from "@/stores/ui.store";

const NAV_GROUPS = [
  {
    label: "Operations",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/orders", label: "Orders", icon: ShoppingCart },
      { href: "/shipments", label: "Shipments", icon: Truck },
      { href: "/payments", label: "Payments", icon: CreditCard },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/customers", label: "Customers", icon: Users },
    ],
  },
  {
    label: "Catalog",
    items: [
      { href: "/stores", label: "Stores", icon: Store },
      { href: "/products", label: "Products", icon: Tag },
      { href: "/coupons", label: "Coupons", icon: Tag },
      { href: "/reviews", label: "Reviews", icon: MessageSquare },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/storefront", label: "Storefront", icon: Layers },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/notifications", label: "Notifications", icon: Bell },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { mobileSidebarOpen, setMobileSidebarOpen } = useUiStore();

  // Close mobile sidebar on route change
  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [pathname, setMobileSidebarOpen]);

  return (
    <>
      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        style={{ width: collapsed ? "var(--sidebar-collapsed)" : "var(--sidebar-width)" }}
        className={`fixed inset-y-0 left-0 z-50 flex h-full flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-surface)] transition-transform duration-300 md:relative md:translate-x-0 ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo & Mobile Close */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--color-border)] px-4">
          {!collapsed && (
            <span className="text-base font-bold font-[var(--font-heading)] text-[var(--color-text-primary)]">
              AuraZone
            </span>
          )}
          <button 
            onClick={() => setMobileSidebarOpen(false)}
            className="md:hidden text-[var(--color-text-secondary)]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="space-y-0.5">
              {!collapsed && (
                <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)]">
                  {group.label}
                </p>
              )}
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
                return (
                  <Link key={href} href={href}>
                    <span className={`nav-item ${active ? "active" : ""}`}>
                      <Icon size={16} className="shrink-0" />
                      {!collapsed && <span className="truncate">{label}</span>}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Desktop Collapse toggle */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="hidden md:flex absolute -right-3 top-16 h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] shadow-sm hover:bg-[var(--color-bg-muted)] transition-colors"
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </aside>
    </>
  );
}
