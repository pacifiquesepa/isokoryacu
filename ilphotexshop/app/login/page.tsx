import { Suspense } from "react";
import type { Metadata } from "next";
import LoginForm from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-[var(--text-secondary)]">
          Loading…
        </div>
      }
    >
      <LoginPageContent searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginPageContent({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  const params = await searchParams;
  return <LoginForm passwordChanged={params.passwordChanged === "1"} />;
}
