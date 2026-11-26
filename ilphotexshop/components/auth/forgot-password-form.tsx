"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

export default function ForgotPasswordForm() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "otp" | "reset">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      await response.json().catch(() => null);
      setStep("otp");
      setMessage("If an account exists for this email, a 6-digit code was sent.");
    } catch {
      setMessage("The reset code could not be requested.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp }),
      });
      const result = await response.json() as { verified?: boolean; error?: string };
      if (!response.ok || !result.verified) {
        throw new Error(result.error ?? "The verification code is invalid or expired.");
      }
      setStep("reset");
      setMessage("Verification complete. Enter a new password.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Verification failed.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/password-reset/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, password, confirmPassword }),
      });
      const result = await response.json() as { reset?: boolean; error?: string };
      if (!response.ok || !result.reset) {
        throw new Error(result.error ?? "Password could not be reset.");
      }
      router.push("/login?passwordChanged=1");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Password could not be reset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-illustration" aria-label="ILPhotoX Shop">
        <div className="auth-illustration-brand">
          <Image alt="" height={42} src="/ilphotox-shop-logo.png" unoptimized width={42} />
          <span>ILPhotoX Shop</span>
        </div>
        <div className="auth-illustration-copy">
          <strong>Reset your password</strong>
          <span>Verify your email securely and restore account access.</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-shell">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/login">Back to sign in</Link>
        <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">Forgot password</h1>
        {step === "email" && (
          <form className="mt-6 space-y-4" onSubmit={sendOtp}>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Email</span>
              <input
                autoComplete="email"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                maxLength={254}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <button className="button button-primary w-full" disabled={busy} type="submit">
              {busy ? "Sending…" : "Send verification code"}
            </button>
          </form>
        )}
        {step === "otp" && (
          <form className="mt-6 space-y-4" onSubmit={verifyOtp}>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>6-digit email code</span>
              <input
                autoComplete="one-time-code"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setOtp(event.target.value)}
                pattern="[0-9]{6}"
                required
                value={otp}
              />
            </label>
            <button className="button button-primary w-full" disabled={busy || otp.length !== 6} type="submit">
              {busy ? "Verifying…" : "Verify code"}
            </button>
          </form>
        )}
        {step === "reset" && (
          <form className="mt-6 space-y-4" onSubmit={resetPassword}>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>New password</span>
              <span className="relative block">
                <input
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-12"
                  maxLength={72}
                  minLength={12}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <label className="block space-y-1.5 text-sm font-medium">
              <span>Re-enter password</span>
              <span className="relative block">
                <input
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-12"
                  maxLength={72}
                  minLength={12}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                />
                <button
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  type="button"
                >
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            <button className="button button-primary w-full" disabled={busy} type="submit">
              {busy ? "Resetting…" : "Reset password"}
            </button>
          </form>
        )}
        <p aria-live="polite" className="mt-4 min-h-5 text-sm text-[var(--text-secondary)]">{message}</p>
        </div>
      </section>
    </main>
  );
}
