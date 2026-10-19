"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, ArrowRight, Copy, Check } from "lucide-react";
import Link from "next/link";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("aurazone_announcement_dismissed");
      if (dismissed === "true") {
        setIsVisible(false);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem("aurazone_announcement_dismissed", "true");
    } catch {
      // ignore storage errors
    }
    // Allow smooth height-collapse and fade-out animation to complete before unmounting
    setTimeout(() => {
      setIsVisible(false);
    }, 300);
  };

  const copyPromoCode = (code: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }
    } catch {
      // ignore clipboard error
    }
  };

  if (!isVisible) return null;

  return (
    <aside
      role="banner"
      aria-label="Festive promotion"
      className={`relative w-full z-50 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-white border-b border-indigo-500/20 shadow-sm transition-all duration-300 ease-in-out ${
        isDismissed
          ? "max-h-0 opacity-0 -translate-y-2 py-0 overflow-hidden border-transparent"
          : "max-h-28 opacity-100 translate-y-0 py-2 sm:py-2.5 px-3 sm:px-4 pr-10 sm:pr-12"
      }`}
    >
      <div className="flex items-center justify-center gap-1.5 sm:gap-2.5 max-w-5xl mx-auto flex-wrap text-center text-[11px] sm:text-xs font-medium leading-relaxed">
        {/* Festive Badge */}
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30 uppercase tracking-wider shrink-0 shadow-sm">
          <Sparkles size={11} className="text-amber-300 animate-pulse shrink-0" />
          Festive Sale
        </span>

        {/* Message */}
        <span className="text-slate-200">
          Get <strong className="text-white font-semibold">FREE Express Delivery</strong> on orders over ₹499! Use code
        </span>

        {/* Copyable Promo Code */}
        <button
          type="button"
          onClick={() => copyPromoCode("FESTIVE50")}
          className="group relative inline-flex items-center gap-1 font-mono bg-white/10 hover:bg-white/20 active:scale-95 px-2 py-0.5 rounded text-amber-300 font-bold transition-all cursor-pointer border border-amber-300/25 shrink-0"
          title="Click to copy promo code"
        >
          <span>FESTIVE50</span>
          {copied ? (
            <Check size={11} className="text-emerald-400 shrink-0" />
          ) : (
            <Copy size={10} className="text-amber-300/70 group-hover:text-amber-300 shrink-0 transition-colors" />
          )}

          {copied && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/90 text-emerald-300 text-[10px] font-sans font-semibold px-2 py-0.5 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 pointer-events-none border border-emerald-500/30">
              Copied!
            </span>
          )}
        </button>

        {/* Action Link */}
        <Link
          href="/products"
          className="group text-indigo-300 hover:text-white font-semibold underline underline-offset-2 inline-flex items-center gap-0.5 transition-colors shrink-0"
        >
          Shop Now
          <ArrowRight size={11} className="transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Dismiss Button — vertically centered and offset to prevent overlap */}
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute right-2 sm:right-3.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 active:scale-90 transition-all focus:outline-none focus:ring-1 focus:ring-indigo-400"
        aria-label="Dismiss announcement"
        title="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </aside>
  );
}
