"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Shield,
  Camera,
  Phone,
  KeyRound,
  Trash2,
  AlertTriangle,
  Check,
  Search,
  Package,
  Truck,
  Heart,
  ShoppingCart,
  ArrowRight,
  Clock,
  Sparkles,
  LogIn,
  UserPlus,
  ChevronRight,
  Hash,
} from "lucide-react";
import { getOrderStatusMeta } from "@/lib/order-status";

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-32 shimmer rounded-2xl" />
        <div className="h-64 shimmer rounded-2xl" />
        <div className="h-48 shimmer rounded-2xl" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <GuestProfileHub />;
  }

  return <AuthenticatedProfileView user={user} />;
}

/* ─────────────────────────────────────────────────────────────────────────────
   GUEST PROFILE HUB (Placeholder profile page for non-logged-in customers)
   ───────────────────────────────────────────────────────────────────────────── */
function GuestProfileHub() {
  const router = useRouter();

  // Order lookup form state
  const [lookupOrderNumber, setLookupOrderNumber] = useState("");
  const [lookupEmail, setLookupEmail] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Fetch orders placed in current guest session
  const { data, isLoading: loadingOrders } = useQuery({
    queryKey: ["guest-profile-orders"],
    queryFn: () => api.get<any[]>("/orders"),
  });

  const sessionOrders = Array.isArray(data?.data) ? data.data : [];

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError("");
    setIsSearching(true);

    try {
      const res = await api.get<{ trackingToken: string }>(
        `/orders/track/lookup?orderNumber=${encodeURIComponent(
          lookupOrderNumber.trim()
        )}&email=${encodeURIComponent(lookupEmail.trim())}`
      );

      if (res.data?.trackingToken) {
        router.push(`/track-order/${res.data.trackingToken}`);
      } else {
        setLookupError("No order found matching this Order Number and Email.");
      }
    } catch (err: any) {
      setLookupError(
        err.message ||
          "Order not found. Please verify your order number and email address."
      );
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Hero Notice Card */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-[var(--color-accent)]/20 text-[var(--color-accent)] border border-[var(--color-accent)]/20 shadow-sm">
              <User size={30} />
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 px-2.5 py-0.5 text-xs font-semibold">
                  Guest Session
                </span>
                <span className="text-xs text-[var(--color-text-tertiary)]">
                  Unauthenticated Mode
                </span>
              </div>
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] font-[var(--font-heading)]">
                Guest Customer Profile
              </h2>
              <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] max-w-xl leading-relaxed">
                Full profile settings (personal details, address book, password management) are
                reserved for registered members. As a guest, you can track packages, review orders
                placed on this device, and lookup previous purchases.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap sm:flex-col gap-2.5 w-full sm:w-auto shrink-0">
            <Link
              href="/login"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-sm"
            >
              <LogIn size={14} /> Sign In
            </Link>
            <Link
              href="/signup"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-5 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              <UserPlus size={14} /> Create Account
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Order Lookup Tool */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-accent-light)] text-[var(--color-accent)]">
              <Search size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
                Find & Track Any Order
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Lookup your order details and live shipping updates using your Order # and Email.
              </p>
            </div>
          </div>

          <Link
            href="/track-order"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-accent)] hover:underline"
          >
            Have a tracking token? Track here <ArrowRight size={12} />
          </Link>
        </div>

        <form onSubmit={handleLookupSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
              Order Number
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. ORD-20261026-ABCD"
                value={lookupOrderNumber}
                onChange={(e) => setLookupOrderNumber(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-9 pr-3 py-2.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] font-mono transition-colors"
              />
              <Hash size={14} className="absolute left-3 top-3 text-[var(--color-text-tertiary)]" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)] mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                placeholder="Email used during checkout"
                value={lookupEmail}
                onChange={(e) => setLookupEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-9 pr-3 py-2.5 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              <Mail size={14} className="absolute left-3 top-3 text-[var(--color-text-tertiary)]" />
            </div>
          </div>

          {lookupError && (
            <div className="sm:col-span-2 rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 text-xs text-red-600 dark:text-red-400">
              {lookupError}
            </div>
          )}

          <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <button
              type="submit"
              disabled={isSearching}
              className="rounded-xl bg-[var(--color-primary)] px-6 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
            >
              <Search size={14} />
              {isSearching ? "Searching Order..." : "Find Order & Track"}
            </button>

            <Link
              href="/track-order"
              className="sm:hidden text-xs font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
            >
              Have a tracking token? Track here <ArrowRight size={12} />
            </Link>
          </div>
        </form>
      </div>

      {/* 3. Orders Placed in this Guest Session */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
              Orders Placed on this Device
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)]">
              Track and view order details for purchases made during your current session.
            </p>
          </div>
          {sessionOrders.length > 0 && (
            <Link
              href="/orders"
              className="text-xs font-semibold text-[var(--color-accent)] hover:underline inline-flex items-center gap-1"
            >
              View All ({sessionOrders.length}) <ChevronRight size={14} />
            </Link>
          )}
        </div>

        {loadingOrders ? (
          <div className="space-y-3">
            <div className="h-24 shimmer rounded-2xl" />
            <div className="h-24 shimmer rounded-2xl" />
          </div>
        ) : sessionOrders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-bg-muted)] text-[var(--color-text-tertiary)] mx-auto mb-2.5">
              <Package size={22} />
            </div>
            <p className="text-sm font-bold text-[var(--color-text-primary)]">
              No recent orders in this browser session
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
              If you placed an order earlier as a guest, you can track it anytime using the Order
              Finder above.
            </p>
            <Link
              href="/products"
              className="mt-3.5 inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
            >
              Start Shopping <ArrowRight size={12} />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {sessionOrders.slice(0, 3).map((order: any) => {
              const statusMeta = getOrderStatusMeta(order.status);
              return (
              <div
                key={order.id}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 shadow-sm hover:border-[var(--color-accent)] transition-all"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--color-border)]">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <span className="text-sm font-mono font-bold text-[var(--color-text-primary)]">
                        {order.orderNumber}
                      </span>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${statusMeta.badgeClass}`}
                      >
                        {statusMeta.badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-tertiary)] mt-1 flex items-center gap-1.5">
                      <Clock size={12} />
                      {new Date(order.createdAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                      {" · "}
                      {order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0} item
                      {(order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0) !== 1
                        ? "s"
                        : ""}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="text-base font-black text-[var(--color-text-primary)]">
                      ₹{Number(order.totalAmount).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 gap-2">
                  <Link
                    href={`/orders/${order.id}`}
                    className="text-xs font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors inline-flex items-center gap-1"
                  >
                    View Order Details <ChevronRight size={14} />
                  </Link>

                  {order.trackingToken && (
                    <Link
                      href={`/track-order/${order.trackingToken}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-primary)] hover:bg-[var(--color-border)] transition-colors"
                    >
                      <Truck size={13} className="text-emerald-600" /> Track Live
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
          </div>
        )}
      </div>

      {/* 4. Important Customer Services & Quick Links */}
      <div>
        <h3 className="text-sm font-bold text-[var(--color-text-primary)] mb-3">
          Accessible Customer Services
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Link
            href="/orders"
            className="group flex items-start gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:border-[var(--color-accent)] transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 group-hover:scale-105 transition-transform">
              <ShoppingCart size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-xs text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                Order History & Finder <ChevronRight size={13} />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                Review recent purchases or search any order placed with your email address.
              </p>
            </div>
          </Link>

          <Link
            href="/track-order"
            className="group flex items-start gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:border-[var(--color-accent)] transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 group-hover:scale-105 transition-transform">
              <Truck size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-xs text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                Live Shipment Tracking <ChevronRight size={13} />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                Track carrier journey, courier partner milestones, and delivery estimates in real time.
              </p>
            </div>
          </Link>

          <Link
            href="/cart"
            className="group flex items-start gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:border-[var(--color-accent)] transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 group-hover:scale-105 transition-transform">
              <Package size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-xs text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                Active Shopping Cart <ChevronRight size={13} />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                Review items ready in your bag, apply coupons, and proceed to guest checkout.
              </p>
            </div>
          </Link>

          <Link
            href="/wishlist"
            className="group flex items-start gap-3.5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 shadow-sm hover:border-[var(--color-accent)] transition-all"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 group-hover:scale-105 transition-transform">
              <Heart size={18} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-semibold text-xs text-[var(--color-text-primary)] group-hover:text-[var(--color-accent)] transition-colors">
                Saved Wishlist <ChevronRight size={13} />
              </div>
              <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">
                Save your favorite items for later. Sign in anytime to sync across all devices.
              </p>
            </div>
          </Link>
        </div>
      </div>

      {/* 5. Why Create an Account Member Benefits */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/50 p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--color-accent)]" />
          <h3 className="text-sm font-bold text-[var(--color-text-primary)]">
            Why register for an AuraZone account?
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[var(--color-text-secondary)]">
          <div className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>1-Click Checkout:</strong> Save multiple shipping addresses and phone contacts.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Multi-Device Sync:</strong> Access your orders, cart, and wishlist anywhere.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Exclusive Deals:</strong> Unlock member-only coupons and seasonal discounts.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Check size={14} className="text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Hassle-Free Support:</strong> Faster return processing and direct seller messaging.
            </span>
          </div>
        </div>

        <div className="pt-2 flex items-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
          >
            Create Free Account <ArrowRight size={12} />
          </Link>
          <Link
            href="/login"
            className="text-xs font-semibold text-[var(--color-text-primary)] hover:underline"
          >
            Already have an account? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   AUTHENTICATED PROFILE VIEW (Full profile editor for logged-in customers)
   ───────────────────────────────────────────────────────────────────────────── */
