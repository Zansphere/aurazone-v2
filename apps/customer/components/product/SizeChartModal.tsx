"use client";

import { X } from "lucide-react";

interface SizeChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  productType?: string;
}

export function SizeChartModal({ isOpen, onClose }: SizeChartModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-200"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--color-border)]">
          <div>
            <h3 className="text-lg font-bold text-[var(--color-text-primary)]">Size Guide</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">All measurements are in inches</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)]/50 text-[var(--color-text-tertiary)] uppercase font-semibold">
                <th className="py-2.5 px-3">Size</th>
                <th className="py-2.5 px-3">Chest (in)</th>
                <th className="py-2.5 px-3">Length (in)</th>
                <th className="py-2.5 px-3">Shoulder (in)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)] text-[var(--color-text-primary)]">
              <tr>
                <td className="py-2.5 px-3 font-bold">S</td>
                <td className="py-2.5 px-3">38"</td>
                <td className="py-2.5 px-3">27"</td>
                <td className="py-2.5 px-3">16.5"</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold">M</td>
                <td className="py-2.5 px-3">40"</td>
                <td className="py-2.5 px-3">28"</td>
                <td className="py-2.5 px-3">17.5"</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold">L</td>
                <td className="py-2.5 px-3">42"</td>
                <td className="py-2.5 px-3">29"</td>
                <td className="py-2.5 px-3">18.5"</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold">XL</td>
                <td className="py-2.5 px-3">44"</td>
                <td className="py-2.5 px-3">30"</td>
                <td className="py-2.5 px-3">19.5"</td>
              </tr>
              <tr>
                <td className="py-2.5 px-3 font-bold">XXL</td>
                <td className="py-2.5 px-3">46"</td>
                <td className="py-2.5 px-3">31"</td>
                <td className="py-2.5 px-3">20.5"</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-xl bg-[var(--color-bg-muted)] text-[11px] text-[var(--color-text-secondary)] space-y-1">
          <p className="font-semibold text-[var(--color-text-primary)]">How to measure:</p>
          <p>• <strong>Chest:</strong> Measure around the fullest part of your chest, keeping tape horizontal.</p>
          <p>• <strong>Length:</strong> Measure from highest point of the shoulder down to the hem.</p>
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-xl bg-[var(--color-primary)] py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
