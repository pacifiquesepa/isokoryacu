import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, ShieldCheck } from "lucide-react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import CustomerPasswordForm from "@/components/customer/customer-password-form";
import { requireCustomerPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Account settings | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function CustomerSettingsPage() {
  return (
    <CustomerPortalLayout active="settings">
      <Suspense
        fallback={<div className="customer-orders-loading">Loading settings…</div>}
      >
        <CustomerSettingsContent />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function CustomerSettingsContent() {
  await connection();
  const customer = await requireCustomerPageUser("/account/settings");
  const account = await prisma.user.findUnique({
    where: { id: customer.id },
    select: { twoFactorEnabled: true },
  });

  return (
    <div className="customer-orders-page customer-account-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">Account / Settings</span>
          <h1>Account settings</h1>
          <p>Password and sign-in security.</p>
        </div>
      </div>

      <div className="customer-account-settings-grid">
        <section className="customer-account-card">
          <div className="customer-account-card-heading">
            <div>
              <h2>Change password</h2>
              <p>Use at least 12 characters. You will sign in again afterward.</p>
            </div>
          </div>
          <CustomerPasswordForm />
        </section>

        <section className="customer-account-card customer-account-security-link">
          <span className="customer-account-security-icon">
            <ShieldCheck aria-hidden="true" size={19} />
          </span>
          <div>
            <h2>Sign-in security</h2>
            <p>
              Two-factor authentication{" "}
              <strong>{account?.twoFactorEnabled ? "On" : "Off"}</strong>
            </p>
          </div>
          <Link
            aria-label="Manage sign-in security and devices"
            href="/account/security"
          >
            Manage <ArrowRight aria-hidden="true" size={16} />
          </Link>
        </section>
      </div>
    </div>
  );
}
