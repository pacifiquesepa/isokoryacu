"use client";

import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronDown,
  CreditCard,
  Headphones,
  LayoutDashboard,
  Menu,
  Package,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type CustomerPortalSection =
  | "account"
  | "orders"
  | "payments"
  | "profile"
  | "security"
  | "settings";

export default function CustomerPortalLayout({
  active,
  children,
}: {
  active: CustomerPortalSection;
  children: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  return (
    <div
      className={`customer-orders-shell customer-portal-shell${mobileOpen ? " is-mobile-open" : ""}`}
    >
      <header className="customer-orders-header customer-portal-header">
        <button
          aria-controls="customer-portal-sidebar"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          className="customer-portal-mobile-toggle"
          onClick={() => setMobileOpen((open) => !open)}
          type="button"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className="customer-portal-page-label">
          <strong>Customer workspace</strong>
          <span>Overview and account activity</span>
        </div>
        <div className="customer-portal-header-actions">
          <Link className="customer-portal-shop-link" href="/">
            <ShoppingBag aria-hidden="true" size={16} />
            Continue shopping
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </header>

      <button
        aria-label="Close navigation"
        className="customer-portal-nav-backdrop"
        onClick={() => setMobileOpen(false)}
        type="button"
      />

      <div className="customer-portal-workspace">
        <aside
          className="customer-portal-sidebar"
          id="customer-portal-sidebar"
          aria-label="Customer navigation"
        >
          <Link
            aria-label="ILPhotoX Shop customer workspace"
            className="customer-portal-brand"
            href="/account"
            onClick={() => setMobileOpen(false)}
          >
            <Image
              alt=""
              height={40}
              src="/ilphotox-shop-logo.png"
              width={40}
            />
            <span>
              <strong>ILPhotoX Shop</strong>
              <small>CUSTOMER</small>
            </span>
          </Link>
          <nav aria-label="Customer account">
            <span className="customer-portal-sidebar-label">WORKSPACE</span>
            <Link
              aria-current={active === "account" ? "page" : undefined}
              className={`customer-portal-nav-link${active === "account" ? " is-active" : ""}`}
              href="/account"
              onClick={() => setMobileOpen(false)}
            >
              <LayoutDashboard aria-hidden="true" size={18} />
              <span>Overview</span>
            </Link>

            <span className="customer-portal-sidebar-label">ORDERS &amp; PAYMENTS</span>
            <details
              className="customer-portal-nav-group"
              open={active === "orders"}
            >
              <summary className={active === "orders" ? "is-active" : ""}>
                <Package aria-hidden="true" size={18} />
                <span>Orders</span>
                <ChevronDown aria-hidden="true" className="customer-portal-chevron" size={16} />
              </summary>
              <div className="customer-portal-subnav">
                <Link
                  aria-current={active === "orders" ? "page" : undefined}
                  className={active === "orders" ? "is-active" : ""}
                  href="/orders"
                  onClick={() => setMobileOpen(false)}
                >
                  All orders
                </Link>
                <Link
                  href="/orders?status=pending"
                  onClick={() => setMobileOpen(false)}
                >
                  Awaiting confirmation
                </Link>
                <Link
                  href="/orders?status=processing"
                  onClick={() => setMobileOpen(false)}
                >
                  Being prepared
                </Link>
                <Link
                  href="/orders?status=shipped"
                  onClick={() => setMobileOpen(false)}
                >
                  On the way
                </Link>
                <Link
                  href="/orders?status=delivered"
                  onClick={() => setMobileOpen(false)}
                >
                  Delivered
                </Link>
              </div>
            </details>

            <details
              className="customer-portal-nav-group"
              open={active === "payments"}
            >
              <summary className={active === "payments" ? "is-active" : ""}>
                <CreditCard aria-hidden="true" size={18} />
                <span>Payments &amp; receipts</span>
                <ChevronDown aria-hidden="true" className="customer-portal-chevron" size={16} />
              </summary>
              <div className="customer-portal-subnav">
                <Link
                  aria-current={active === "payments" ? "page" : undefined}
                  className={active === "payments" ? "is-active" : ""}
                  href="/account/payments"
                  onClick={() => setMobileOpen(false)}
                >
                  All receipts
                </Link>
                <Link
                  href="/account/payments?status=pending"
                  onClick={() => setMobileOpen(false)}
                >
                  Pending review
                </Link>
                <Link
                  href="/account/payments?status=approved"
                  onClick={() => setMobileOpen(false)}
                >
                  Approved
                </Link>
                <Link
                  href="/account/payments?status=rejected"
                  onClick={() => setMobileOpen(false)}
                >
                  Needs attention
                </Link>
              </div>
            </details>

            <span className="customer-portal-sidebar-label">ACCOUNT</span>
            <Link
              aria-current={active === "profile" ? "page" : undefined}
              className={`customer-portal-nav-link${active === "profile" ? " is-active" : ""}`}
              href="/account/profile"
              onClick={() => setMobileOpen(false)}
            >
              <UserRound aria-hidden="true" size={18} />
              <span>Profile</span>
            </Link>
            <Link
              aria-current={active === "settings" ? "page" : undefined}
              className={`customer-portal-nav-link${active === "settings" ? " is-active" : ""}`}
              href="/account/settings"
              onClick={() => setMobileOpen(false)}
            >
              <Settings2 aria-hidden="true" size={18} />
              <span>Settings</span>
            </Link>
            <Link
              aria-current={active === "security" ? "page" : undefined}
              className={`customer-portal-nav-link${active === "security" ? " is-active" : ""}`}
              href="/account/security"
              onClick={() => setMobileOpen(false)}
            >
              <ShieldCheck aria-hidden="true" size={18} />
              <span>Security</span>
            </Link>
            <Link
              className="customer-portal-nav-link"
              href="/support/all-in-one"
              onClick={() => setMobileOpen(false)}
            >
              <Headphones aria-hidden="true" size={18} />
              <span>Customer support</span>
            </Link>
          </nav>
          <Link
            className="customer-portal-sidebar-shop"
            href="/"
            onClick={() => setMobileOpen(false)}
          >
            <ShoppingBag aria-hidden="true" size={17} />
            Shop products
            <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </aside>

        <main className="customer-orders-main customer-portal-content">
          {children}
        </main>
      </div>

      <footer className="customer-orders-footer">
        ILPhotoX Shop · Your shopping, orders, and account
      </footer>
    </div>
  );
}
