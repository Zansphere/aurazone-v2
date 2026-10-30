"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Bell, CheckCheck, ShoppingCart, Package,
  AlertTriangle, TrendingUp, Settings, Megaphone,
  ChevronRight, ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  url: string | null;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  order: <ShoppingCart size={14} className="text-blue-500" />,
  shipment: <Package size={14} className="text-purple-500" />,
  stock: <AlertTriangle size={14} className="text-amber-500" />,
  revenue: <TrendingUp size={14} className="text-emerald-500" />,
  promo: <Megaphone size={14} className="text-pink-500" />,
  system: <Settings size={14} className="text-gray-500" />,
};

function getNotificationIcon(title: string): React.ReactNode {
  const lower = title.toLowerCase();
  if (lower.includes("order")) return ICON_MAP.order;
  if (lower.includes("ship")) return ICON_MAP.shipment;
  if (lower.includes("stock") || lower.includes("inventory")) return ICON_MAP.stock;
  if (lower.includes("revenue") || lower.includes("sale")) return ICON_MAP.revenue;
  if (lower.includes("promo") || lower.includes("campaign")) return ICON_MAP.promo;
  return ICON_MAP.system;
}

function timeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const intervals = [
    { label: "d", secs: 86400 },
    { label: "h", secs: 3600 },
    { label: "m", secs: 60 },
  ];
  for (const i of intervals) {
    const count = Math.floor(seconds / i.secs);
    if (count >= 1) return `${count}${i.label} ago`;
  }
  return "just now";
}

export function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notifications", "header"],
    queryFn: () =>
      api.get<{ notifications: NotificationItem[]; total: number; unreadCount: number }>(
        "/admin/notifications?take=6"
      ),
    refetchInterval: 30000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/admin/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () => api.patch("/admin/notifications/read-all"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] }),
  });

  const notifications = data?.data?.notifications ?? [];
  const unreadCount = data?.data?.unreadCount ?? 0;

  // Handle clicking outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Handle Escape key
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleNotificationClick = (notif: NotificationItem) => {
    if (!notif.isRead) {
      markReadMutation.mutate(notif.id);
    }
    setIsOpen(false);
    if (notif.url) {
      router.push(notif.url);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-base)] transition-colors cursor-pointer"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--color-danger)] px-1 text-[9px] font-bold text-white shadow-xs">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-xl z-50 overflow-hidden animate-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3 bg-[var(--color-bg-surface)]">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <span className="rounded-full bg-[var(--color-accent-light)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-accent)]">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                title="Mark all as read"
                className="text-[11px] font-medium text-[var(--color-accent)] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <CheckCheck size={12} /> Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-[var(--color-border)]">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-3 p-3.5 items-center">
                  <div className="h-7 w-7 rounded-full shimmer shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3 shimmer w-3/4 rounded" />
                    <div className="h-2.5 shimmer w-1/2 rounded" />
                  </div>
                </div>
              ))
            ) : notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-[var(--color-text-tertiary)] flex flex-col items-center gap-2">
                <Bell size={24} className="opacity-40" />
                <p className="font-medium text-[var(--color-text-secondary)]">No notifications yet</p>
                <p className="text-[11px]">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`flex items-start gap-3 p-3.5 transition-colors cursor-pointer hover:bg-[var(--color-bg-muted)] ${
                    !n.isRead ? "bg-[var(--color-accent-light)]/20" : ""
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-bg-muted)] mt-0.5">
                    {getNotificationIcon(n.title)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className={`text-xs truncate ${!n.isRead ? "font-semibold text-[var(--color-text-primary)]" : "font-medium text-[var(--color-text-secondary)]"}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-[var(--color-text-disabled)] shrink-0">
                        {timeAgo(n.createdAt)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--color-text-tertiary)] line-clamp-2 mt-0.5">
                      {n.body}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] shrink-0 mt-2" />
                  )}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-[var(--color-border)] p-2 bg-[var(--color-bg-base)]">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors rounded-lg hover:bg-[var(--color-bg-surface)]"
            >
              View all notifications <ChevronRight size={13} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
