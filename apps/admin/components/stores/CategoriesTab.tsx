"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Trash2, Edit2, FolderTree, ChevronDown, ChevronRight,
  CheckCircle, XCircle, X, AlertCircle,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  parentId: string | null;
  parent: { id: string; name: string; slug: string } | null;
  children: Array<{ id: string; name: string; slug: string; isActive: boolean }>;
  _count: { products: number };
}

export default function CategoriesTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [localError, setLocalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", slug: "", description: "", parentId: "" as string | null, isActive: true,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "categories", storeId],
    queryFn: () => api.get<Category[]>(`/admin/categories?storeId=${storeId}&take=200`),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/categories", data),
    onSuccess: () => { invalidate(); resetForm(); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/admin/categories/${id}`, data),
    onSuccess: () => { invalidate(); resetForm(); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/categories/${id}`),
    onSuccess: () => invalidate(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin", "categories", storeId] });
    queryClient.invalidateQueries({ queryKey: ["admin", "store", storeId] });
  };

  const categories: Category[] = (data as any)?.data ?? [];
  const rootCategories = categories.filter(c => !c.parentId);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setLocalError(null);
    createMutation.reset();
    updateMutation.reset();
    setForm({ name: "", slug: "", description: "", parentId: null, isActive: true });
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setLocalError(null);
    createMutation.reset();
    updateMutation.reset();
    setShowForm(true);
    setForm({
      name: cat.name, slug: cat.slug, description: cat.description ?? "",
      parentId: cat.parentId, isActive: cat.isActive,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedName = form.name.trim();
    const resolvedSlug = (form.slug || slugify(trimmedName)).trim().toLowerCase();

    // Duplicate check scoped strictly to THIS store
    const duplicate = categories.find(
      (c) =>
        c.id !== editingId &&
        (c.name.trim().toLowerCase() === trimmedName.toLowerCase() ||
          c.slug.trim().toLowerCase() === resolvedSlug)
    );

    if (duplicate) {
      if (duplicate.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
        setLocalError(`A category named "${trimmedName}" already exists in this store.`);
      } else {
        setLocalError(`A category with slug "${resolvedSlug}" already exists in this store.`);
      }
      return;
    }

    const payload = {
      storeId,
      name: trimmedName,
      slug: resolvedSlug,
      description: form.description || undefined,
      parentId: form.parentId || null,
      isActive: form.isActive,
    };

    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const activeError =
    localError ||
    (createMutation.error as any)?.message ||
    (updateMutation.error as any)?.message;

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-14 shimmer rounded-lg" />)}</div>;
  }

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <FolderTree size={16} /> Categories ({categories.length})
        </h3>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary flex items-center gap-2 text-xs"
        >
          <Plus size={14} /> Add Category
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-4 space-y-3 fade-in">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              {editingId ? "Edit Category" : "New Category"}
            </p>
            <button type="button" onClick={resetForm} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)]">
              <X size={14} />
            </button>
          </div>

          {activeError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 p-2.5 text-xs text-red-600 dark:text-red-400">
              <AlertCircle size={14} className="shrink-0" />
              <span>{activeError}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label" htmlFor="cat-name">Name</label>
              <input
                id="cat-name"
                type="text" className="form-input" required
                value={form.name}
                onChange={(e) => {
                  setLocalError(null);
                  setForm(f => ({
                    ...f, name: e.target.value,
                    slug: editingId ? f.slug : slugify(e.target.value),
                  }));
                }}
              />
            </div>
            <div>
              <label className="form-label" htmlFor="cat-slug">Slug</label>
              <input
                id="cat-slug"
                type="text" className="form-input font-mono text-xs"
                value={form.slug}
                onChange={(e) => {
                  setLocalError(null);
                  setForm(f => ({ ...f, slug: e.target.value }));
                }}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Parent Category</label>
              <select
                className="form-input"
                value={form.parentId ?? ""}
                onChange={(e) => setForm(f => ({ ...f, parentId: e.target.value || null }))}
              >
                <option value="">None (Root)</option>
                {rootCategories.filter(c => c.id !== editingId).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={form.isActive ? "active" : "inactive"}
                onChange={(e) => setForm(f => ({ ...f, isActive: e.target.value === "active" }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input text-xs resize-y min-h-[60px]"
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Optional description..."
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={resetForm} className="btn-secondary text-xs">Cancel</button>
            <button
              type="submit" className="btn-primary text-xs"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingId ? "Update" : "Create"}
            </button>
          </div>
        </form>
      )}

      {/* Category Tree */}
      <div className="space-y-1">
        {rootCategories.map((cat) => {
          const expanded = expandedIds.has(cat.id);
          const hasChildren = cat.children && cat.children.length > 0;

          return (
            <div key={cat.id}>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[var(--color-bg-muted)] transition-colors group">
                <button
                  onClick={() => hasChildren && toggleExpand(cat.id)}
                  className={`flex h-5 w-5 items-center justify-center rounded text-[var(--color-text-tertiary)] ${hasChildren ? "hover:bg-[var(--color-border)] cursor-pointer" : "invisible"}`}
                >
                  {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)]">{cat.name}</p>
                  <p className="text-[10px] font-mono text-[var(--color-text-tertiary)]">/{cat.slug}</p>
                </div>
                <span className="text-[10px] text-[var(--color-text-tertiary)] tabular-nums">
                  {cat._count?.products ?? 0} products
                </span>
                {cat.isActive
                  ? <CheckCircle size={14} className="text-emerald-500" />
                  : <XCircle size={14} className="text-gray-400" />
                }
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(cat)}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)]"
                  >
                    <Edit2 size={12} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${cat.name}"?`)) deleteMutation.mutate(cat.id); }}
                    className="flex h-6 w-6 items-center justify-center rounded hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Children */}
              {expanded && hasChildren && (
                <div className="ml-7 border-l border-[var(--color-border-muted)] pl-2 space-y-0.5">
                  {cat.children.map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-muted)] transition-colors group">
                      <span className="text-[var(--color-text-tertiary)] text-xs">└</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--color-text-secondary)]">{sub.name}</p>
                        <p className="text-[10px] font-mono text-[var(--color-text-tertiary)]">/{sub.slug}</p>
                      </div>
                      {sub.isActive
                        ? <CheckCircle size={12} className="text-emerald-500" />
                        : <XCircle size={12} className="text-gray-400" />
                      }
                      <button
                        onClick={() => { if (confirm(`Delete "${sub.name}"?`)) deleteMutation.mutate(sub.id); }}
                        className="flex h-5 w-5 items-center justify-center rounded hover:bg-red-50 text-[var(--color-text-secondary)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}

        {categories.length === 0 && (
          <div className="py-8 text-center">
            <FolderTree size={28} className="mx-auto text-[var(--color-text-tertiary)] mb-2" />
            <p className="text-sm text-[var(--color-text-secondary)]">No categories yet</p>
            <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Add categories to organize products in this store</p>
          </div>
        )}
      </div>
    </div>
  );
}
