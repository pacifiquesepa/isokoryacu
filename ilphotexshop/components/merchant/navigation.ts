import {
  ArrowUpRight,
  Boxes,
  LayoutDashboard,
  Package,
  ShoppingBag,
  Store,
  UserRound,
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
    items: [{ label: "Shop profile", href: "/merchant/shop" }],
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
    ],
  },
  {
    id: "orders",
    label: "My orders",
    icon: ShoppingBag,
    items: [{ label: "Order items", href: "/merchant/orders" }],
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
