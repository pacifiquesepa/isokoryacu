import {
  ArrowUpRight,
  ChartNoAxesCombined,
  Megaphone,
  MessageCircle,
  ReceiptText,
  Settings,
  LifeBuoy,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MerchantNavSection = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: { label: string; href: string }[];
};

export const merchantNavSections: MerchantNavSection[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    items: [{ label: "Dashboard", href: "/merchant/dashboard" }],
  },
  {
    id: "shop",
    label: "My Shop",
    icon: Store,
    items: [
      { label: "Shop profile", href: "/merchant/shop" },
      { label: "Branding", href: "/merchant/shop/branding" },
      { label: "Location", href: "/merchant/shop/location" },
    ],
  },
  {
    id: "products",
    label: "My products",
    icon: Package,
    items: [
      { label: "All products", href: "/merchant/products" },
      { label: "Add product", href: "/merchant/products/new" },
      { label: "Published", href: "/merchant/products?status=published" },
      { label: "Unpublished", href: "/merchant/products?status=unpublished" },
      { label: "Draft", href: "/merchant/products?status=draft" },
      { label: "Pending approval", href: "/merchant/products?status=pending" },
      { label: "Scheduled", href: "/merchant/products?status=scheduled" },
      { label: "Rejected", href: "/merchant/products?status=rejected" },
      { label: "Hidden", href: "/merchant/products?status=hidden" },
      { label: "Featured", href: "/merchant/products?status=featured" },
      { label: "Archived", href: "/merchant/products?status=archived" },
      { label: "Performance", href: "/merchant/products/performance" },
    ],
  },
  {
    id: "orders",
    label: "My orders",
    icon: ShoppingBag,
    items: [
      { label: "All orders", href: "/merchant/orders" },
      { label: "New orders", href: "/merchant/orders?status=pending" },
      { label: "Pending confirmation", href: "/merchant/orders?status=pending" },
      { label: "Payment verified", href: "/merchant/orders?status=confirmed" },
      { label: "Processing", href: "/merchant/orders?status=processing" },
      { label: "Shipped", href: "/merchant/orders?status=shipped" },
      { label: "Completed", href: "/merchant/orders?status=fulfilled" },
      { label: "Cancelled", href: "/merchant/orders?status=cancelled" },
      { label: "Return requests", href: "/merchant/orders/returns" },
      { label: "Disputes", href: "/merchant/orders/disputes" },
    ],
  },
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    items: [{ label: "Stock and movements", href: "/merchant/inventory" }],
  },
  {
    id: "finance",
    label: "Finance",
    icon: Wallet,
    items: [
      { label: "Earnings overview", href: "/merchant/finance" },
      { label: "Payout requests", href: "/merchant/finance#payouts" },
    ],
  },
  {
    id: "analytics",
    label: "Product Analytics",
    icon: ChartNoAxesCombined,
    items: [
      { label: "Sales analytics", href: "/merchant/analytics" },
      { label: "Best sellers", href: "/merchant/analytics#best-sellers" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing & Promotions",
    icon: Megaphone,
    items: [
      { label: "My promotions", href: "/merchant/promotions" },
      { label: "Featured requests", href: "/merchant/promotions#featured" },
    ],
  },
  {
    id: "messages",
    label: "Messages & Support",
    icon: MessageCircle,
    items: [
      { label: "Conversations", href: "/merchant/messages" },
      { label: "Support tickets", href: "/merchant/support" },
      { label: "Notifications", href: "/merchant/notifications" },
    ],
  },
  {
    id: "audit",
    label: "Audit Logs",
    icon: ReceiptText,
    items: [{ label: "Activity history", href: "/merchant/audit" }],
  },
  {
    id: "settings",
    label: "My Settings",
    icon: Settings,
    items: [
      { label: "Account settings", href: "/merchant/settings" },
      { label: "Security", href: "/merchant/settings/security" },
    ],
  },
  {
    id: "help",
    label: "Help & Support",
    icon: LifeBuoy,
    items: [{ label: "Help center", href: "/merchant/help" }],
  },
  {
    id: "staff",
    label: "Staff Management",
    icon: Users,
    items: [
      { label: "All staff", href: "/merchant/staff" },
      { label: "Active staff", href: "/merchant/staff?status=active" },
      { label: "Suspended staff", href: "/merchant/staff?status=inactive" },
      { label: "Invitations", href: "/merchant/staff/invitations" },
    ],
  },
  {
    id: "account",
    label: "My account",
    icon: UserRound,
    items: [{ label: "Profile", href: "/merchant/profile" }],
  },
];

export const merchantSearchItems = merchantNavSections.flatMap((section) =>
  section.items.map((item) => ({
    ...item,
    sectionLabel: section.label,
  })),
);

export const merchantStorefrontLink = {
  label: "View storefront",
  icon: ArrowUpRight,
};
