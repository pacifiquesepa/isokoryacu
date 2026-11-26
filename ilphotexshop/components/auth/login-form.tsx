"use client";

import Link from "next/link";
import { getSession } from "next-auth/react";
import { useState, type FormEvent } from "react";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";

export default function LoginForm({
  passwordChanged,
}: {
  passwordChanged: boolean;
}) {
  const [message, setMessage] = useState(
    passwordChanged ? "Password updated. Sign in with your new password." : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [challengeStarted, setChallengeStarted] = useState(false);
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function startChallenge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    setMessage("");
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/auth/2fa-methods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as {
        authenticator?: boolean;
        email?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Email or password is incorrect.");
      setAuthenticatorEnabled(Boolean(result.authenticator));
      setEmailEnabled(Boolean(result.email));
      if (!result.authenticator && !result.email) {
        setChallengeStarted(false);
        setMessage("");
        await completeSignIn(form);
        return;
      }
      setChallengeStarted(true);
      if (result.email) {
        const otpResponse = await fetch("/api/auth/email-otp/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        if (!otpResponse.ok) {
          setMessage("Email verification code could not be sent. Use Send code to try again.");
        } else {
          setMessage("Enter the verification code from your authenticator app and/or email.");
        }
      } else if (result.authenticator) {
        setMessage("Enter the 6-digit code from your authenticator app.");
      } else {
        setMessage("");
      }
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Email or password is incorrect.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function sendEmailOtp(event: FormEvent<HTMLButtonElement>) {
    event.preventDefault();
    const form = event.currentTarget.form;
    if (!form) return;
    setMessage("");
    setIsSubmitting(true);
    try {
      const formData = new FormData(form);
      const response = await fetch("/api/auth/email-otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(formData.get("email") ?? ""),
          password: String(formData.get("password") ?? ""),
        }),
      });
      const result = await response.json() as { sent?: boolean; error?: string };
      if (!response.ok || !result.sent) {
        throw new Error(result.error ?? "Email verification code could not be sent.");
      }
      setMessage("A 6-digit verification code was sent to your email.");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Email verification code could not be sent.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function completeSignIn(form: HTMLFormElement) {
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(form);
    const requestedCallback = new URLSearchParams(window.location.search).get(
      "callbackUrl",
    );
    const callbackUrl =
      requestedCallback?.startsWith("/") &&
      !requestedCallback.startsWith("//") &&
      !requestedCallback.includes("\\")
        ? requestedCallback
        : "/";
    try {
      const csrfResponse = await fetch("/api/auth/csrf", {
        credentials: "include",
        cache: "no-store",
      });
      if (!csrfResponse.ok) {
        throw new Error("Sign-in security token could not be loaded.");
      }
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        throw new Error("Sign-in security token could not be loaded.");
      }

      const loginBody = new URLSearchParams({
        csrfToken: csrf.csrfToken,
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        callbackUrl,
        json: "true",
      });
      const totpCode = String(formData.get("totpCode") ?? "");
      if (totpCode) loginBody.set("totpCode", totpCode);
      const emailOtpCode = String(formData.get("emailOtpCode") ?? "");
      if (emailOtpCode) loginBody.set("emailOtpCode", emailOtpCode);

      const loginResponse = await fetch(
        "/api/auth/callback/credentials",
        {
          method: "POST",
          credentials: "include",
          cache: "no-store",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: loginBody,
          redirect: "manual",
        },
      );
      if (!loginResponse.ok) {
        setMessage("Email or password is incorrect, or sign-in is unavailable.");
        return;
      }

      const session = await getSession();
      const destination =
        callbackUrl === "/" && session?.user?.role === "super_admin"
          ? "/super-admin/dashboard"
          : callbackUrl;
      window.location.assign(destination);
    } catch {
      setMessage("Sign-in is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challengeStarted) {
      await startChallenge(event);
      return;
    }
    await completeSignIn(event.currentTarget);
  }

  return (
    <main className="auth-page">
      <section className="auth-illustration" aria-label="ILPhotoX Shop">
        <div className="auth-illustration-brand">
          <Image alt="" height={42} src="/ilphotox-shop-logo.png" unoptimized width={42} />
          <span>ILPhotoX Shop</span>
        </div>
        <div className="auth-illustration-copy">
          <strong>Login or Sign Up</strong>
          <span>Use one account to shop, sell and manage your marketplace activity.</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-shell">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/">
          ILPhotoX Shop
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sign in to your account.
        </p>

        <form
          className="login-form mt-6 space-y-4"
          method="post"
          onSubmit={handleSubmit}
        >
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              maxLength={254}
              name="email"
              readOnly={challengeStarted}
              required
              type="email"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Password</span>
            <span className="relative block">
              <input
                autoComplete="current-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-12 text-[var(--text-primary)]"
                maxLength={72}
                name="password"
                readOnly={challengeStarted}
                required
                type={showPassword ? "text" : "password"}
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
          {challengeStarted && authenticatorEnabled && (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Authenticator code (if enabled)</span>
            <input
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="totpCode"
              pattern="[0-9]{6}"
              type="text"
            />
          </label>
          )}
          {challengeStarted && emailEnabled && (
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Email verification code (if enabled)</span>
            <input
              autoComplete="one-time-code"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              inputMode="numeric"
              maxLength={6}
              minLength={6}
              name="emailOtpCode"
              pattern="[0-9]{6}"
              type="text"
            />
          </label>
          )}
          {challengeStarted && (
            <button
              className="button w-full"
              disabled={isSubmitting}
              onClick={() => {
                setChallengeStarted(false);
                setAuthenticatorEnabled(false);
                setEmailEnabled(false);
                setMessage("");
                const form = document.querySelector<HTMLFormElement>(".login-form");
                form?.reset();
              }}
              type="button"
            >
              Use another account
            </button>
          )}
          {challengeStarted && emailEnabled && (
          <button
            className="button button-secondary w-full"
            disabled={isSubmitting}
            onClick={sendEmailOtp}
            type="button"
          >
            Send email verification code
          </button>
          )}

          <button
            className="button button-primary w-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting
              ? "Please wait…"
              : challengeStarted
                ? "Verify and sign in"
                : "Continue"}
          </button>
          <p aria-live="polite" className="min-h-5 text-sm text-[var(--text-secondary)]">
            {message}
          </p>
        </form>

        <p className="mt-3 text-center text-sm">
          <Link className="font-semibold text-[var(--primary)]" href="/forgot-password">
            Forgot password?
          </Link>
        </p>
        <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
          New to ILPhotoX Shop?{" "}
          <Link className="font-semibold text-[var(--primary)]" href="/register">
            Create an account
          </Link>
        </p>
        </div>
      </section>
    </main>
  );
}
