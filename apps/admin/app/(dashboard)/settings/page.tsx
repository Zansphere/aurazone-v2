"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Settings, User, Bell, Shield, Palette, Save, Check,
  LogOut, Monitor, Moon, Sun, Key, Trash2, Smartphone,
} from "lucide-react";

type SettingsTab = "profile" | "security" | "notifications" | "appearance";

interface AdminProfile {
  id: string;
  email: string;
  fullName: string | null;
  avatar: string | null;
  role: string;
  phone: string | null;
  createdAt: string;
}

interface NotifPrefs {
  newOrders: boolean;
  orderStatusChange: boolean;
  lowStock: boolean;
  promotions: boolean;
  otherEvents: boolean;
}

interface Session {
  id: string;
  deviceInfo: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<SettingsTab>("profile");

  const tabs = [
    { key: "profile" as SettingsTab, label: "Profile", icon: User },
    { key: "security" as SettingsTab, label: "Security", icon: Shield },
    { key: "notifications" as SettingsTab, label: "Notifications", icon: Bell },
    { key: "appearance" as SettingsTab, label: "Appearance", icon: Palette },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <p className="page-label">System</p>
        <h1 className="page-title">Settings</h1>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-[var(--color-primary)] text-white shadow-sm"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)]"
            }`}
          >
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="fade-in">
        {tab === "profile" && <ProfileTab />}
        {tab === "security" && <SecurityTab />}
        {tab === "notifications" && <NotificationsTab />}
        {tab === "appearance" && <AppearanceTab />}
      </div>
    </div>
  );
}

// ─── Profile Tab ────────────────────────────────────────────────────────────
function ProfileTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "profile"],
    queryFn: () => api.get<AdminProfile>("/admin/profile"),
  });

  const [form, setForm] = useState({ fullName: "", phone: "", avatar: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data?.data) {
      setForm({
        fullName: data.data.fullName ?? "",
        phone: data.data.phone ?? "",
        avatar: data.data.avatar ?? "",
      });
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: (body: typeof form) => api.put("/admin/profile", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "profile"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const profile = data?.data;

  if (isLoading) return <div className="card p-6 h-48 shimmer" />;

  return (
    <div className="space-y-5">
      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Profile Information</p>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-[var(--color-bg-muted)] flex items-center justify-center overflow-hidden">
            {form.avatar ? (
              <img src={form.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <User size={24} className="text-[var(--color-text-tertiary)]" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{profile?.fullName ?? "Admin"}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">{profile?.email}</p>
            <p className="text-[10px] text-[var(--color-text-disabled)] mt-0.5 uppercase">{profile?.role?.replace(/_/g, " ")}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div>
            <label className="form-label">Full Name</label>
            <input type="text" className="form-input" value={form.fullName}
              onChange={(e) => setForm(f => ({ ...f, fullName: e.target.value }))} />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input type="text" className="form-input" value={form.phone}
              onChange={(e) => setForm(f => ({ ...f, phone: e.target.value }))}
              placeholder="+91 98765 43210" />
          </div>
        </div>
        <div>
          <label className="form-label">Avatar URL</label>
          <input type="url" className="form-input text-xs" value={form.avatar}
            onChange={(e) => setForm(f => ({ ...f, avatar: e.target.value }))}
            placeholder="https://..." />
        </div>
        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => updateMutation.mutate(form)}
            className="btn-primary text-xs flex items-center gap-1.5"
            disabled={updateMutation.isPending}
          >
            {saved ? <><Check size={13} /> Saved</> : <><Save size={13} /> {updateMutation.isPending ? "Saving..." : "Save Changes"}</>}
          </button>
          {updateMutation.error && (
            <p className="text-xs text-[var(--color-danger)]">{updateMutation.error.message}</p>
          )}
        </div>
      </div>

      <div className="card p-5 space-y-2">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Account Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)]">Email</p>
            <p className="text-[var(--color-text-primary)] font-mono text-xs">{profile?.email}</p>
          </div>
          <div>
            <p className="text-xs text-[var(--color-text-tertiary)]">Member Since</p>
            <p className="text-[var(--color-text-primary)] text-xs">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Security Tab ───────────────────────────────────────────────────────────
function SecurityTab() {
  const queryClient = useQueryClient();
  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSaved, setPwSaved] = useState(false);

  const { data: sessionsData, isLoading: sessionsLoading } = useQuery({
    queryKey: ["admin", "sessions"],
    queryFn: () => api.get<Session[]>("/admin/sessions"),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (body: { currentPassword: string; newPassword: string }) =>
      api.put("/admin/profile/password", body),
    onSuccess: () => {
      setPwSaved(true);
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setPwSaved(false), 3000);
    },
  });

  const revokeSessionMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/sessions/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "sessions"] }),
  });

  const sessions = sessionsData?.data ?? [];

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) return;
    changePasswordMutation.mutate({
      currentPassword: pwForm.currentPassword,
      newPassword: pwForm.newPassword,
    });
  };

  return (
    <div className="space-y-5">
      {/* Change Password */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
          <Key size={12} /> Change Password
        </p>
        <form onSubmit={handlePasswordSubmit} className="space-y-3">
          <div>
            <label className="form-label">Current Password</label>
            <input type="password" className="form-input" required value={pwForm.currentPassword}
              onChange={(e) => setPwForm(f => ({ ...f, currentPassword: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">New Password</label>
              <input type="password" className="form-input" required minLength={8} value={pwForm.newPassword}
                onChange={(e) => setPwForm(f => ({ ...f, newPassword: e.target.value }))} />
            </div>
            <div>
              <label className="form-label">Confirm Password</label>
              <input type="password" className="form-input" required value={pwForm.confirmPassword}
                onChange={(e) => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))} />
              {pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
                <p className="text-[10px] text-[var(--color-danger)] mt-0.5">Passwords don't match</p>
              )}
            </div>
          </div>
          <button type="submit" className="btn-primary text-xs flex items-center gap-1.5"
            disabled={changePasswordMutation.isPending || pwForm.newPassword !== pwForm.confirmPassword}>
            {pwSaved ? <><Check size={13} /> Updated</> : <><Shield size={13} /> Update Password</>}
          </button>
          {changePasswordMutation.error && (
            <p className="text-xs text-[var(--color-danger)]">{changePasswordMutation.error.message}</p>
          )}
        </form>
      </div>

      {/* Active Sessions */}
      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide flex items-center gap-1.5">
          <Smartphone size={12} /> Active Sessions
        </p>
        {sessionsLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <div key={i} className="h-12 shimmer rounded-lg" />)}</div>
        ) : sessions.length === 0 ? (
          <p className="text-xs text-[var(--color-text-tertiary)]">No active sessions found</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-primary)]">{s.deviceInfo || "Unknown Device"}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)]">
                    IP: {s.ipAddress} · Created {new Date(s.createdAt).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <button onClick={() => revokeSessionMutation.mutate(s.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md hover:bg-red-50 text-[var(--color-text-tertiary)] hover:text-red-500">
                  <LogOut size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Notifications Tab ──────────────────────────────────────────────────────
function NotificationsTab() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "notification-prefs"],
    queryFn: () => api.get<NotifPrefs>("/admin/notification-preferences"),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Partial<NotifPrefs>) => api.put("/admin/notification-preferences", body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "notification-prefs"] }),
  });

  const prefs = data?.data;

  const togglePref = (key: keyof NotifPrefs) => {
    if (!prefs) return;
    updateMutation.mutate({ [key]: !prefs[key] });
  };

  const items = [
    { key: "newOrders" as keyof NotifPrefs, label: "New Orders", desc: "Get notified when a new order is placed" },
    { key: "orderStatusChange" as keyof NotifPrefs, label: "Order Status Changes", desc: "Updates when order status changes" },
    { key: "lowStock" as keyof NotifPrefs, label: "Low Stock Alerts", desc: "Alert when inventory drops below threshold" },
    { key: "promotions" as keyof NotifPrefs, label: "Promotions", desc: "Marketing and promotional updates" },
    { key: "otherEvents" as keyof NotifPrefs, label: "Other Events", desc: "Miscellaneous system notifications" },
  ];

  if (isLoading) return <div className="card p-6 h-48 shimmer" />;

  return (
    <div className="card p-5 space-y-1">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-3">
        Email & Push Notifications
      </p>
      {items.map((item) => (
        <div key={item.key} className="flex items-center justify-between py-3 border-b border-[var(--color-border)] last:border-0">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</p>
            <p className="text-xs text-[var(--color-text-tertiary)]">{item.desc}</p>
          </div>
          <button
            onClick={() => togglePref(item.key)}
            className={`flex h-6 w-11 items-center rounded-full px-0.5 transition-colors ${
              prefs?.[item.key] ? "bg-[var(--color-accent)]" : "bg-gray-300"
            }`}
          >
            <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
              prefs?.[item.key] ? "translate-x-5" : "translate-x-0"
            }`} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Appearance Tab ─────────────────────────────────────────────────────────
