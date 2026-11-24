import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Package } from "lucide-react";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantOrder } from "@/lib/data-access/merchant-dashboard";

export const metadata: Metadata = {
  title: "Order details | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export default function MerchantOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading order details…</div>}>
      <MerchantOrderDetailContent params={params} />
    </Suspense>
  );
}

async function MerchantOrderDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [seller, { id }] = await Promise.all([
    requireMerchantPageUser(),
    params,
  ]);
  const order = await getMerchantOrder(seller, id);
  if (!order) notFound();
  const sellerSubtotal = order.items.reduce(
    (sum, item) => sum + item.merchantLineTotal,
    0,
  );
  const recordFields = [
    { label: "Order ID", value: order.id },
    { label: "Status", value: order.status },
    { label: "Placed", value: dateFormat.format(order.createdAt) },
    ...order.items.map((item, index) => ({
      label: `Your item ${index + 1}`,
      value: `${item.productName} · ${item.quantity} × ${numberFormat.format(item.merchantUnitPrice)} RWF · ${numberFormat.format(item.merchantLineTotal)} RWF`,
    })),
    {
      label: "Your items subtotal",
      value: `${numberFormat.format(sellerSubtotal)} RWF`,
    },
  ];

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">
            <Link href="/merchant/orders">Orders</Link> / Order details
          </div>
          <h1>Order #{order.id.slice(-8).toUpperCase()}</h1>
          <p>Placed {dateFormat.format(order.createdAt)} UTC</p>
        </div>
        <span className={`merchant-status is-${order.status}`}>{order.status}</span>
      </div>
      <div className="merchant-info-banner" role="note">
        This marketplace order may contain items from other shops. Only your
        shop&apos;s order items and subtotal are displayed below.
      </div>
      <section className="merchant-panel merchant-dashboard-section">
        <div className="merchant-panel-heading">
          <div>
            <h2><Package aria-hidden="true" size={18} /> Items from your shop</h2>
            <p>{order.items.reduce((sum, item) => sum + item.quantity, 0)} units</p>
          </div>
        </div>
        <div className="merchant-table-wrap">
          <table className="merchant-table">
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">Quantity</th>
                <th scope="col">Unit price</th>
                <th scope="col">Line subtotal</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="merchant-product-cell">
                      {item.productImage && (
                        <Image
                          alt=""
                          className="merchant-product-thumb"
                          height={44}
                          src={item.productImage}
                          unoptimized
                          width={44}
                        />
                      )}
                      <strong>{item.productName}</strong>
                    </div>
                  </td>
                  <td>{numberFormat.format(item.quantity)}</td>
                  <td>{numberFormat.format(item.merchantUnitPrice)} RWF</td>
                  <td>{numberFormat.format(item.merchantLineTotal)} RWF</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan={3} scope="row">Your items subtotal</th>
                <td>{numberFormat.format(sellerSubtotal)} RWF</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="merchant-list-note">
          This is the subtotal for your shop&apos;s items, not the full order total
          or a payment/payout amount.
        </p>
      </section>
      <section className="merchant-panel merchant-record-export-panel">
        <header className="merchant-record-brand">
          <Image
            alt=""
            height={44}
            src="/ilphotox-shop-logo.png"
            width={44}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Merchant · Order record</span>
          </div>
        </header>
        <div className="merchant-panel-heading">
          <div>
            <h2>Order record</h2>
            <p>Download or share a PDF containing only your shop&apos;s order items.</p>
          </div>
        </div>
        <SuperAdminRecordActions
          fields={recordFields}
          recordId={order.id}
          title={`Order ${order.id.slice(-8).toUpperCase()}`}
        />
      </section>
      <Link className="merchant-back-link" href="/merchant/orders">
        <ChevronLeft size={16} /> Back to orders
      </Link>
    </div>
  );
}
