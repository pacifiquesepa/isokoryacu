"use client";

import Link from "next/link";
import { getSession } from "next-auth/react";
import { useState, type FormEvent } from "react";

export default function LoginForm({
  passwordChanged,
}: {
  passwordChanged: boolean;
}) {
  const [message, setMessage] = useState(
    passwordChanged ? "Password updated. Sign in with your new password." : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-7 shadow-lg sm:p-9">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/">
          ILPhotoX Shop
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sign in to your account.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Email</span>
            <input
              autoComplete="email"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              maxLength={254}
              name="email"
              required
              type="email"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Password</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              maxLength={72}
              name="password"
              required
              type="password"
            />
          </label>
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

          <button
            className="button button-primary w-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
          <p aria-live="polite" className="min-h-5 text-sm text-[var(--text-secondary)]">
            {message}
          </p>
        </form>

        <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
          New to ILPhotoX Shop?{" "}
          <Link className="font-semibold text-[var(--primary)]" href="/register">
            Create an account
          </Link>
        </p>
      </section>
    </main>
  );
}
