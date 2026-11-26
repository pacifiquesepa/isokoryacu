import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import MerchantAppShell from "@/components/merchant/app-shell";
import {
  getAuthenticatedUser,
  getMerchantWorkspacePermissions,
  requireMerchantPageUser,
} from "@/lib/authorization";
import "./merchant.css";

export const metadata: Metadata = {
  title: "Merchant portal | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function MerchantLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading your shop…</div>}>
      <AuthenticatedMerchantLayout>{children}</AuthenticatedMerchantLayout>
    </Suspense>
  );
}

async function AuthenticatedMerchantLayout({
  children,
}: {
  children: ReactNode;
}) {
  await connection();
  const seller = await requireMerchantPageUser();
  const authenticatedUser = await getAuthenticatedUser();
  const permissions = authenticatedUser
    ? await getMerchantWorkspacePermissions(authenticatedUser.id)
    : null;
  return (
    <MerchantAppShell
      permissions={permissions}
      userEmail={seller.email}
      userName={seller.name}
    >
      {children}
    </MerchantAppShell>
  );
}
