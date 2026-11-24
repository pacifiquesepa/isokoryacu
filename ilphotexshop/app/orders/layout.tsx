import type { ReactNode } from "react";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import "../customer-portal.css";

export default function CustomerOrdersLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CustomerPortalLayout active="orders">{children}</CustomerPortalLayout>
  );
}
