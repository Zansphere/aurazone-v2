"use client";

import { useState, useEffect } from "react";
import { Sparkles, X, ArrowRight } from "lucide-react";
import Link from "next/link";

export function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem("aurazone_announcement_dismissed");
      if (dismissed === "true") setIsVisible(false);
    } catch {
      // ignore
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      sessionStorage.setItem("aurazone_announcement_dismissed", "true");
    } catch {
      // ignore
    }
  };

  if (!isVisible) return null;

  return (
    <div className="relative z-50 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white py-2 px-4 text-xs font-medium text-center flex items-center justify-center gap-2 border-b border-indigo-900/40">
      <div className="flex items-center gap-2 max-w-4xl mx-auto flex-wrap justify-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-300 border border-indigo-400/20">
          <Sparkles size={11} className="text-amber-300" /> FESTIVE SALE
        </span>
        <span className="text-slate-200">
          Get <strong>FREE Express Delivery</strong> on orders over ₹499! Use code <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-amber-300 font-bold">FESTIVE50</span>
        </span>
        <Link
          href="/products"
          className="underline text-indigo-300 hover:text-white font-semibold inline-flex items-center gap-0.5 ml-1"
        >
          Shop Now <ArrowRight size={10} />
        </Link>
      </div>

      <button
        onClick={handleDismiss}
        className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        title="Dismiss announcement"
      >
        <X size={14} />
      </button>
    </div>
  );
}
