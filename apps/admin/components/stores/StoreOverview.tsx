"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Edit2, ExternalLink, Globe, Palette } from "lucide-react";
import { useState } from "react";
import ImageUploader from "@/components/ui/ImageUploader";

interface Store {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  accentColor: string | null;
  isActive: boolean;
  _count: { products: number; categories: number };
}

export default function StoreOverview({ store }: { store: Store }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: store.name,
    slug: store.slug,
    description: store.description ?? "",
    accentColor: store.accentColor ?? "#6F7F5F",
    isActive: store.isActive,
    logoUrl: store.logoUrl ?? "",
    bannerUrl: store.bannerUrl ?? "",
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/admin/stores/${store.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "store", store.id] });
      setEditing(false);
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(form);
  };

  if (editing) {
    return (
      <form onSubmit={handleSave} className="space-y-4 fade-in">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="store-name" className="form-label">Store Name</label>
            <input
              id="store-name"
              type="text" className="form-input" required
              value={form.name}
              onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label htmlFor="store-slug" className="form-label">Slug</label>
            <input
              id="store-slug"
              type="text" className="form-input font-mono text-xs"
              value={form.slug}
              onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
            />
          </div>
        </div>
        <div>
          <label htmlFor="store-desc" className="form-label">Description</label>
          <textarea
            id="store-desc"
            className="form-input min-h-[80px] resize-y"
            value={form.description}
            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </div>

        {/* Logo & Banner Upload */}
        <div className="grid grid-cols-2 gap-4">
          <ImageUploader
            label="Store Logo"
            single
            images={form.logoUrl ? [{ url: form.logoUrl, position: 0 }] : []}
            onChange={(imgs) => setForm(f => ({ ...f, logoUrl: imgs[0]?.url ?? "" }))}
          />
          <ImageUploader
            label="Store Banner"
            single
            images={form.bannerUrl ? [{ url: form.bannerUrl, position: 0 }] : []}
            onChange={(imgs) => setForm(f => ({ ...f, bannerUrl: imgs[0]?.url ?? "" }))}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label">Accent Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color" className="h-9 w-9 rounded cursor-pointer border-0"
                value={form.accentColor}
                onChange={(e) => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
              <input
                type="text" className="form-input font-mono text-xs flex-1"
                value={form.accentColor}
                onChange={(e) => setForm(f => ({ ...f, accentColor: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <label htmlFor="store-status" className="form-label">Status</label>
            <select
              id="store-status"
              className="form-input"
              value={form.isActive ? "active" : "inactive"}
              onChange={(e) => setForm(f => ({ ...f, isActive: e.target.value === "active" }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={() => setEditing(false)} className="btn-secondary text-xs">Cancel</button>
          <button type="submit" className="btn-primary text-xs" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="space-y-5 fade-in">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Store Information</h3>
        <button onClick={() => setEditing(true)} className="btn-secondary text-xs flex items-center gap-1.5">
          <Edit2 size={12} /> Edit Details
        </button>
      </div>

      {/* Banner */}
      {store.bannerUrl && (
        <div className="rounded-lg overflow-hidden border border-[var(--color-border)] h-32">
          <img src={store.bannerUrl} alt={`${store.name} banner`} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          {/* Logo + Name */}
          <div className="flex items-center gap-3">
            {store.logoUrl ? (
              <img src={store.logoUrl} alt={`${store.name} logo`}
                className="h-12 w-12 rounded-lg object-cover border border-[var(--color-border)]" />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-lg font-bold"
                style={{ backgroundColor: store.accentColor ?? "var(--color-accent)" }}
              >
                {store.name[0]}
              </div>
            )}
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{store.name}</p>
              <p className="text-xs text-[var(--color-text-tertiary)] font-mono flex items-center gap-1">
                <Globe size={10} />/{store.slug}
              </p>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">Description</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {store.description || "No description set"}
            </p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">Accent Color</p>
            <div className="flex items-center gap-2">
              <div
                className="h-6 w-6 rounded-md border border-[var(--color-border)]"
                style={{ backgroundColor: store.accentColor ?? "#6F7F5F" }}
              />
              <span className="text-xs font-mono text-[var(--color-text-secondary)]">{store.accentColor ?? "#6F7F5F"}</span>
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wide mb-1">Status</p>
            <span className={`badge ${store.isActive ? "badge-success" : "badge-warning"}`}>
              {store.isActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[var(--color-border)]">
        <div className="rounded-lg bg-[var(--color-bg-muted)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{store._count?.products ?? 0}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase">Products</p>
        </div>
        <div className="rounded-lg bg-[var(--color-bg-muted)] p-3 text-center">
          <p className="text-xl font-bold text-[var(--color-text-primary)]">{store._count?.categories ?? 0}</p>
          <p className="text-[10px] text-[var(--color-text-tertiary)] uppercase">Categories</p>
        </div>
        <div className="rounded-lg bg-[var(--color-accent-light)] p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <ExternalLink size={12} className="text-[var(--color-accent)]" />
            <p className="text-xs font-medium text-[var(--color-accent)]">View Storefront</p>
          </div>
        </div>
      </div>
    </div>
  );
}
