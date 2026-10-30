"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, ShoppingCart, Heart, User } from "lucide-react";
import { useCartStore } from "@/stores/cart.store";
import { useWishlistStore } from "@/stores/wishlist.store";

const TABS = [
  { href: "/", label: "Home", icon: Home, key: "home" },
  { href: "/products", label: "Search", icon: Search, key: "search" },
  { href: "/cart", label: "Cart", icon: ShoppingCart, key: "cart" },
  { href: "/wishlist", label: "Saved", icon: Heart, key: "wishlist" },
  { href: "/profile", label: "Account", icon: User, key: "profile" },
];

export function MobileBottomNav() {
  const pathname = usePathname();
  const { cart } = useCartStore();
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const cartCount = new Set(
    cart?.items?.map((item) => item.productId || (item as any).variant?.product?.id || item.variantId)
  ).size;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 flex border-t border-[var(--color-border)] bg-[var(--color-bg-surface)]/95 backdrop-blur-md md:hidden safe-area-bottom">
      {TABS.map(({ href, label, icon: Icon, key }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        const badgeCount = key === "cart" ? cartCount : key === "wishlist" ? wishlistCount : 0;
        return (
          <Link key={href} href={href} className={`mobile-nav-item relative ${active ? "active" : ""}`}>
            <div className="relative">
              <Icon size={20} />
              {badgeCount > 0 && (
                <span className={`absolute -right-2 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${key === "wishlist" ? "bg-red-500" : "bg-[var(--color-accent)]"}`}>
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
              )}
            </div>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}