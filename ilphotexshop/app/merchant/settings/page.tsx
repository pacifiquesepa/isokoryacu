import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import CustomerPasswordForm from "@/components/customer/customer-password-form";
import MerchantPreferencesForm from "@/components/merchant/preferences-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Settings | Merchant portal" };

export default function MerchantSettingsPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading settings…</div>}>
      <MerchantSettingsContent />
    </Suspense>
  );
}

async function MerchantSettingsContent() {
  const merchant = await requireMerchantPageUser();
  const account = await prisma.user.findUnique({
    where: { id: merchant.id },
    select: { twoFactorEnabled: true },
  });
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading"><div><div className="merchant-breadcrumb">Workspace / Settings</div><h1>My Settings</h1><p>Personal password and sign-in security settings.</p></div></div>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading"><div><h2>Change password</h2><p>This sign-out after changing password applies to your account.</p></div></div>
        <CustomerPasswordForm endpoint="/api/seller/password" />
      </section>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading"><div><h2>Two-factor authentication</h2><p>{account?.twoFactorEnabled ? "Enabled" : "Not enabled"}</p></div></div>
        <Link className="merchant-primary-action" href="/merchant/settings/security">Manage security</Link>
      </section>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading"><div><h2>Notifications, appearance and language</h2><p>Personal preferences for this merchant workspace.</p></div></div>
        <MerchantPreferencesForm />
      </section>
    </div>
  );
}
