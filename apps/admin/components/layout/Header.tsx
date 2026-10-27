"use client";

import { useState, useEffect } from "react";
import { Search, LogOut, User, Settings, Menu } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useUiStore } from "@/stores/ui.store";
import { useRouter } from "next/navigation";
import { MenuDropdown } from "@/components/ui/Dropdown";
import { NotificationDropdown } from "./NotificationDropdown";
import { SearchModal } from "./SearchModal";

export function Header() {
  const { user, logout } = useAuthStore();
  const { toggleMobileSidebar } = useUiStore();
  const [searchOpen, setSearchOpen] = useState(false);
  const router = useRouter();

  // Listen for Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const initials = user?.fullName
    ? user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "A";

  const handleUserAction = async (value: string) => {
    if (value === "logout") {
      await logout();
      router.replace("/login");
    } else if (value === "settings") {
      router.push("/settings");
    } else if (value === "profile") {
      router.push("/settings");
    }
  };

  return (
    <>
      <header
        style={{ height: "var(--header-height)" }}
        className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-surface)] px-4 sm:px-6"
      >
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <button
            onClick={toggleMobileSidebar}
            className="md:hidden flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
          >
            <Menu size={20} />
          </button>

          {/* Search Trigger Button */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3 py-1.5 text-sm text-[var(--color-text-secondary)] w-40 sm:w-56 lg:w-72 cursor-pointer hover:border-[var(--color-border-strong)] transition-colors text-left"
          >
            <Search size={14} className="text-[var(--color-text-tertiary)] shrink-0" />
            <span className="text-[var(--color-text-tertiary)] text-xs truncate">Search...</span>
            <span className="ml-auto text-[10px] text-[var(--color-text-tertiary)] bg-[var(--color-bg-surface)] border border-[var(--color-border)] px-1.5 py-0.5 rounded font-mono shrink-0">
              ⌘K
            </span>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          {/* Notifications Dropdown */}
          <NotificationDropdown />

          {/* User Menu */}
          <MenuDropdown
            trigger={
              <div className="flex items-center gap-2 rounded-[var(--radius-md)] hover:bg-[var(--color-bg-base)] px-2 py-1 transition-colors cursor-pointer">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-accent)] text-white text-xs font-semibold">
                  {initials}
                </div>
                {user && (
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-semibold text-[var(--color-text-primary)] leading-none truncate max-w-[100px]">
                      {user.fullName ?? user.email}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-tertiary)] leading-none mt-0.5 capitalize">
                      {user.role === "SUPER_ADMIN" ? "Super Admin" : "Manager"}
                    </p>
                  </div>
                )}
              </div>
            }
            items={[
              { value: "profile", label: "My Profile", icon: <User size={14} /> },
              { value: "settings", label: "Settings", icon: <Settings size={14} /> },
              { value: "logout", label: "Sign out", icon: <LogOut size={14} />, danger: true },
            ]}
            onSelect={handleUserAction}
            align="right"
          />
        </div>
      </header>

      {/* Search Modal */}
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
