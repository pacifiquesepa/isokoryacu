"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";

type RegistrationResponse = {
  error?: string;
  message?: string;
};

export default function RegisterForm() {
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      setIsSubmitting(false);
      return;
    }
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          phone: formData.get("phone"),
          password,
          confirmPassword,
        }),
      });
      const result = (await response.json()) as RegistrationResponse;

      if (!response.ok) {
        setMessage(result.error ?? "Registration could not be completed.");
        return;
      }

      setMessage(result.message ?? "You can now sign in.");
      form.reset();
    } catch {
      setMessage("Registration is temporarily unavailable. Please try again.");
    } finally {
      setIsSubmitting(false);
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
          <strong>Create your account</strong>
          <span>Join the marketplace and start buying or selling with ILPhotoX Shop.</span>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-form-shell">
        <Link className="text-sm font-semibold text-[var(--primary)]" href="/">
          ILPhotoX Shop
        </Link>
        <h1 className="mt-6 text-2xl font-bold text-[var(--text-primary)]">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Register as a customer to get started.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Name</span>
            <input
              autoComplete="name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              maxLength={100}
              minLength={2}
              name="name"
              required
            />
          </label>
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
            <span>Phone number</span>
            <input
              autoComplete="tel"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-[var(--text-primary)]"
              maxLength={32}
              minLength={7}
              name="phone"
              placeholder="+250..."
              required
              type="tel"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Password</span>
            <span className="relative block">
              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-12 text-[var(--text-primary)]"
                maxLength={72}
                minLength={12}
                name="password"
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
            <span className="block text-xs font-normal text-[var(--text-secondary)]">
              Use at least 12 characters.
            </span>
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            <span>Re-enter password</span>
            <span className="relative block">
              <input
                autoComplete="new-password"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 pr-12 text-[var(--text-primary)]"
                maxLength={72}
                minLength={12}
                name="confirmPassword"
                required
                type={showConfirmPassword ? "text" : "password"}
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

          <button
            className="button button-primary w-full"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Creating account…" : "Create account"}
          </button>
          <p aria-live="polite" className="min-h-5 text-sm text-[var(--text-secondary)]">
            {message}
          </p>
        </form>

        <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">
          Already registered?{" "}
          <Link className="font-semibold text-[var(--primary)]" href="/login">
            Sign in
          </Link>
        </p>
        </div>
      </section>
    </main>
  );
}
