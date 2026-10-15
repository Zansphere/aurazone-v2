"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ArrowLeft, Plus, Trash2, X, Wand2, Package, Check } from "lucide-react";
import ImageUploader from "@/components/ui/ImageUploader";

interface AttributeTemplate {
  id: string;
  name: string;
  key: string;
  fieldType: string;
  options: string[] | null;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  isVariant: boolean;
  isFilterable: boolean;
}

interface UploadedImage {
  id?: string;
  url: string;
  position: number;
}

interface VariantForm {
  id?: string; // populated when editing
  sku: string;
  price: string;
  compareAtPrice: string;
  quantity: string;
  attributes: Record<string, string>;
  images: UploadedImage[];
}

export default function ProductForm({
  storeId,
  productId,
  onClose,
  onSuccess,
}: {
  storeId?: string;
  productId?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();

  // Fetch product first if editing
  const { data: productData } = useQuery({
    queryKey: ["admin", "product", productId],
    queryFn: () => api.get<any>(`/admin/products/${productId}`),
    enabled: !!productId,
  });

  const effectiveStoreId = storeId || productData?.data?.storeId || productData?.data?.store?.id;

  // Fetch attribute templates for this store
  const { data: templatesData } = useQuery({
    queryKey: ["admin", "attribute-templates", effectiveStoreId],
    queryFn: () => api.get<AttributeTemplate[]>(`/admin/attribute-templates?storeId=${effectiveStoreId}&take=200`),
    enabled: !!effectiveStoreId,
  });

  // Fetch categories for this store
  const { data: catsData } = useQuery({
    queryKey: ["admin", "categories", effectiveStoreId],
    queryFn: () => api.get<any[]>(`/admin/categories?storeId=${effectiveStoreId}&take=200`),
    enabled: !!effectiveStoreId,
  });

  const templates: AttributeTemplate[] = (templatesData as any)?.data ?? [];
  const categories: any[] = (catsData as any)?.data ?? [];
  const variantTemplates = templates.filter(t => t.isVariant);
  const nonVariantTemplates = templates.filter(t => !t.isVariant);

  // Form state
  const [form, setForm] = useState({
    name: "",
    slug: "",
    brand: "",
    categoryId: "",
    description: "",
    shortDescription: "",
    tags: "",
    isActive: true,
    isFeatured: false,
  });

  const [variants, setVariants] = useState<VariantForm[]>([
    { sku: "", price: "", compareAtPrice: "", quantity: "1", attributes: {}, images: [] },
  ]);

  const [productAttrs, setProductAttrs] = useState<Record<string, string>>({});

  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load existing product data when editing
  useEffect(() => {
    if (productData?.data && productId) {
      const p = productData.data;
      setForm({
        name: p.name ?? "",
        slug: p.slug ?? "",
        brand: p.brand ?? "",
        categoryId: p.categoryId ?? "",
        description: p.description ?? "",
        shortDescription: p.shortDescription ?? "",
        tags: p.tags?.join(", ") ?? "",
        isActive: p.isActive ?? true,
        isFeatured: p.isFeatured ?? false,
      });

      if (p.variants?.length) {
        setVariants(
          p.variants.map((v: any) => ({
            id: v.id,
            sku: v.sku ?? "",
            price: String(v.price ?? ""),
            compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "",
            quantity: String(Math.max(1, v.inventory?.quantity ?? 1)),
            attributes: (v.attributes ?? []).reduce(
              (acc: Record<string, string>, a: any) => ({ ...acc, [a.key]: a.value }),
              {}
            ),
            images: (v.images ?? []).map((img: any, i: number) => ({
              id: img.id,
              url: img.url,
              position: img.position ?? i,
            })),
          }))
        );
      }
    }
  }, [productData, productId]);

  const slugify = (text: string) =>
    text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  // Auto-generate variant combinations
  const generateVariantMatrix = () => {
    if (variantTemplates.length === 0) return;

    // Collect options for each variant attribute
    const optionSets: Array<{ key: string; values: string[] }> = [];
    for (const tmpl of variantTemplates) {
      if (tmpl.options && tmpl.options.length > 0) {
        optionSets.push({ key: tmpl.key, values: tmpl.options as string[] });
      }
    }

    if (optionSets.length === 0) return;

    // Cartesian product
    const combinations = optionSets.reduce<Array<Record<string, string>>>(
      (acc, { key, values }) => {
        if (acc.length === 0) return values.map(v => ({ [key]: v }));
        return acc.flatMap(combo => values.map(v => ({ ...combo, [key]: v })));
      },
      []
    );

    setVariants(
      combinations.map((attrs, i) => ({
        sku: `${slugify(form.name || "product")}-${Object.values(attrs).join("-").toLowerCase()}`,
        price: variants[0]?.price || "",
        compareAtPrice: "",
        quantity: "1",
        attributes: attrs,
        images: [],
      }))
    );
  };

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/admin/products", data),
    onSuccess: async (result: any) => {
      // After product creation, upload images for each variant
      const createdProduct = result?.data;
      if (createdProduct?.variants) {
        await uploadVariantImages(createdProduct.id, createdProduct.variants);
      }
      onSuccess();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: any) => api.put(`/admin/products/${productId}`, data),
    onSuccess: async () => {
      // Handle image additions/deletions for existing product
      if (productId) {
        await syncVariantImages(productId);
      }
      onSuccess();
    },
  });

  /** Upload images for newly created variants */
  const uploadVariantImages = async (prodId: string, createdVariants: any[]) => {
    for (let i = 0; i < variants.length; i++) {
      const variantForm = variants[i];
      const createdVariant = createdVariants[i];
      if (!createdVariant || variantForm.images.length === 0) continue;

      try {
        await api.post(`/admin/products/${prodId}/variants/${createdVariant.id}/images`, {
          urls: variantForm.images.map((img, idx) => ({
            url: img.url,
            position: idx,
          })),
        });
      } catch (err) {
        console.error("Failed to save variant images:", err);
      }
    }
  };

  /** Sync images for existing product (add new, delete removed) */
  const syncVariantImages = async (prodId: string) => {
    // Delete removed images
    for (const imageId of deletedImageIds) {
      try {
        await api.delete(`/admin/products/${prodId}/images/${imageId}`);
      } catch (err) {
        console.error("Failed to delete image:", err);
      }
    }

    // Add new images (those without an id)
    for (const variant of variants) {
      if (!variant.id) continue;
      const newImages = variant.images.filter(img => !img.id);
      if (newImages.length === 0) continue;

      try {
        await api.post(`/admin/products/${prodId}/variants/${variant.id}/images`, {
          urls: newImages.map((img, idx) => ({
            url: img.url,
            position: (variant.images.length - newImages.length) + idx,
          })),
        });
      } catch (err) {
        console.error("Failed to save new variant images:", err);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!effectiveStoreId) {
      setValidationError("Store ID is required to save the product.");
      return;
    }

    // Validate that no variant has quantity < 1
    for (let i = 0; i < variants.length; i++) {
      const q = parseInt(variants[i].quantity, 10);
      if (isNaN(q) || q < 1) {
        setValidationError(`Stock quantity for Variant #${i + 1} must be at least 1.`);
        return;
      }
      if (!variants[i].price || parseFloat(variants[i].price) <= 0) {
        setValidationError(`Price for Variant #${i + 1} must be greater than 0.`);
        return;
      }
    }

    const payload = {
      storeId: effectiveStoreId,
      name: form.name,
      slug: form.slug || undefined,
      brand: form.brand || undefined,
      categoryId: form.categoryId,
      description: form.description || undefined,
      shortDescription: form.shortDescription || undefined,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      isActive: form.isActive,
      isFeatured: form.isFeatured,
      hasVariants: variants.length > 1,
      variants: variants.map(v => ({
        id: v.id,
        sku: v.sku || undefined,
        price: parseFloat(v.price),
        compareAtPrice: v.compareAtPrice ? parseFloat(v.compareAtPrice) : undefined,
        quantity: Math.max(1, parseInt(v.quantity, 10) || 1),
        isAvailable: true,
        attributes: Object.entries(v.attributes)
          .filter(([, val]) => val)
          .map(([key, value]) => ({ key, value })),
        images: v.images,
      })),
    };

    if (productId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const addVariant = () => {
    setVariants(prev => [
      ...prev,
      { sku: "", price: prev[0]?.price || "", compareAtPrice: "", quantity: "1", attributes: {}, images: [] },
    ]);
  };

  const removeVariant = (index: number) => {
    // Track deleted image IDs from removed variant
    const removed = variants[index];
    if (removed.images) {
      const ids = removed.images.filter(img => img.id).map(img => img.id!);
      setDeletedImageIds(prev => [...prev, ...ids]);
    }
    setVariants(prev => prev.filter((_, i) => i !== index));
  };

  const updateVariant = (index: number, field: string, value: string) => {
    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, [field]: value } : v
    ));
  };

  const updateVariantAttr = (index: number, key: string, value: string) => {
    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, attributes: { ...v.attributes, [key]: value } } : v
    ));
  };

  const updateVariantImages = (index: number, images: UploadedImage[]) => {
    setVariants(prev => prev.map((v, i) =>
      i === index ? { ...v, images } : v
    ));
  };

  const handleImageRemove = (variantIdx: number, imageIdx: number) => {
    const img = variants[variantIdx].images[imageIdx];
    if (img.id) {
      setDeletedImageIds(prev => [...prev, img.id!]);
    }
    const updated = variants[variantIdx].images
      .filter((_, i) => i !== imageIdx)
      .map((img, i) => ({ ...img, position: i }));
    updateVariantImages(variantIdx, updated);
  };

  // Dynamic field renderer
  const renderField = (
    tmpl: AttributeTemplate,
    value: string,
    onChange: (val: string) => void,
  ) => {
    switch (tmpl.fieldType) {
      case "TEXT":
        return (
          <input type="text" className="form-input text-xs" value={value} onChange={e => onChange(e.target.value)}
            placeholder={tmpl.placeholder ?? ""} required={tmpl.isRequired} />
        );
      case "NUMBER":
        return (
          <input type="number" className="form-input text-xs" value={value} onChange={e => onChange(e.target.value)}
            placeholder={tmpl.placeholder ?? ""} required={tmpl.isRequired} />
        );
      case "SELECT":
        return (
          <select className="form-input text-xs" value={value} onChange={e => onChange(e.target.value)} required={tmpl.isRequired}>
            <option value="">Select {tmpl.name}</option>
            {(tmpl.options as string[] ?? []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "MULTI_SELECT":
        return (
          <select className="form-input text-xs" value={value} onChange={e => onChange(e.target.value)} multiple>
            {(tmpl.options as string[] ?? []).map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );
      case "COLOR_PICKER":
        return (
          <div className="flex items-center gap-2">
            <input type="color" className="h-8 w-8 rounded cursor-pointer border-0" value={value || "#000000"} onChange={e => onChange(e.target.value)} />
            <input type="text" className="form-input text-xs flex-1 font-mono" value={value} onChange={e => onChange(e.target.value)}
              placeholder="#000000" />
          </div>
        );
      case "BOOLEAN":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="h-3.5 w-3.5 rounded accent-[var(--color-accent)]"
              checked={value === "true"} onChange={e => onChange(String(e.target.checked))} />
            <span className="text-xs text-[var(--color-text-secondary)]">{tmpl.name}</span>
          </label>
        );
      default:
        return (
          <input type="text" className="form-input text-xs" value={value} onChange={e => onChange(e.target.value)}
            placeholder={tmpl.placeholder ?? ""} />
        );
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const errorMsg = (createMutation.error || updateMutation.error)?.message;
  const isSlugError = errorMsg?.toLowerCase().includes("slug already taken");
  const isNameError = errorMsg?.toLowerCase().includes("product name already exists");

  return (
    <div className="space-y-4 fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)]">
          <ArrowLeft size={16} />
        </button>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {productId ? "Edit Product" : "New Product"}
        </h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ─── Basic Info ─────────────────────────── */}
        <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Basic Information</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Product Name</label>
              <input type="text" className={`form-input ${isNameError ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`} required value={form.name}
                onChange={(e) => {
                  setForm(f => ({
                    ...f, name: e.target.value,
                    slug: productId ? f.slug : slugify(e.target.value),
                  }));
                  if (createMutation.error) createMutation.reset();
                  if (updateMutation.error) updateMutation.reset();
                }} />
              {isNameError && <p className="text-[10px] text-[var(--color-danger)] mt-1">A product with this name already exists in this store.</p>}
            </div>
            <div>
              <label className="form-label">Slug</label>
              <input type="text" className={`form-input font-mono text-xs ${isSlugError ? 'border-[var(--color-danger)] focus:ring-[var(--color-danger)]' : ''}`} value={form.slug}
                onChange={(e) => {
                  setForm(f => ({ ...f, slug: e.target.value }));
                  if (createMutation.error) createMutation.reset();
                  if (updateMutation.error) updateMutation.reset();
                }} />
              {isSlugError && <p className="text-[10px] text-[var(--color-danger)] mt-1">This slug is already taken. Please choose a unique one.</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="form-label !mb-0">Category</label>
                {storeId && !isCreatingCategory && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingCategory(true)}
                    className="text-[10px] text-[var(--color-accent)] hover:underline font-medium"
                  >
                    + Quick Create
                  </button>
                )}
              </div>
              
              {isCreatingCategory ? (
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    autoFocus
                    className="form-input py-2 text-sm flex-1"
                    placeholder="Category name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newCategoryName) {
                          api.post("/admin/categories", {
                            storeId,
                            name: newCategoryName,
                            slug: slugify(newCategoryName),
                            isActive: true,
                          }).then((res: any) => {
                            const evt = new Event("focus");
                            window.dispatchEvent(evt); 
                            setForm(f => ({ ...f, categoryId: res.data.id }));
                            setIsCreatingCategory(false);
                            setNewCategoryName("");
                          }).catch(err => alert(err.message));
                        }
                      } else if (e.key === "Escape") {
                        setIsCreatingCategory(false);
                        setNewCategoryName("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newCategoryName) {
                        api.post("/admin/categories", {
                          storeId,
                          name: newCategoryName,
                          slug: slugify(newCategoryName),
                          isActive: true,
                        }).then((res: any) => {
                          const evt = new Event("focus");
                          window.dispatchEvent(evt); 
                          setForm(f => ({ ...f, categoryId: res.data.id }));
                          setIsCreatingCategory(false);
                          setNewCategoryName("");
                        }).catch(err => alert(err.message));
                      }
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white hover:bg-black transition-colors"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingCategory(false);
                      setNewCategoryName("");
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--color-border)] text-gray-500 hover:bg-gray-50 transition-colors"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <select className="form-input" required value={form.categoryId}
                  onChange={(e) => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">Select category</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}

              {storeId && categories.length === 0 && !isCreatingCategory && (
                <p className="text-xs text-amber-500 mt-1">This store has no categories. Create one first.</p>
              )}
            </div>
            <div>
              <label className="form-label">Brand</label>
              <input type="text" className="form-input text-xs" value={form.brand}
                onChange={(e) => setForm(f => ({ ...f, brand: e.target.value }))}
                placeholder="Optional brand name" />
            </div>
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea className="form-input min-h-[80px] resize-y text-xs" value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Product description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Tags (comma-separated)</label>
              <input type="text" className="form-input text-xs" value={form.tags}
                onChange={(e) => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="summer, sale, new" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" className="h-3.5 w-3.5 rounded accent-[var(--color-accent)]"
                  checked={form.isActive} onChange={(e) => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                <span className="text-xs text-[var(--color-text-secondary)]">Active</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer pb-2">
                <input type="checkbox" className="h-3.5 w-3.5 rounded accent-[var(--color-warning)]"
                  checked={form.isFeatured} onChange={(e) => setForm(f => ({ ...f, isFeatured: e.target.checked }))} />
                <span className="text-xs text-[var(--color-text-secondary)]">Featured</span>
              </label>
            </div>
          </div>
        </div>

        {/* ─── Non-Variant Attributes (product-level) ─────────────────────────── */}
        {nonVariantTemplates.length > 0 && (
          <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Product Attributes</p>
            <div className="grid grid-cols-2 gap-3">
              {nonVariantTemplates.map(tmpl => (
                <div key={tmpl.id}>
                  <label className="form-label flex items-center gap-1">
                    {tmpl.name}
                    {tmpl.isRequired && <span className="text-[var(--color-danger)]">*</span>}
                  </label>
                  {renderField(tmpl, productAttrs[tmpl.key] ?? "", (val) =>
                    setProductAttrs(prev => ({ ...prev, [tmpl.key]: val }))
                  )}
                  {tmpl.helpText && (
                    <p className="text-[10px] text-[var(--color-text-tertiary)] mt-0.5">{tmpl.helpText}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Variants ─────────────────────────── */}
        <div className="rounded-lg border border-[var(--color-border)] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">
              Variants ({variants.length})
            </p>
            <div className="flex items-center gap-2">
              {variantTemplates.length > 0 && (
                <button type="button" onClick={generateVariantMatrix}
                  className="btn-secondary text-[10px] flex items-center gap-1 py-1 px-2">
                  <Wand2 size={11} /> Auto-Generate
                </button>
              )}
              <button type="button" onClick={addVariant}
                className="btn-secondary text-[10px] flex items-center gap-1 py-1 px-2">
                <Plus size={11} /> Add Variant
              </button>
            </div>
          </div>

          {variants.map((variant, idx) => (
            <div key={idx} className="rounded-md border border-[var(--color-border-muted)] bg-[var(--color-bg-base)] p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)]">Variant #{idx + 1}</p>
                {variants.length > 1 && (
                  <button type="button" onClick={() => removeVariant(idx)}
                    className="text-[var(--color-text-tertiary)] hover:text-red-500">
                    <X size={12} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="form-label">SKU</label>
                  <input type="text" className="form-input text-xs font-mono" value={variant.sku}
                    onChange={(e) => updateVariant(idx, "sku", e.target.value)}
                    placeholder="Auto-generated" />
                </div>
                <div>
                  <label className="form-label">Price (₹)</label>
                  <input type="number" className="form-input text-xs" required step="0.01" min="0"
                    value={variant.price} onChange={(e) => updateVariant(idx, "price", e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Compare At</label>
                  <input type="number" className="form-input text-xs" step="0.01" min="0"
                    value={variant.compareAtPrice}
                    onChange={(e) => updateVariant(idx, "compareAtPrice", e.target.value)}
                    placeholder="Original price" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="form-label !mb-0">Stock Qty</label>
                    <span className="text-[10px] text-[var(--color-text-tertiary)]">Min 1</span>
                  </div>
                  <input
                    type="number"
                    className="form-input text-xs"
                    min="1"
                    step="1"
                    required
                    value={variant.quantity}
                    onKeyDown={(e) => {
                      if (e.key === "-" || e.key === "e" || e.key === "E" || e.key === "." || e.key === "+") {
                        e.preventDefault();
                      }
                    }}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "") {
                        updateVariant(idx, "quantity", "");
                      } else {
                        const num = parseInt(val, 10);
                        if (isNaN(num) || num < 1) {
                          updateVariant(idx, "quantity", "1");
                        } else {
                          updateVariant(idx, "quantity", String(num));
                        }
                      }
                    }}
                    onBlur={(e) => {
                      const num = parseInt(e.target.value, 10);
                      if (isNaN(num) || num < 1) {
                        updateVariant(idx, "quantity", "1");
                      }
                    }}
                    placeholder="Min 1"
                  />
                </div>
              </div>

              {/* Variant Attributes (from templates) */}
              {variantTemplates.length > 0 && (
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {variantTemplates.map(tmpl => (
                    <div key={tmpl.id}>
                      <label className="form-label text-[10px]">{tmpl.name}</label>
                      {renderField(
                        tmpl,
                        variant.attributes[tmpl.key] ?? "",
                        (val) => updateVariantAttr(idx, tmpl.key, val)
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Variant Images */}
              <ImageUploader
                label="Images"
                images={variant.images}
                onChange={(imgs) => updateVariantImages(idx, imgs)}
                maxImages={8}
              />
            </div>
          ))}
        </div>

        {/* ─── Submit ─────────────────────────── */}
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary text-xs">Cancel</button>
          <button type="submit" className="btn-primary text-xs" disabled={isPending}>
            {isPending ? "Saving..." : productId ? "Update Product" : "Create Product"}
          </button>
        </div>

        {validationError && (
          <p className="text-xs text-[var(--color-danger)] mt-1 font-medium bg-red-50 p-2 rounded border border-red-200">
            {validationError}
          </p>
        )}

        {(createMutation.error || updateMutation.error) && !isSlugError && !isNameError && (
          <p className="text-xs text-[var(--color-danger)] mt-1 font-medium bg-red-50 p-2 rounded border border-red-200">
            {errorMsg}
          </p>
        )}
      </form>
    </div>
  );
}
