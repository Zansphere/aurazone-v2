"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Search, Package, ArrowRight, ShieldCheck, Mail, Hash, Key } from "lucide-react";
import Link from "next/link";

export default function TrackOrderRootPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"lookup" | "token">("lookup");

  // Lookup state (order number + email)
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [lookupError, setLookupError] = useState("");

  // Token state
  const [trackingToken, setTrackingToken] = useState("");

  const handleLookupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError("");
    setLoadingLookup(true);

    try {
      const res = await api.get<{ trackingToken: string }>(
        `/orders/track/lookup?orderNumber=${encodeURIComponent(orderNumber.trim())}&email=${encodeURIComponent(email.trim())}`
      );

      if (res.data?.trackingToken) {
        router.push(`/track-order/${res.data.trackingToken}`);
      } else {
        setLookupError("No tracking record found for this order.");
      }
    } catch (err: any) {
      setLookupError(err.message || "Order not found. Please verify your order number and email address.");
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleTokenSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trackingToken.trim()) {
      router.push(`/track-order/${encodeURIComponent(trackingToken.trim())}`);
    }
  };

  return (
    <div className="section-container py-12 md:py-16 max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-light)] text-[var(--color-accent)] mb-4 shadow-sm">
          <Package size={28} />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)] font-[var(--font-heading)]">
          Track Your Order
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)] max-w-md mx-auto">
          Get real-time updates and live package journey tracking for your AuraZone purchase.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-1 mb-6 shadow-sm">
        <button
          type="button"
          onClick={() => { setActiveTab("lookup"); setLookupError(""); }}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "lookup"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Hash size={14} /> Order Number & Email
        </button>
        <button
          type="button"
          onClick={() => { setActiveTab("token"); setLookupError(""); }}
          className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
            activeTab === "token"
              ? "bg-[var(--color-primary)] text-white shadow-sm"
              : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          }`}
        >
          <Key size={14} /> Tracking Token
        </button>
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 md:p-8 shadow-sm">
        {activeTab === "lookup" ? (
          <form onSubmit={handleLookupSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                Order Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. ORD-20261026-ABCD"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-10 pr-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors font-mono"
                />
                <Hash size={16} className="absolute left-3.5 top-3.5 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                Found on your order confirmation email or receipt.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="e.g. yourname@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-10 pr-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
                />
                <Mail size={16} className="absolute left-3.5 top-3.5 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                The email used during checkout or associated with your account.
              </p>
            </div>

            {lookupError && (
              <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3.5 text-xs text-red-600 dark:text-red-400">
                {lookupError}
              </div>
            )}

            <button
              type="submit"
              disabled={loadingLookup}
              className="w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
            >
              <Search size={16} />
              {loadingLookup ? "Searching Order..." : "Find & Track Order"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleTokenSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1.5">
                Tracking Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="Paste your unique 32-character tracking token..."
                  value={trackingToken}
                  onChange={(e) => setTrackingToken(e.target.value)}
                  className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] pl-10 pr-4 py-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors font-mono"
                />
                <Key size={16} className="absolute left-3.5 top-3.5 text-[var(--color-text-tertiary)]" />
              </div>
              <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
                Provided in your order confirmation email or delivery notification.
              </p>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <Search size={16} /> Track Package
            </button>
          </form>
        )}
      </div>

      {/* Helpful Info */}
      <div className="mt-8 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-muted)]/50 p-5 flex items-start gap-3.5">
        <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--color-text-secondary)] space-y-1">
          <p className="font-semibold text-[var(--color-text-primary)]">
            Guest order tracking is 100% secure
          </p>
          <p>
            You do not need an account to track your orders. Simply provide the matching email and order number, or click the tracking link directly from your confirmation email.
          </p>
        </div>
      </div>
    </div>
  );
}
