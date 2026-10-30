"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Search, X, ShoppingCart, Package, Users, Store,
  LayoutDashboard, Truck, CreditCard, Tag, MessageSquare,
  Layers, BarChart3, Settings, ArrowRight, Loader2,
} from "lucide-react";

interface SearchResult {
  orders: Array<{
    id: string;
    orderNumber: string;
    totalAmount: number;
    status: string;
    createdAt: string;
    user: { fullName: string | null; email: string } | null;
    orderAddress: { name: string } | null;
  }>;
  products: Array<{
    id: string;
    name: string;
    brand: string | null;
    store: { name: string };
  }>;
  customers: Array<{
    id: string;
    fullName: string | null;
    email: string;
  }>;
  stores: Array<{
    id: string;
    name: string;
    slug: string;
  }>;
}

const NAV_PAGES = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, category: "Navigation" },
  { label: "Orders", href: "/orders", icon: ShoppingCart, category: "Navigation" },
  { label: "Shipments", href: "/shipments", icon: Truck, category: "Navigation" },
  { label: "Payments", href: "/payments", icon: CreditCard, category: "Navigation" },
  { label: "Inventory", href: "/inventory", icon: Package, category: "Navigation" },
  { label: "Customers", href: "/customers", icon: Users, category: "Navigation" },
  { label: "Stores", href: "/stores", icon: Store, category: "Navigation" },
  { label: "Products", href: "/products", icon: Tag, category: "Navigation" },
  { label: "Coupons", href: "/coupons", icon: Tag, category: "Navigation" },
  { label: "Reviews", href: "/reviews", icon: MessageSquare, category: "Navigation" },
  { label: "Storefront", href: "/storefront", icon: Layers, category: "Navigation" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, category: "Navigation" },
  { label: "Settings", href: "/settings", icon: Settings, category: "Navigation" },
];

export function SearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "search", debouncedQuery],
    queryFn: () =>
      api.get<SearchResult>(`/admin/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: isOpen && debouncedQuery.length > 0,
  });

  const searchResults = data?.data;

  // Filter navigation pages
  const matchingPages = NAV_PAGES.filter((page) =>
    page.label.toLowerCase().includes(query.toLowerCase())
  );

  const navigateTo = (href: string) => {
    onClose();
    router.push(href);
  };

  if (!isOpen) return null;

  const hasResults =
    (searchResults?.orders && searchResults.orders.length > 0) ||
    (searchResults?.products && searchResults.products.length > 0) ||
    (searchResults?.customers && searchResults.customers.length > 0) ||
    (searchResults?.stores && searchResults.stores.length > 0) ||
    matchingPages.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/50 backdrop-blur-xs animate-in">
      <div
        className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-4 py-3.5 bg-[var(--color-bg-surface)]">
          <Search size={18} className="text-[var(--color-text-tertiary)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search orders, products, customers, stores, or pages..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-tertiary)] outline-none"
          />
          {isLoading && <Loader2 size={16} className="animate-spin text-[var(--color-text-tertiary)] shrink-0" />}
          {query && !isLoading && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer"
            >
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-tertiary)]">
            ESC
          </kbd>
        </div>

        {/* Results Container */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {/* Quick Pages */}
          {matchingPages.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Quick Navigation
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {matchingPages.slice(0, 6).map((page) => (
                  <button
                    key={page.href}
                    onClick={() => navigateTo(page.href)}
                    className="flex items-center justify-between rounded-xl p-2.5 text-left text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-bg-base)] text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] group-hover:bg-[var(--color-accent-light)] transition-colors">
                        <page.icon size={14} />
                      </div>
                      <span>{page.label}</span>
                    </div>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)]" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {searchResults?.orders && searchResults.orders.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Orders ({searchResults.orders.length})
              </p>
              <div className="space-y-1">
                {searchResults.orders.map((order) => (
                  <button
                    key={order.id}
                    onClick={() => navigateTo(`/orders/${order.id}`)}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs hover:bg-[var(--color-bg-muted)] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        <ShoppingCart size={14} />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {order.orderNumber}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                          {order.orderAddress?.name || order.user?.fullName || order.user?.email || "Customer"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-700">
                        {order.status}
                      </span>
                      <p className="text-xs font-medium text-[var(--color-text-primary)] mt-0.5">
                        ₹{Number(order.totalAmount).toLocaleString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Products */}
          {searchResults?.products && searchResults.products.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Products ({searchResults.products.length})
              </p>
              <div className="space-y-1">
                {searchResults.products.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => navigateTo(`/products/${product.id}`)}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs hover:bg-[var(--color-bg-muted)] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 shrink-0">
                        <Package size={14} />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-[var(--color-text-primary)] truncate">
                          {product.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)]">
                          {product.store.name} {product.brand ? `· ${product.brand}` : ""}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customers */}
          {searchResults?.customers && searchResults.customers.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Customers ({searchResults.customers.length})
              </p>
              <div className="space-y-1">
                {searchResults.customers.map((customer) => (
                  <button
                    key={customer.id}
                    onClick={() => navigateTo(`/customers?search=${encodeURIComponent(customer.email)}`)}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs hover:bg-[var(--color-bg-muted)] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-50 text-purple-600 shrink-0">
                        <Users size={14} />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {customer.fullName || "Customer"}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                          {customer.email}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Stores */}
          {searchResults?.stores && searchResults.stores.length > 0 && (
            <div>
              <p className="px-2 pb-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
                Stores ({searchResults.stores.length})
              </p>
              <div className="space-y-1">
                {searchResults.stores.map((store) => (
                  <button
                    key={store.id}
                    onClick={() => navigateTo(`/stores/${store.id}`)}
                    className="w-full flex items-center justify-between rounded-xl p-2.5 text-left text-xs hover:bg-[var(--color-bg-muted)] transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 shrink-0">
                        <Store size={14} />
                      </div>
                      <div className="truncate">
                        <p className="font-semibold text-[var(--color-text-primary)]">
                          {store.name}
                        </p>
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">
                          /{store.slug}
                        </p>
                      </div>
                    </div>
                    <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)] shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty state when query provided but no results */}
          {debouncedQuery && !isLoading && !hasResults && (
            <div className="py-12 text-center text-xs text-[var(--color-text-tertiary)]">
              <Search size={28} className="mx-auto mb-2 opacity-30" />
              <p className="font-semibold text-[var(--color-text-secondary)]">No results found</p>
              <p className="text-[11px] mt-0.5">
                No orders, products, or customers match &ldquo;{debouncedQuery}&rdquo;
              </p>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="border-t border-[var(--color-border)] px-4 py-2 bg-[var(--color-bg-base)] flex items-center justify-between text-[11px] text-[var(--color-text-tertiary)]">
          <div className="flex items-center gap-3">
            <span>Navigation & Quick Search</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Press</span>
            <kbd className="rounded border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-1 py-0.5 font-mono text-[9px]">ESC</kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
