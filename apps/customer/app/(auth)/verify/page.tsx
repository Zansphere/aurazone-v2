"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  XCircle,
  Mail,
  MailCheck,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Check,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth.store";

function VerifyForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const isSent = searchParams.get("sent") === "true";
  const emailParam = searchParams.get("email");

  const { user, fetchUser, resendVerification } = useAuthStore();
  const displayEmail = emailParam || user?.email || "your email address";

  // State for verifying a token
  const [verifying, setVerifying] = useState(!!token);
  const [verifiedSuccess, setVerifiedSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // State for resending verification email
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState("");
  const [countdown, setCountdown] = useState(0);

  // If token is present, execute verification
  useEffect(() => {
    if (!token) {
      setVerifying(false);
      return;
    }

    let isMounted = true;

    async function executeVerification() {
      try {
        await api.post("/auth/verify-email", { token });
        if (isMounted) {
          setVerifiedSuccess(true);
          setVerifying(false);
          await fetchUser();
        }
      } catch (err: any) {
        if (isMounted) {
          setVerifiedSuccess(false);
          setVerifying(false);
          setVerificationError(
            err.message || "Invalid or expired verification link. Please request a new one."
          );
        }
      }
    }

    executeVerification();

    return () => {
      isMounted = false;
    };
  }, [token, fetchUser]);

  // Resend cooldown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleResend = async () => {
    if (countdown > 0 || resending) return;
    setResending(true);
    setResendError("");
    setResendSuccess(false);

    try {
      await resendVerification();
      setResendSuccess(true);
      setCountdown(60);
      setTimeout(() => setResendSuccess(false), 5000);
    } catch (err: any) {
      setResendError(
        err.message || "Unable to resend verification email right now. Please try again later."
      );
    } finally {
      setResending(false);
    }
  };

  // Case 1: Verifying with token in progress
  if (token && verifying) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-accent-light)] text-[var(--color-accent)] animate-pulse">
            <Mail size={32} />
          </div>
          <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
            Verifying Your Email...
          </h1>
          <p className="text-xs text-[var(--color-text-secondary)]">
            Please wait a moment while we activate your AuraZone account.
          </p>
        </div>
      </div>
    );
  }

  // Case 2: Token verification was attempted and succeeded
  if (token && verifiedSuccess) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <ShieldCheck size={36} />
          </div>
          <h1 className="text-2xl font-bold font-[var(--font-heading)] text-[var(--color-text-primary)]">
            Account Verified!
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            Thank you for verifying your email address. Your AuraZone account is now fully active
            with unrestricted access to checkout, orders, and saved preferences.
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <Link
              href="/"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors shadow-sm"
            >
              Start Shopping <ArrowRight size={15} />
            </Link>
            <Link
              href="/profile"
              className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              View My Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Token verification failed
  if (token && !verifiedSuccess && verificationError) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center shadow-xl space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
            <XCircle size={36} />
          </div>
          <h1 className="text-2xl font-bold font-[var(--font-heading)] text-[var(--color-text-primary)]">
            Verification Failed
          </h1>
          <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] leading-relaxed">
            {verificationError}
          </p>
          <div className="pt-2 flex flex-col gap-2.5">
            <button
              onClick={handleResend}
              disabled={countdown > 0 || resending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors disabled:opacity-50 shadow-sm"
            >
              <RotateCcw size={15} className={resending ? "animate-spin" : ""} />
              {countdown > 0
                ? `Resend available in ${countdown}s`
                : resending
                ? "Sending Link..."
                : "Request New Verification Link"}
            </button>
            <Link
              href="/login"
              className="inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] px-6 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Registration Success / Verification Pending Instruction Page
  return (
    <div className="flex min-h-[70vh] items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-6 sm:p-10 text-center shadow-xl space-y-6">
        {/* Animated Envelope Icon */}
        <div className="relative mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--color-accent-light)] to-[var(--color-primary)]/10 text-[var(--color-accent)] shadow-[var(--shadow-md)] border border-[var(--color-accent)]/20">
          <MailCheck size={40} />
          <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-white shadow">
            <Check size={14} strokeWidth={3} />
          </div>
        </div>

        {/* Headline & Primary Message */}
        <div className="space-y-2">
          <span className="inline-block rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 px-3 py-1 text-xs font-bold">
            Email Verification Required
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold font-[var(--font-heading)] text-[var(--color-text-primary)] tracking-tight">
            Verify Your Email Address
          </h1>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] max-w-md mx-auto pt-1">
            Please check your email inbox and click the verification link to activate your account.
          </p>
        </div>

        {/* Email Callout Box */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-base)] p-4 text-xs text-[var(--color-text-secondary)] space-y-2 text-left">
          <div className="flex items-center gap-2 text-[var(--color-text-primary)] font-medium">
            <Mail size={15} className="text-[var(--color-accent)] shrink-0" />
            <span>Sent to: <strong className="font-mono text-xs">{displayEmail}</strong></span>
          </div>
          <p className="leading-relaxed">
            We have sent an activation email containing a secure link. Please verify your email before
            accessing features that require a verified account, such as placing orders and modifying
            profile details.
          </p>
        </div>

        {/* Feedback Alerts */}
        {resendSuccess && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-800 dark:text-emerald-300 font-semibold flex items-center justify-center gap-2">
            <Check size={15} /> A fresh verification link has been sent to your inbox!
          </div>
        )}
        {resendError && (
          <div className="rounded-xl border border-red-200 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 font-medium flex items-center justify-center gap-2">
            <AlertTriangle size={15} /> {resendError}
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3 pt-1">
          <div className="flex flex-col sm:flex-row gap-2.5">
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--color-primary)] py-3 px-4 text-xs font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-all shadow-sm"
            >
              Open Gmail <ExternalLink size={13} />
            </a>
            <a
              href="https://outlook.live.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] py-3 px-4 text-xs font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-bg-muted)] transition-colors"
            >
              Open Outlook <ExternalLink size={13} />
            </a>
          </div>

          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors disabled:opacity-50"
          >
            <RotateCcw size={13} className={resending ? "animate-spin" : ""} />
            {countdown > 0
              ? `Resend link available in ${countdown}s`
              : resending
              ? "Sending link..."
              : "Didn't receive the email? Resend Verification Link"}
          </button>
        </div>

        {/* Bottom Help / Links */}
        <div className="pt-2 border-t border-[var(--color-border)] flex flex-col sm:flex-row items-center justify-between text-[11px] text-[var(--color-text-tertiary)] gap-2">
          <span>Tip: Check your spam or promotions folder</span>
          <Link href="/login" className="font-semibold text-[var(--color-accent)] hover:underline">
            Already verified? Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[70vh] items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-8 text-center shadow-xl">
            <div className="flex flex-col items-center">
              <div className="mb-6 h-16 w-16 animate-pulse rounded-full bg-[var(--color-bg-muted)]" />
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
                Loading Verification...
              </h1>
            </div>
          </div>
        </div>
      }
    >
      <VerifyForm />
    </Suspense>
  );
}
