import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import CheckoutFlow from "@/components/marketplace/checkout-flow";
import { getAuthenticatedUser } from "@/lib/authorization";
import { getDeliverySettings } from "@/lib/data-access/delivery-settings";
import { getActivePaymentAccounts } from "@/lib/data-access/order-payment-proofs";

export const metadata: Metadata = {
  title: "Checkout | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  return (
    <Suspense fallback={<div className="checkout-loading">Loading checkout…</div>}>
      <CheckoutContent />
    </Suspense>
  );
}

async function CheckoutContent() {
  await connection();
  const user = await getAuthenticatedUser();
  const isCustomer = user?.role === "customer";
  const [accounts, deliverySettings] = await Promise.all([
    isCustomer ? getActivePaymentAccounts() : Promise.resolve([]),
    getDeliverySettings(),
  ]);
  return (
    <CheckoutFlow
      accounts={accounts}
      customerName={user?.name ?? ""}
      userRole={user?.role ?? null}
      deliverySettings={deliverySettings}
    />
  );
}