function AuthenticatedProfileView({ user }: { user: any }) {
  const { fetchUser, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile info state
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? "");
      setPhone((user as any).phone ?? "");
      setAvatar(user.avatar ?? "");
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Avatar image must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      try {
        await api.put("/users/profile", { avatar: base64 });
        await fetchUser();
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      } catch (err: any) {
        setProfileError(err.message || "Failed to update profile picture");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      await api.put("/users/profile", { fullName, phone });
      await fetchUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in both current and new passwords");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/users/change-password", { currentPassword, newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete("/users/account");
      logout();
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="space-y-6">
      {/* Hidden file input for Avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Avatar Card */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm">
        <div className="relative shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt={user?.fullName ?? "Avatar"}
              className="h-20 w-20 rounded-full object-cover border-2 border-[var(--color-accent)] shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-white text-2xl font-bold shadow-[var(--shadow-md)]">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-bg-surface)] bg-[var(--color-primary)] text-white shadow hover:scale-105 transition-transform"
          >
            <Camera size={14} />
          </button>
        </div>

        <div className="text-center sm:text-left min-w-0">
          <p className="text-xl font-bold text-[var(--color-text-primary)] truncate">
            {user?.fullName ?? "My Account"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)] truncate">{user?.email}</p>
          <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              <Shield size={11} />
              {user?.role === "SUPER_ADMIN" ? "Super Admin" : "Verified Customer"}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Information Form */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <User size={12} /> Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <Phone size={12} /> Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Mail size={12} /> Email Address
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm text-[var(--color-text-tertiary)] cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            Email address is tied to your account identity and cannot be changed.
          </p>
        </div>

        {profileError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {profileError}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {profileSaved ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check size={14} /> Profile details saved successfully!
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 shadow-sm"
          >
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
          </div>

          {passwordError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {passwordError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {passwordSaved ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={14} /> Password changed successfully!
              </span>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 shadow-sm"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="rounded-2xl border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={15} /> Delete Account
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-md">
              Permanently delete your account and anonymize your personal data. This action cannot be
              undone.
            </p>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-black/50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500 hover:text-white transition-all self-start sm:self-auto"
          >
            <Trash2 size={13} /> Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Delete Account?
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Are you sure you want to delete your AuraZone account? Your personal information, saved
                addresses, and active sessions will be permanently erased.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}