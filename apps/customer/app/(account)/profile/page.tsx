"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth.store";
import { api } from "@/lib/api";
import {
  User,
  Mail,
  Shield,
  Camera,
  Phone,
  KeyRound,
  Trash2,
  AlertTriangle,
  Check,
  X,
} from "lucide-react";

export default function ProfilePage() {
  const { user, fetchUser, logout } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile info state
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState((user as any)?.phone ?? "");
  const [avatar, setAvatar] = useState(user?.avatar ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileError, setProfileError] = useState("");

  // Change password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  // Delete account state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (user) {
      setFullName(user.fullName ?? "");
      setPhone((user as any).phone ?? "");
      setAvatar(user.avatar ?? "");
    }
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setProfileError("Avatar image must be under 2MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      setAvatar(base64);
      try {
        await api.put("/users/profile", { avatar: base64 });
        await fetchUser();
        setProfileSaved(true);
        setTimeout(() => setProfileSaved(false), 2500);
      } catch (err: any) {
        setProfileError(err.message || "Failed to update profile picture");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    try {
      await api.put("/users/profile", { fullName, phone });
      await fetchUser();
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch (err: any) {
      setProfileError(err.message ?? "Failed to save profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");

    if (!currentPassword || !newPassword) {
      setPasswordError("Please fill in both current and new passwords");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    setSavingPassword(true);
    try {
      await api.put("/users/change-password", { currentPassword, newPassword });
      setPasswordSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => setPasswordSaved(false), 3000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.delete("/users/account");
      logout();
      window.location.href = "/";
    } catch (err: any) {
      alert(err.message || "Failed to delete account");
      setDeleting(false);
    }
  };

  const initials = user?.fullName
    ? user.fullName
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? "U";

  return (
    <div className="space-y-6">
      {/* Hidden file input for Avatar upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />

      {/* Avatar Card */}
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm">
        <div className="relative shrink-0">
          {avatar ? (
            <img
              src={avatar}
              alt={user?.fullName ?? "Avatar"}
              className="h-20 w-20 rounded-full object-cover border-2 border-[var(--color-accent)] shadow-sm"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-accent)] to-[var(--color-primary)] text-white text-2xl font-bold shadow-[var(--shadow-md)]">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload photo"
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--color-bg-surface)] bg-[var(--color-primary)] text-white shadow hover:scale-105 transition-transform"
          >
            <Camera size={14} />
          </button>
        </div>

        <div className="text-center sm:text-left min-w-0">
          <p className="text-xl font-bold text-[var(--color-text-primary)] truncate">
            {user?.fullName ?? "My Account"}
          </p>
          <p className="mt-0.5 text-sm text-[var(--color-text-secondary)] truncate">{user?.email}</p>
          <div className="mt-2 flex items-center justify-center sm:justify-start gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-accent-light)] px-3 py-1 text-xs font-semibold text-[var(--color-accent)]">
              <Shield size={11} />
              {user?.role === "SUPER_ADMIN" ? "Super Admin" : "Verified Customer"}
            </span>
          </div>
        </div>
      </div>

      {/* Personal Information Form */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <h2 className="text-base font-bold text-[var(--color-text-primary)]">Personal Information</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <User size={12} /> Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Enter your full name"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <Phone size={12} /> Phone Number
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
            <Mail size={12} /> Email Address
          </label>
          <input
            type="email"
            value={user?.email ?? ""}
            disabled
            className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-muted)] px-3.5 py-2.5 text-sm text-[var(--color-text-tertiary)] cursor-not-allowed"
          />
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            Email address is tied to your account identity and cannot be changed.
          </p>
        </div>

        {profileError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
            {profileError}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {profileSaved ? (
            <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
              <Check size={14} /> Profile details saved successfully!
            </span>
          ) : (
            <span />
          )}

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 shadow-sm"
          >
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {/* Change Password Card */}
      <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound size={16} className="text-[var(--color-accent)]" />
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">Change Password</h2>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>

            <div>
              <label className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] block">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] px-3.5 py-2.5 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </div>
          </div>

          {passwordError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
              {passwordError}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            {passwordSaved ? (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check size={14} /> Password changed successfully!
              </span>
            ) : (
              <span />
            )}

            <button
              type="submit"
              disabled={savingPassword}
              className="rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all disabled:opacity-50 shadow-sm"
            >
              {savingPassword ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>

      {/* Danger Zone: Delete Account */}
      <div className="rounded-2xl border border-red-200 dark:border-red-950 bg-red-50/50 dark:bg-red-950/20 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-1.5">
              <AlertTriangle size={15} /> Delete Account
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 max-w-md">
              Permanently delete your account and anonymize your personal data. This action cannot be
              undone.
            </p>
          </div>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-red-300 dark:border-red-800 bg-white dark:bg-black/50 px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-500 hover:text-white transition-all self-start sm:self-auto"
          >
            <Trash2 size={13} /> Delete My Account
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 shadow-2xl space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto">
              <AlertTriangle size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold text-[var(--color-text-primary)]">
                Delete Account?
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Are you sure you want to delete your AuraZone account? Your personal information, saved
                addresses, and active sessions will be permanently erased.
              </p>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 rounded-xl border border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-muted)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-600 py-2.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Yes, Delete Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}