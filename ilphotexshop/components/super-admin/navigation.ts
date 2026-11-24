import {
  Activity,
  BarChart3,
  CreditCard,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  MessageSquareWarning,
  Package,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  UserCircle,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type NavigationItem = {
  label: string;
  href?: string;
};

type NavigationSection = {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  items: NavigationItem[];
};

function slugify(label: string) {
  return label
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function createSection(
  id: string,
  label: string,
  basePath: string,
  icon: LucideIcon,
  entries: (string | NavigationItem)[],
): NavigationSection {
  return {
    id,
    label,
    href: basePath,
    icon,
    items: entries.map((entry, index) => {
      if (typeof entry !== "string") return entry;
      return {
        label: entry,
        href: index === 0 ? basePath : `${basePath}/${slugify(entry)}`,
      };
    }),
  };
}

export const superAdminSections: NavigationSection[] = [
  createSection("dashboard", "Dashboard", "/super-admin/dashboard", LayoutDashboard, [
    "Overview",
  ]),
  createSection("users", "User Management", "/super-admin/users", Users, [
    "All Users",
    "Super Administrators",
    "Administrators",
    "Merchants",
    "Customers",
    "Roles & Permissions",
    {
      label: "Staff Members",
      href: "/super-admin/users/staff-members",
    },
    {
      label: "Pending Invitations",
      href: "/super-admin/users/pending-invitations",
    },
    {
      label: "Suspended Users",
      href: "/super-admin/users/suspended-users",
    },
    {
      label: "Inactive Users",
      href: "/super-admin/users/inactive-users",
    },
    {
      label: "Deleted / Archived Users",
      href: "/super-admin/users/archived-users",
    },
  ]),
  createSection("merchants", "Merchant Management", "/super-admin/merchants", Store, [
    "All Merchants",
    "Pending Applications",
    "Approved Merchants",
    "Rejected Applications",
    "Merchant Verification (KYC)",
    "Suspended Merchants",
    {
      label: "Business Information",
      href: "/super-admin/merchants/business-information",
    },
    {
      label: "Merchant Locations",
      href: "/super-admin/merchants/merchant-locations",
    },
    { label: "Merchant Staff", href: "/super-admin/merchants/merchant-staff" },
    { label: "Merchant Financial Profiles", href: "/super-admin/merchants/merchant-financial-profiles" },
    { label: "Payout Account Change Requests", href: "/super-admin/merchants/financial-change-requests" },
    {
      label: "Merchant Performance",
      href: "/super-admin/merchants/merchant-performance",
    },
  ]),
  createSection("products", "Product Management", "/super-admin/products", Package, [
    "All Products",
    { label: "Pending Approval", href: "/super-admin/products/pending-approval" },
    "Published Products",
    { label: "Scheduled Products", href: "/super-admin/products/scheduled-products" },
    "Draft Products",
    { label: "Rejected Products", href: "/super-admin/products/rejected-products" },
    { label: "Hidden Products", href: "/super-admin/products/hidden-products" },
    "Out of Stock",
    { label: "Categories", href: "/super-admin/products/categories" },
    { label: "Subcategories", href: "/super-admin/products/subcategories" },
    {
      label: "Featured Products",
      href: "/super-admin/products/featured-products",
    },
    { label: "Reported Products", href: "/super-admin/products/reported-products" },
    {
      label: "Product Performance",
      href: "/super-admin/products/product-performance",
    },
  ]),
  createSection("orders", "Order Management", "/super-admin/orders", ShoppingBag, [
    "All Orders",
    "New Orders",
    {
      label: "Pending Payments",
      href: "/super-admin/orders/pending-payments",
    },
    "Confirmed Orders",
    { label: "Processing Orders", href: "/super-admin/orders/processing-orders" },
    { label: "Shipped Orders", href: "/super-admin/orders/shipped-orders" },
    { label: "Delivered Orders", href: "/super-admin/orders/delivered-orders" },
    "Completed Orders",
    "Cancelled Orders",
    {
      label: "Returns & Refund Requests",
      href: "/super-admin/orders/returns-refund-requests",
    },
    { label: "Disputes", href: "/super-admin/orders/disputes" },
  ]),
  createSection("analytics", "Analytics & Reports", "/super-admin/analytics", BarChart3, [
    "Sales Analytics",
    "Revenue Analytics",
    "Merchant Analytics",
    "Customer Analytics",
    "Product Analytics",
    "Best Selling Products",
    "Category Performance",
    { label: "Most Viewed Products" },
    { label: "Geographic Analytics" },
    { label: "Website Traffic" },
    { label: "Generated Reports" },
  ]),
  createSection("payments", "Payment Management", "/super-admin/payments", CreditCard, [
    {
      label: "Payment Overview",
      href: "/super-admin/payments",
    },
    {
      label: "Merchant Payout Requests",
      href: "/super-admin/payments/merchant-payouts",
    },
    { label: "All Transactions" },
    {
      label: "Pending Verification",
      href: "/super-admin/payments/payment-proofs?status=pending",
    },
    {
      label: "Payment Proofs",
      href: "/super-admin/payments/payment-proofs",
    },
    {
      label: "Approved Payments",
      href: "/super-admin/payments/payment-proofs?status=approved",
    },
    {
      label: "Rejected Payments",
      href: "/super-admin/payments/payment-proofs?status=rejected",
    },
    {
      label: "Bank Accounts",
      href: "/super-admin/payments/bank-accounts?type=bank",
    },
    {
      label: "Mobile Money Accounts",
      href: "/super-admin/payments/bank-accounts?type=mobile_money",
    },
    {
      label: "Payment Methods",
      href: "/super-admin/payments/payment-methods",
    },
    { label: "Tax Configuration" },
    { label: "Payment Reversals" },
    {
      label: "Payment Reports",
      href: "/super-admin/payments/payment-reports",
    },
  ]),
  createSection("finance", "Finance & Settlements", "/super-admin/finance", Wallet, [
    {
      label: "Financial Overview",
      href: "/super-admin/finance",
    },
    {
      label: "Gross Sales",
      href: "/super-admin/finance/gross-sales",
    },
    { label: "Platform Revenue" },
    { label: "Platform Commissions" },
    { label: "Merchant Earnings" },
    { label: "Pending Settlements" },
    { label: "Merchant Payouts", href: "/super-admin/payments/merchant-payouts" },
    { label: "Completed Settlements" },
    { label: "Refunds" },
    { label: "Tax Reports" },
    { label: "Financial Statements" },
  ]),
  createSection(
    "communication",
    "Communication Center",
    "/super-admin/communication",
    MessageSquare,
    [
      { label: "All Conversations", href: "/super-admin/communication/conversations" },
      { label: "Customer Messages", href: "/super-admin/communication/customer-messages" },
      { label: "Merchant Messages", href: "/super-admin/communication/merchant-messages" },
      { label: "Staff Conversations", href: "/super-admin/communication/staff-conversations" },
      { label: "Support Tickets", href: "/super-admin/communication/support-tickets" },
      { label: "Live Chat", href: "/super-admin/communication/live-chat" },
      {
        label: "Announcements",
        href: "/super-admin/communication/announcements",
      },
      {
        label: "Notifications",
        href: "/super-admin/communication/notifications",
      },
      { label: "Email Campaigns", href: "/super-admin/communication/email-campaigns" },
      { label: "SMS Campaigns", href: "/super-admin/communication/sms-campaigns" },
      { label: "Help Center", href: "/super-admin/communication/help-center" },
    ],
  ),
  createSection(
    "marketing",
    "Marketing & Promotions",
    "/super-admin/marketing",
    Megaphone,
    [
      { label: "Coupons & Discount Codes", href: "/super-admin/marketing/coupons-discount-codes" },
      { label: "Discount Campaigns", href: "/super-admin/marketing/discount-campaigns" },
      { label: "Featured Products", href: "/super-admin/products/featured-products" },
      { label: "Featured Merchants", href: "/super-admin/marketing/featured-merchants" },
      { label: "Homepage Banners", href: "/super-admin/marketing/homepage-banners" },
      { label: "Campaign Scheduling", href: "/super-admin/marketing/campaign-scheduling" },
      { label: "Special Offers", href: "/super-admin/marketing/special-offers" },
      { label: "Campaign Performance", href: "/super-admin/marketing/campaign-performance" },
    ],
  ),
  createSection("delivery", "Delivery & Logistics", "/super-admin/delivery", Truck, [
    { label: "Delivery Overview" },
    { label: "All Shipments" },
    { label: "Pending Deliveries" },
    { label: "Delivery Tracking" },
    { label: "Delivery Partners" },
    { label: "Delivery Zones" },
    { label: "Delivery Fees" },
    { label: "Completed Deliveries" },
    { label: "Delivery Issues" },
  ]),
  createSection(
    "reviews-disputes",
    "Reviews & Disputes",
    "/super-admin/reviews-disputes",
    MessageSquareWarning,
    [
      { label: "All Reviews" },
      { label: "Pending Reviews" },
      { label: "Reported Reviews" },
      { label: "Customer Complaints" },
      { label: "Open Disputes" },
      { label: "Resolved Disputes" },
      { label: "Closed Disputes" },
    ],
  ),
  createSection(
    "security",
    "Security & Audit",
    "/super-admin/security",
    ShieldCheck,
    [
      { label: "Role Change Audit", href: "/super-admin/security" },
      {
        label: "Merchant Access Audit",
        href: "/super-admin/security/merchant-access",
      },
      {
        label: "KYC Decision Audit",
        href: "/super-admin/security/merchant-kyc",
      },
      { label: "All Audit Logs", href: "/super-admin/security/audit-logs" },
      { label: "Login History" },
      { label: "Active Sessions" },
      { label: "IP Address Monitoring" },
      { label: "Failed Login Attempts" },
      { label: "Security Alerts" },
      { label: "Two-Factor Authentication" },
      { label: "Password & Access Policies" },
      { label: "Device Management" },
      { label: "Security Reports" },
    ],
  ),
  createSection("settings", "System Settings", "/super-admin/settings", Settings, [
    { label: "General Settings" },
    { label: "Appearance & Theme Settings" },
    { label: "Branding & Logo" },
    { label: "Typography Settings" },
    { label: "Language & Localization" },
    { label: "Currency Settings" },
    { label: "Tax Configuration" },
    { label: "Payment Configuration" },
    { label: "Support Contact Settings" },
    { label: "Email Configuration" },
    { label: "SMS Configuration" },
    { label: "Security Configuration" },
    { label: "Merchant Registration Settings" },
    { label: "Marketplace Settings" },
    { label: "Delivery Configuration" },
    { label: "Storage & Cache Settings" },
    { label: "Maintenance Mode" },
  ]),
  createSection(
    "monitoring",
    "System Monitoring",
    "/super-admin/monitoring",
    Activity,
    [
      {
        label: "System Health",
        href: "/super-admin/monitoring/system-health",
      },
      {
        label: "Database Monitoring",
        href: "/super-admin/monitoring/database-monitoring",
      },
      {
        label: "Redis Monitoring",
        href: "/super-admin/monitoring/redis-monitoring",
      },
      {
        label: "Server Performance",
        href: "/super-admin/monitoring/server-performance",
      },
      {
        label: "Storage Usage",
        href: "/super-admin/monitoring/storage-usage",
      },
      { label: "Background Jobs" },
      { label: "Application Errors" },
      { label: "Database Backups" },
      { label: "Backup History" },
      { label: "Maintenance Tools" },
    ],
  ),
  createSection("account", "Profile & Account", "/super-admin/account", UserCircle, [
    "My Profile",
    { label: "Change Password", href: "/super-admin/account/change-password" },
    { label: "My Security", href: "/account/security" },
    { label: "My Devices & Sessions", href: "/account/security" },
    { label: "Notification Preferences" },
    { label: "Help & Support" },
  ]),
];

export function getSuperAdminNavigationMatch(href: string) {
  for (const section of superAdminSections) {
    const item = section.items.find((candidate) => candidate.href === href);
    if (item) return { section, item };
  }
  return null;
}

export const superAdminSearchItems = superAdminSections.flatMap((section) =>
  section.items
    .filter(
      (item): item is NavigationItem & { href: string } =>
        typeof item.href === "string",
    )
    .map((item) => ({
      ...item,
      sectionLabel: section.label,
    })),
);
