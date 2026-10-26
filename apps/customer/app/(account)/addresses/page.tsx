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

  const { data, isLoading } = useQuery({
    queryKey: ["addresses"],
    queryFn: () => api.get<any[]>("/users/addresses"),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => api.post("/users/addresses", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["addresses"] }); setShowForm(false); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/users/addresses/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const addresses = data?.data ?? [];

  return (
    <AuthGate pageLabel="your saved addresses" icon={<MapPin size={28} className="text-[var(--color-text-tertiary)]" />}>
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Saved Addresses</h2>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1 text-xs font-medium text-[var(--color-accent)] hover:underline">
          <Plus size={14} /> Add Address
        </button>
      </div>

      {showForm && (
        <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form); }}
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" placeholder="Full Name" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
            <input type="tel" placeholder="Phone" required value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
          </div>
          <input type="text" placeholder="Address Line 1" required value={form.addressLine1}
            onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
          <input type="text" placeholder="Address Line 2 (optional)" value={form.addressLine2}
            onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
            className="w-full rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input type="text" placeholder="City" required value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
            <input type="text" placeholder="State" required value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
            <input type="text" placeholder="Postal Code" required value={form.postalCode}
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
              className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-xs">Cancel</button>
            <button type="submit" disabled={createMutation.isPending}
              className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-xs font-semibold text-white">
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