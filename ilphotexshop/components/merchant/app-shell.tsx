"use client";

import Image from "next/image";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Menu,
  PackagePlus,
  Search,
  Store,
  X,
} from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { merchantNavSections } from "@/components/merchant/navigation";

type MerchantAppShellProps = {
  children: ReactNode;
  userName: string;
  userEmail: string;
  permissions?: {
    isOwner: boolean;
    role: "owner" | "manager" | "operations" | "support" | "finance";
    canManageProducts: boolean;
    canManageOrders: boolean;
    canManageStaff: boolean;
    canManageFinancialProfile: boolean;
  } | null;
};

function isActiveHref(pathname: string, href: string, query: string) {
  const [targetPath, targetQuery] = href.split("?");
  if (targetPath !== pathname) return false;
  if (!targetQuery) return pathname === "/merchant/dashboard" || !query;
  return new URLSearchParams(targetQuery).get("status") === query;
}

export default function MerchantAppShell({
  children,
  userName,
  userEmail,
  permissions,
}: MerchantAppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSection, setOpenSection] = useState("overview");
  const [productSearch, setProductSearch] = useState(searchParams.get("q") ?? "");
  const query = searchParams.get("status") ?? "";
  const currentSection =
    pathname.startsWith("/merchant/products")
      ? "products"
      : pathname.startsWith("/merchant/orders")
        ? "orders"
        : pathname.startsWith("/merchant/shop")
          ? "shop"
        : pathname.startsWith("/merchant/profile")
          ? "account"
            : pathname.startsWith("/merchant/staff")
              ? "staff"
                : pathname.startsWith("/merchant/analytics")
              ? "analytics"
                : pathname.startsWith("/merchant/promotions")
              ? "marketing"
                : pathname.startsWith("/merchant/messages")
              ? "messages"
                : pathname.startsWith("/merchant/support")
              ? "messages"
                : pathname.startsWith("/merchant/notifications")
              ? "messages"
                : pathname.startsWith("/merchant/audit")
              ? "audit"
                : pathname.startsWith("/merchant/settings")
              ? "settings"
                : pathname.startsWith("/merchant/help")
              ? "help"
              : "overview";
  const initials =
    userName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "M";

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (productSearch.trim()) params.set("q", productSearch.trim());
    if (query) params.set("status", query);
    router.push(`/merchant/products${params.size ? `?${params}` : ""}`);
    setMobileOpen(false);
  }

  return (
    <div
      className={`merchant-app${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}
    >
      <header className="merchant-topbar">
        <button
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="merchant-mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <form className="merchant-search" onSubmit={handleSearch} role="search">
          <Search aria-hidden="true" size={18} />
          <input
            aria-label="Search my products"
            autoComplete="off"
            onChange={(event) => setProductSearch(event.target.value)}
            placeholder="Search my products"
            value={productSearch}
          />
          {productSearch && (
            <button
              aria-label="Clear product search"
              onClick={() => setProductSearch("")}
              type="button"
            >
              <X size={15} />
            </button>
          )}
        </form>
        <div className="merchant-topbar-actions">
          <Link className="merchant-store-link" href="/">
            <Store size={16} />
            Storefront
            <ArrowUpRight size={14} />
          </Link>
          <Link className="merchant-new-product" href="/merchant/products/new">
            <PackagePlus size={16} />
            <span>Add product</span>
          </Link>
        </div>
      </header>

      <button
        aria-label="Close navigation"
        className="merchant-nav-backdrop"
        onClick={() => setMobileOpen(false)}
        type="button"
      />

      <div className="merchant-workspace">
        <aside aria-label="Merchant navigation" className="merchant-sidebar">
          <div className="merchant-brand">
            <Link aria-label="ILPhotoX Shop merchant dashboard" href="/merchant/dashboard">
              <Image
                alt=""
                height={38}
                src="/ilphotox-shop-logo.png"
                width={38}
              />
              <span>
                <strong>ILPhotoX Shop</strong>
                <small>MERCHANT PORTAL</small>
              </span>
            </Link>
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="merchant-collapse-button"
              onClick={() => setCollapsed((value) => !value)}
              type="button"
            >
              {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
            </button>
          </div>

          <nav aria-label="Merchant sections" className="merchant-nav">
            <p className="merchant-nav-caption">WORKSPACE</p>
            {merchantNavSections
              .filter((section) => {
                if (!permissions || permissions.isOwner) return true;
                if (permissions.role === "support") {
                  return ["overview", "messages", "customers", "help", "settings", "account"].includes(section.id);
                }
                if (permissions.role === "finance") {
                  return ["overview", "finance", "audit", "settings", "account"].includes(section.id);
                }
                if (permissions.role === "operations") {
                  return ["overview", "products", "inventory", "analytics", "orders", "settings", "account"].includes(section.id);
                }
                if (permissions.role === "manager") {
                  return ["overview", "shop", "products", "orders", "inventory", "customers", "staff", "analytics", "settings", "account"].includes(section.id);
                }
                if (section.id === "products" || section.id === "inventory" || section.id === "analytics") {
                  return permissions.canManageProducts;
                }
                if (section.id === "orders") return permissions.canManageOrders;
                if (section.id === "staff") return permissions.canManageStaff;
                if (section.id === "finance") return permissions.canManageFinancialProfile;
                return true;
              })
              .map((section) => {
              const Icon = section.icon;
              const active = currentSection === section.id;
              const expanded = active || openSection === section.id;
              return (
                <div className="merchant-nav-group" key={section.id}>
                  <button
                    aria-expanded={expanded}
                    className={`merchant-nav-item${active ? " is-active" : ""}`}
                    onClick={() => {
                      if (collapsed) setCollapsed(false);
                      setOpenSection((current) =>
                        current === section.id ? "" : section.id,
                      );
                    }}
                    title={collapsed ? section.label : undefined}
                    type="button"
                  >
                    <Icon aria-hidden="true" size={19} />
                    <span>{section.label}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className="merchant-nav-chevron"
                      size={15}
                    />
                  </button>
                  {expanded && (
                    <div className="merchant-subnav">
                      {section.items.map((item) => {
                        const selected = isActiveHref(
                          pathname,
                          item.href,
                          query,
                        );
                        return (
                          <Link
                            aria-current={selected ? "page" : undefined}
                            className={`merchant-subnav-link${selected ? " is-active" : ""}`}
                            href={item.href}
                            key={item.href}
                            onClick={() => setMobileOpen(false)}
                          >
                            {item.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          <div className="merchant-account">
            <span aria-hidden="true" className="merchant-avatar">
              {initials}
            </span>
            <span className="merchant-account-copy">
              <strong>{userName}</strong>
              <small>{userEmail}</small>
              <small>Seller account</small>
            </span>
            <button
              aria-label="Sign out"
              className="merchant-signout"
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Sign out"
              type="button"
            >
              <LogOut size={17} />
            </button>
          </div>
        </aside>

        <main className="merchant-content">{children}</main>
      </div>
      <footer className="merchant-global-footer">
        ILPhotoX Shop · Merchant workspace
      </footer>
    </div>
  );
}
