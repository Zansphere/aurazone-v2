"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Search, Edit2, Trash2, Store as StoreIcon,
  CheckCircle, XCircle, X, Package, Tag, ExternalLink,
  ToggleLeft, ToggleRight, AlertTriangle, ArrowRight,
} from "lucide-react";
import Link from "next/link";

interface Store {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  accentColor: string | null;
  isActive: boolean;
  sortOrder: number;
  _count: { categories: number; products: number };
}

interface StoreFormData {
  name: string;
  slug: string;
  description: string;
  accentColor: string;
  sortOrder: number;
  isActive: boolean;
}

const PRESET_COLORS = [
  "#6F7F5F", "#3B82F6", "#10B981", "#EC4899",
  "#F59E0B", "#8B5CF6", "#EF4444", "#0EA5E9",
];

function StoreFormModal({
  open,
  onClose,
  onSubmit,
  initialData,
  isSubmitting,
  title,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: StoreFormData) => void;
  initialData: StoreFormData;
  isSubmitting: boolean;
  title: string;
}) {
  const [form, setForm] = useState<StoreFormData>(initialData);

  // Sync when initialData changes (e.g. opening edit modal)
  useState(() => { setForm(initialData); });

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] shadow-[var(--shadow-xl)] flex flex-col max-h-[90vh]"
        style={{ animation: "zoomIn 200ms ease-out both" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-[var(--color-text-primary)]">{title}</h2>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Fill in the details for the store.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          id="store-form"
          onSubmit={(e) => { e.preventDefault(); onSubmit(form); }}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          {/* Name + Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Store Name <span className="text-[var(--color-danger)]">*</span></label>
              <input
                type="text"
                className="form-input"
                value={form.name}
                placeholder="e.g. Aura Fashion"
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: title === "Create Store" ? slugify(e.target.value) : f.slug,
                  }))
                }
                required
              />
            </div>
            <div>
              <label className="form-label">Slug <span className="text-[var(--color-danger)]">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[var(--color-text-tertiary)]">/</span>
                <input
                  type="text"
                  className="form-input pl-6 font-mono text-xs"
                  value={form.slug}
                  placeholder="fashion"
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                />
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input min-h-[80px] resize-none"
              value={form.description}
              placeholder="Brief description of the store..."
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>

          {/* Accent Color */}
          <div>
            <label className="form-label">Accent Color</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, accentColor: c }))}
                  className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
                  style={{
                    backgroundColor: c,
                    borderColor: form.accentColor === c ? "var(--color-text-primary)" : "transparent",
                    boxShadow: form.accentColor === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : undefined,
                  }}
                  title={c}
                />
              ))}
              <div className="flex items-center gap-2 ml-1">
                <input
                  type="color"
                  value={form.accentColor}
                  onChange={(e) => setForm((f) => ({ ...f, accentColor: e.target.value }))}
                  className="h-7 w-7 cursor-pointer rounded-full border border-[var(--color-border)] p-0 overflow-hidden"
                  title="Custom color"
                />
                <span className="text-xs font-mono text-[var(--color-text-tertiary)]">{form.accentColor}</span>
              </div>
            </div>
          </div>

          {/* Sort Order + Active */}
          <div className="flex items-end gap-4">
            <div className="w-32">
              <label className="form-label">Sort Order</label>
              <input
                type="number"
                className="form-input"
                value={form.sortOrder}
                min={0}
                onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
              />
            </div>
            <div className="flex items-center gap-3 pb-1">
              <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Active</label>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${form.isActive ? "bg-[var(--color-accent)]" : "bg-[var(--color-bg-muted)] border border-[var(--color-border)]"
                  }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.isActive ? "translate-x-5" : "translate-x-0"
                    }`}
                />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-text-tertiary)] mb-3">Preview</p>
            <div
              className="relative overflow-hidden rounded-xl p-4 flex items-center gap-3"
              style={{
                background: `linear-gradient(145deg, ${form.accentColor}15 0%, ${form.accentColor}35 100%)`,
                border: `1px solid ${form.accentColor}40`,
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: form.accentColor }}
              >
                {form.name?.[0]?.toUpperCase() ?? "S"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm text-[var(--color-text-primary)] truncate">{form.name || "Store Name"}</p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate font-mono">/{form.slug || "slug"}</p>
              </div>
              {form.isActive ? (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-emerald-600">
                  <CheckCircle size={11} /> Active
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[var(--color-text-tertiary)]">
                  <XCircle size={11} /> Inactive
                </span>
              )}
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-6 py-4 shrink-0">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" form="store-form" className="btn-primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : title === "Create Store" ? "Create Store" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  store,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  store: Store;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-sm rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border)] p-6 shadow-[var(--shadow-xl)]"
        style={{ animation: "zoomIn 200ms ease-out both" }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-danger-bg)] mb-4">
          <AlertTriangle size={22} className="text-[var(--color-danger)]" />
        </div>
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Delete "{store.name}"?</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          This will permanently delete the store and all its{" "}
          <strong>{store._count?.products ?? 0} products</strong> and{" "}
          <strong>{store._count?.categories ?? 0} categories</strong>. This action cannot be undone.
        </p>
        <div className="mt-6 flex items-center gap-2 justify-end">
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={isDeleting} className="btn-danger">
            {isDeleting ? "Deleting..." : "Delete Store"}
          </button>
        </div>
      </div>
    </div>
  );
}

const DEFAULT_FORM: StoreFormData = {
  name: "", slug: "", description: "", accentColor: "#6F7F5F", sortOrder: 0, isActive: true,
};

export default function StoresPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);
  const [deletingStore, setDeletingStore] = useState<Store | null>(null);
  const [formInitial, setFormInitial] = useState<StoreFormData>(DEFAULT_FORM);
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "stores", search],
    queryFn: () => api.get<Store[]>(`/admin/stores?search=${search}`),
  });

  const stores = (data?.data ?? []).filter((s) => {
    if (filterStatus === "active") return s.isActive;
    if (filterStatus === "inactive") return !s.isActive;
    return true;
  });

  const createMutation = useMutation({
    mutationFn: (d: StoreFormData) => api.post("/admin/stores", d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "stores"] }); setShowForm(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: Partial<StoreFormData> }) => api.put(`/admin/stores/${id}`, d),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "stores"] }); setShowForm(false); setEditingStore(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/stores/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin", "stores"] }); setDeletingStore(null); },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/admin/stores/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "stores"] }),
  });

  const handleCreate = () => {
    setEditingStore(null);
    setFormInitial(DEFAULT_FORM);
    setShowForm(true);
  };

  const handleEdit = (store: Store) => {
    setEditingStore(store);
    setFormInitial({
      name: store.name,
      slug: store.slug,
      description: store.description ?? "",
      accentColor: store.accentColor ?? "#6F7F5F",
      sortOrder: store.sortOrder,
      isActive: store.isActive,
    });
    setShowForm(true);
  };

  const handleSubmit = (form: StoreFormData) => {
    if (editingStore) {
      updateMutation.mutate({ id: editingStore.id, d: form });
    } else {
      createMutation.mutate(form);
    }
  };

  const totalStores = data?.data?.length ?? 0;
  const activeCount = data?.data?.filter((s) => s.isActive).length ?? 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="page-label">Catalog</p>
          <h1 className="page-title">Stores</h1>
        </div>
        <button onClick={handleCreate} className="btn-primary flex items-center gap-2 self-start sm:self-auto">
          <Plus size={16} /> New Store
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Stores", value: totalStores, icon: StoreIcon, color: "var(--color-accent)" },
          { label: "Active", value: activeCount, icon: CheckCircle, color: "#10B981" },
          { label: "Inactive", value: totalStores - activeCount, icon: XCircle, color: "var(--color-text-tertiary)" },
          { label: "Total Products", value: data?.data?.reduce((a, s) => a + (s._count?.products ?? 0), 0) ?? 0, icon: Package, color: "var(--color-info)" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${color}18` }}>
              <Icon size={16} style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-primary)] leading-none">{value}</p>
              <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 py-2 flex-1 max-w-xs">
          <Search size={14} className="text-[var(--color-text-tertiary)] shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search stores..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--color-text-tertiary)]"
          />
        </div>
        <div className="flex items-center gap-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1">
          {(["all", "active", "inactive"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterStatus(f)}
              className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-medium transition-colors capitalize ${filterStatus === f
                  ? "bg-[var(--color-primary)] text-white"
                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Stores Table */}
      <div className="card overflow-x-auto">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap min-w-[600px]">
            <thead className="border-b border-[var(--color-border)] bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
              <tr>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px]">Store</th>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px]">Slug</th>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px]">Categories</th>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px]">Products</th>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px]">Status</th>
                <th className="px-6 py-3.5 font-semibold uppercase tracking-wider text-[10px] text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="p-4"><div className="h-10 shimmer rounded-lg" /></td>
                  </tr>
                ))
              ) : stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-16 text-center">
                    <StoreIcon size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      {search ? "No stores match your search" : "No stores yet"}
                    </h3>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                      {search ? "Try a different search term." : "Create your first store to get started."}
                    </p>
                    {!search && (
                      <button onClick={handleCreate} className="btn-primary mt-4 mx-auto">
                        <Plus size={14} /> Create Store
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                stores.map((store) => (
                  <tr key={store.id} className="hover:bg-[var(--color-bg-muted)]/50 transition-colors group">
                    <td className="px-6 py-4">
                      <Link href={`/stores/${store.id}`} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-white font-bold text-xs"
                          style={{ backgroundColor: store.accentColor ?? "#6F7F5F" }}
                        >
                          {store.name[0]}
                        </div>
                        <span className="font-semibold text-[var(--color-text-primary)] hover:underline">{store.name}</span>
                      </Link>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-[var(--color-text-secondary)]">/{store.slug}</td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">{store._count?.categories ?? 0}</td>
                    <td className="px-6 py-4 text-[var(--color-text-secondary)]">{store._count?.products ?? 0}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => toggleActiveMutation.mutate({ id: store.id, isActive: !store.isActive })}
                        className="flex items-center gap-1.5 rounded-[var(--radius-full)] border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-2.5 py-1 text-xs font-medium transition-colors hover:border-[var(--color-border-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/20"
                        title={store.isActive ? "Click to deactivate" : "Click to activate"}
                      >
                        {store.isActive ? (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Active
                          </>
                        ) : (
                          <>
                            <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-text-tertiary)]" />
                            Inactive
                          </>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1 transition-opacity">
                        <Link
                          href={`/stores/${store.id}`}
                          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors border border-transparent hover:border-[var(--color-border)] hover:shadow-sm"
                          title="Manage Store"
                        >
                          <ArrowRight size={14} />
                        </Link>
                        <a
                          href={`https://aurazone.shop/store/${store.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-accent)] transition-colors border border-transparent hover:border-[var(--color-border)] hover:shadow-sm"
                          title="Preview"
                        >
                          <ExternalLink size={14} />
                        </a>
                        <button
                          onClick={() => handleEdit(store)}
                          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)] transition-colors border border-transparent hover:border-[var(--color-border)] hover:shadow-sm"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => setDeletingStore(store)}
                          className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-[var(--color-danger)] transition-colors border border-transparent hover:border-red-200"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Store Form Modal */}
      <StoreFormModal
        open={showForm}
        onClose={() => { setShowForm(false); setEditingStore(null); }}
        onSubmit={handleSubmit}
        initialData={formInitial}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        title={editingStore ? "Edit Store" : "Create Store"}
      />

      {/* Delete Confirm Modal */}
      {deletingStore && (
        <DeleteConfirmModal
          store={deletingStore}
          onConfirm={() => deleteMutation.mutate(deletingStore.id)}
          onCancel={() => setDeletingStore(null)}
          isDeleting={deleteMutation.isPending}
        />
      )}
    </div>
  );
}