function AppearanceTab() {
  const [theme, setTheme] = useState<string>("system");

  useEffect(() => {
    const saved = localStorage.getItem("aurazone-admin-theme") ?? "system";
    setTheme(saved);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const current = localStorage.getItem("aurazone-admin-theme") ?? "system";
      if (current === "system") {
        document.documentElement.classList.toggle("dark", mediaQuery.matches);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  const applyTheme = (t: string) => {
    setTheme(t);
    localStorage.setItem("aurazone-admin-theme", t);

    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
    } else if (t === "light") {
      root.classList.remove("dark");
    } else {
      // System preference
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.classList.toggle("dark", isDark);
    }
  };

  const themes = [
    { key: "light", label: "Light", icon: Sun, desc: "Classic light theme" },
    { key: "dark", label: "Dark", icon: Moon, desc: "Easy on the eyes" },
    { key: "system", label: "System", icon: Monitor, desc: "Follows OS preference" },
  ];

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide">Theme</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-0.5">Customize the visual appearance of the admin panel</p>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-bg-muted)] text-[var(--color-text-secondary)] capitalize">
          Current: {theme}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {themes.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => applyTheme(t.key)}
            className={`rounded-xl border-2 p-4 text-center transition-all hover:shadow-md cursor-pointer ${
              theme === t.key
                ? "border-[var(--color-accent)] bg-[var(--color-accent-light)]"
                : "border-[var(--color-border)] hover:border-[var(--color-text-tertiary)] bg-[var(--color-bg-surface)]"
            }`}
          >
            <t.icon size={24} className={`mx-auto mb-2 ${theme === t.key ? "text-[var(--color-accent)]" : "text-[var(--color-text-tertiary)]"}`} />
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t.label}</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5">{t.desc}</p>
          </button>
        ))}
      </div>
    </div>
  );
}