"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { MapPin, Plus, Trash2, Star } from "lucide-react";
import { AuthGate } from "@/components/providers/AuthGate";

export default function AddressesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", isDefault: false,
  });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const validateField = (field: string, value: string): string => {
    const trimmed = (value || "").trim();
    switch (field) {
      case "name":
        if (!trimmed) return "Full Name is required";
        if (trimmed.length < 2) return "Name must be at least 2 characters";
        if (trimmed.length > 70) return "Name cannot exceed 70 characters";
        if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) return "Name should only contain letters and spaces";
        return "";
      case "phone":
        if (!trimmed) return "Phone number is required";
        const cleanedPhone = trimmed.replace(/\s+/g, "");
        if (!/^(?:\+91[\-\s]?)?[6-9]\d{9}$|^\+?[1-9]\d{9,14}$/.test(cleanedPhone)) {
          return "Please enter a valid 10-digit mobile number (e.g. 9876543210)";
        }
        return "";
      case "addressLine1":
        if (!trimmed) return "Address is required";
        if (trimmed.length < 5) return "Address must be at least 5 characters";
        if (trimmed.length > 120) return "Address cannot exceed 120 characters";
        return "";
      case "addressLine2":
        if (trimmed.length > 120) return "Address Line 2 cannot exceed 120 characters";
        return "";
      case "city":
        if (!trimmed) return "City is required";
        if (trimmed.length < 2) return "City must be at least 2 characters";
        if (trimmed.length > 50) return "City cannot exceed 50 characters";
        if (!/^[a-zA-Z\s.-]+$/.test(trimmed)) return "City should only contain letters and spaces";
        return "";
      case "state":
        if (!trimmed) return "State is required";
        if (trimmed.length < 2) return "State must be at least 2 characters";
        if (trimmed.length > 50) return "State cannot exceed 50 characters";
        return "";
      case "postalCode":
        if (!trimmed) return "PIN code is required";
        if (!/^\d{6}$/.test(trimmed)) return "Please enter a valid 6-digit PIN code (e.g. 400001)";
        return "";
      default:
        return "";
    }
  };

  const handleFieldChange = (field: string, value: string) => {
    let cleanVal = value;
    if (field === "phone") {
      cleanVal = value.replace(/[^\d+]/g, "").slice(0, 13);
    } else if (field === "postalCode") {
      cleanVal = value.replace(/\D/g, "").slice(0, 6);
    }
    setForm(prev => ({ ...prev, [field]: cleanVal }));
    setSubmitError(null);
    const err = validateField(field, cleanVal);
    setFieldErrors(prev => ({ ...prev, [field]: err }));
  };

  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any[]>("/users/addresses"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/users/addresses", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      setShowForm(false);
      setForm({ name: "", phone: "", addressLine1: "", addressLine2: "", city: "", state: "", postalCode: "", isDefault: false });
      setFieldErrors({});
      setSubmitError(null);
    },
    onError: (err: any) => {
      setSubmitError(err.message || "Failed to save address. Please check your inputs.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const errors: Record<string, string> = {};
    for (const field of ["name", "phone", "addressLine1", "city", "state", "postalCode"]) {
      const err = validateField(field, (form as any)[field]);
      if (err) errors[field] = err;
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    createMutation.mutate({
      name: form.name.trim(),
      phone: form.phone.trim(),
      addressLine1: form.addressLine1.trim(),
      addressLine2: form.addressLine2.trim() || undefined,
      city: form.city.trim(),
      state: form.state.trim(),
      postalCode: form.postalCode.trim(),
      country: "IN",
      isDefault: form.isDefault,
    });
  };

  const addresses = data?.data ?? [];

  return (
    <AuthGate pageLabel="your saved addresses" icon={<MapPin size={28} className="text-[var(--color-text-tertiary)]" />}>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Saved Addresses</h2>
        <button onClick={() => { setShowForm(!showForm); setSubmitError(null); setFieldErrors({}); }}
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline">
          <Plus size={14} /> Add Address
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
          {submitError && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <input
                type="text"
                placeholder="Full Name"
                maxLength={70}
                required
                value={form.name}
                onChange={(e) => handleFieldChange("name", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.name ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
              />
              {fieldErrors.name && <p className="text-xs text-rose-600 mt-1">{fieldErrors.name}</p>}
            </div>

            <div>
              <input
                type="tel"
                placeholder="Mobile Number (10 digits)"
                maxLength={13}
                required
                value={form.phone}
                onChange={(e) => handleFieldChange("phone", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.phone ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
              />
              {fieldErrors.phone && <p className="text-xs text-rose-600 mt-1">{fieldErrors.phone}</p>}
            </div>
          </div>

          <div>
            <input
              type="text"
              placeholder="Address Line 1"
              maxLength={120}
              required
              value={form.addressLine1}
              onChange={(e) => handleFieldChange("addressLine1", e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.addressLine1 ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
            />
            {fieldErrors.addressLine1 && <p className="text-xs text-rose-600 mt-1">{fieldErrors.addressLine1}</p>}
          </div>

          <div>
            <input
              type="text"
              placeholder="Address Line 2 (optional)"
              maxLength={120}
              value={form.addressLine2}
              onChange={(e) => handleFieldChange("addressLine2", e.target.value)}
              className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.addressLine2 ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
            />
            {fieldErrors.addressLine2 && <p className="text-xs text-rose-600 mt-1">{fieldErrors.addressLine2}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <input
                type="text"
                placeholder="City"
                maxLength={50}
                required
                value={form.city}
                onChange={(e) => handleFieldChange("city", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.city ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
              />
              {fieldErrors.city && <p className="text-xs text-rose-600 mt-1">{fieldErrors.city}</p>}
            </div>

            <div>
              <input
                type="text"
                placeholder="State"
                maxLength={50}
                required
                value={form.state}
                onChange={(e) => handleFieldChange("state", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.state ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
              />
              {fieldErrors.state && <p className="text-xs text-rose-600 mt-1">{fieldErrors.state}</p>}
            </div>

            <div>
              <input
                type="text"
                inputMode="numeric"
                placeholder="PIN Code (6 digits)"
                maxLength={6}
                required
                value={form.postalCode}
                onChange={(e) => handleFieldChange("postalCode", e.target.value)}
                className={`w-full rounded-lg border px-3 py-2 text-sm outline-none ${fieldErrors.postalCode ? "border-rose-400 ring-1 ring-rose-200" : "border-[var(--color-border)]"}`}
              />
              {fieldErrors.postalCode && <p className="text-xs text-rose-600 mt-1">{fieldErrors.postalCode}</p>}
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setSubmitError(null); }}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving..." : "Save Address"}
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="space-y-3">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-24 shimmer rounded-xl" />)}</div>
      ) : addresses.length === 0 ? (
        <div className="py-12 text-center">
          <MapPin size={40} className="mx-auto text-[var(--color-text-tertiary)] mb-3" />
          <p className="text-sm text-[var(--color-text-secondary)]">No saved addresses.</p>
        </div>
      ) : (
        addresses.map((addr: any) => (
          <div key={addr.id} className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4">
            <MapPin size={16} className="mt-0.5 text-[var(--color-text-tertiary)] shrink-0" />
            <div className="flex-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-medium text-[var(--color-text-primary)]">{addr.name}</span>
                {addr.isDefault && <Star size={12} className="text-amber-500 fill-amber-500" />}
              </div>
              <p className="text-[var(--color-text-secondary)]">{addr.addressLine1}</p>
              {addr.addressLine2 && <p className="text-[var(--color-text-secondary)]">{addr.addressLine2}</p>}
              <p className="text-[var(--color-text-secondary)]">{addr.city}, {addr.state} {addr.postalCode}</p>
              {addr.phone && <p className="text-[var(--color-text-tertiary)] mt-1">{addr.phone}</p>}
            </div>
            <button onClick={() => { if (confirm("Delete this address?")) deleteMutation.mutate(addr.id); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-red-50 hover:text-red-500 transition-colors">
              <Trash2 size={14} />
            </button>
          </div>
        ))
      )}
      </div>
    </AuthGate>
  );
}