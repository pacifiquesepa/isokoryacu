import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package } from "lucide-react";
import CustomerOrderCancelAction from "@/components/orders/cancel-order-action";
import CustomerPaymentProofForm from "@/components/orders/payment-proof-form";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getCustomerOrder } from "@/lib/data-access/orders";
import { getActivePaymentAccounts } from "@/lib/data-access/order-payment-proofs";
import { orderIdSchema } from "@/lib/validation/orders";

export const metadata: Metadata = {
  title: "Order details | ILPhotoX Shop",
  robots: { index: false, follow: false },
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
const orderProgress = [
  { status: "pending", label: "Order placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "processing", label: "Being prepared" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
  { status: "fulfilled", label: "Complete" },
] as const;

export default function CustomerOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="customer-orders-loading">Loading order details…</div>}>
      <CustomerOrderDetailContent params={params} />
    </Suspense>
  );
}

async function CustomerOrderDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const parsedId = orderIdSchema.safeParse(id);
  if (!parsedId.success) notFound();

  const customer = await requireCustomerPageUser(`/orders/${encodeURIComponent(id)}`);
  const order = await getCustomerOrder(customer.id, parsedId.data);
  if (!order) notFound();
  const hasUnresolvedPaymentProof = order.paymentProofs.some(
    (proof) => proof.status === "pending" || proof.status === "approved",
  );
  const canSubmitProof =
    order.status === "pending" && !hasUnresolvedPaymentProof;
  const paymentAccounts = canSubmitProof
    ? await getActivePaymentAccounts()
    : [];

  const title = `Order ${order.id.slice(-8).toUpperCase()}`;
  const currentProgressIndex = orderProgress.findIndex(
    (step) => step.status === order.status,
  );
  const deliveryZoneLabel =
    order.deliveryZone === "kigali"
      ? "Kigali"
      : order.deliveryZone === "international"
        ? "Outside Rwanda"
        : "Outside Kigali, within Rwanda";
  const orderTotal = order.subtotal + order.deliveryFee;
  const fields = [
    { label: "Order ID", value: order.id },
    { label: "Status", value: order.status },
    {
      label: "Fulfillment",
      value: order.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery",
    },
    ...(order.fulfillmentMethod === "delivery"
      ? [
          { label: "Delivery area", value: deliveryZoneLabel },
          {
            label: "Estimated delivery",
            value: order.deliveryEta ?? "To be confirmed",
          },
          {
            label: "Delivery fee",
            value: `${numberFormat.format(order.deliveryFee)} ${order.currency}`,
          },
        ]
      : []),
    { label: "Placed", value: dateFormat.format(order.createdAt) },
    { label: "Delivery recipient", value: order.deliveryName },
    { label: "Delivery phone", value: order.deliveryPhone },
    {
      label: order.fulfillmentMethod === "pickup" ? "Pickup details" : "Delivery address",
      value: order.fulfillmentMethod === "pickup"
        ? order.pickupLocation ?? "To be confirmed"
        : order.deliveryAddress,
    },
    {
      label: "Items subtotal",
      value: `${numberFormat.format(order.subtotal)} ${order.currency}`,
    },
    {
      label: "Order total",
      value: `${numberFormat.format(orderTotal)} ${order.currency}`,
    },
    ...order.items.map((item, index) => ({
      label: `Item ${index + 1}`,
      value: `${item.productName} · ${item.quantity} × ${numberFormat.format(item.unitPrice)} ${order.currency}`,
    })),
  ];

  return (
    <div className="customer-orders-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">
            <Link href="/orders">My orders</Link> / Order details
          </span>
          <h1>{title}</h1>
          <p>Placed {dateFormat.format(order.createdAt)} UTC</p>
        </div>
        <span className={`customer-order-status is-${order.status}`}>
          {order.status}
        </span>
      </div>

      {order.status === "cancelled" ? (
        <div className="customer-order-cancelled-banner" role="status">
          This order was cancelled. Contact support if you need help with
          payment or next steps.
        </div>
      ) : (
        <section
          aria-label="Order progress"
          className="customer-order-progress"
        >
          <div className="customer-order-section-heading">
            <div>
              <h2>Order progress</h2>
              <p>Follow your order from placement to delivery.</p>
            </div>
          </div>
          <ol>
            {orderProgress.map((step, index) => {
              const stepState =
                index < currentProgressIndex
                  ? "complete"
                  : index === currentProgressIndex
                    ? "current"
                    : "upcoming";
              return (
                <li className={`is-${stepState}`} key={step.status}>
                  <span aria-hidden="true">
                    {stepState === "complete" ? "✓" : index + 1}
                  </span>
                  <strong>{step.label}</strong>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <article className="customer-order-record">
        <header className="customer-order-brand">
          <Image
            alt=""
            height={44}
            src="/ilphotox-shop-logo.png"
            width={44}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Customer · Order record</span>
          </div>
        </header>

        <section className="customer-order-items">
          <div className="customer-order-section-heading">
            <div>
              <h2><Package aria-hidden="true" size={18} /> Items</h2>
              <p>{order.items.reduce((sum, item) => sum + item.quantity, 0)} units</p>
            </div>
          </div>
          <div className="customer-orders-table-wrap">
            <table className="customer-orders-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Seller</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Unit price</th>
                  <th scope="col">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.productName}</strong></td>
                    <td>{item.sellerName}</td>
                    <td>{numberFormat.format(item.quantity)}</td>
                    <td>{numberFormat.format(item.unitPrice)} {order.currency}</td>
                    <td>{numberFormat.format(item.lineTotal)} {order.currency}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={4} scope="row">Items subtotal</th>
                  <td>{numberFormat.format(order.subtotal)} {order.currency}</td>
                </tr>
                <tr>
                  <th colSpan={4} scope="row">Delivery fee</th>
                  <td>{numberFormat.format(order.deliveryFee)} {order.currency}</td>
                </tr>
                <tr>
                  <th colSpan={4} scope="row">Order total</th>
                  <td>{numberFormat.format(orderTotal)} {order.currency}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        <section className="customer-order-delivery">
          <h2>{order.fulfillmentMethod === "pickup" ? "Pickup details" : "Delivery details"}</h2>
          <dl>
            <div><dt>Recipient</dt><dd>{order.deliveryName}</dd></div>
            <div><dt>Phone</dt><dd>{order.deliveryPhone}</dd></div>
            {order.fulfillmentMethod === "delivery" ? (
              <>
                <div><dt>Area</dt><dd>{deliveryZoneLabel}</dd></div>
                <div><dt>Address</dt><dd>{order.deliveryAddress}</dd></div>
                <div><dt>Estimated delivery</dt><dd>{order.deliveryEta ?? "To be confirmed"}</dd></div>
                <div><dt>Delivery fee</dt><dd>{numberFormat.format(order.deliveryFee)} {order.currency}</dd></div>
              </>
            ) : (
              <div><dt>Pickup location</dt><dd>{order.pickupLocation ?? "To be confirmed"}</dd></div>
            )}
          </dl>
        </section>

        {order.shipments.length > 0 && (
          <section className="customer-order-tracking">
            <div className="customer-order-section-heading">
              <div>
                <h2>Shipment tracking</h2>
                <p>Latest delivery information for this order.</p>
              </div>
            </div>
            <div className="customer-order-tracking-list">
              {order.shipments.map((shipment) => (
                <article key={shipment.id}>
                  <div className="customer-order-tracking-status">
                    <span className="customer-order-tracking-icon">
                      <Package aria-hidden="true" size={18} />
                    </span>
                    <div>
                      <strong>{shipment.status}</strong>
                      <span>{shipment.carrier}</span>
                    </div>
                  </div>
                  <dl>
                    <div>
                      <dt>Tracking number</dt>
                      <dd><code>{shipment.trackingNumber}</code></dd>
                    </div>
                    {shipment.shippedAt && (
                      <div>
                        <dt>Shipped</dt>
                        <dd>{dateFormat.format(shipment.shippedAt)} UTC</dd>
                      </div>
                    )}
                    {shipment.deliveredAt && (
                      <div>
                        <dt>Delivered</dt>
                        <dd>{dateFormat.format(shipment.deliveredAt)} UTC</dd>
                      </div>
                    )}
                    {shipment.notes && (
                      <div>
                        <dt>Update</dt>
                        <dd>{shipment.notes}</dd>
                      </div>
                    )}
                  </dl>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="customer-order-payment-history">
          <div className="customer-order-section-heading">
            <div>
              <h2>Order updates</h2>
              <p>{order.notifications.length} updates</p>
            </div>
          </div>
          {order.notifications.length ? (
            <ul>
              {order.notifications.map((notification) => (
                <li key={notification.id}>
                  <div>
                    <strong>{notification.title}</strong>
                    <span>{notification.body}</span>
                    <span>{dateFormat.format(notification.createdAt)} UTC</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>No order updates yet.</p>
          )}
        </section>

        <div className="customer-order-payment-note">
          For bank and mobile money payments, submitting a receipt does not
          automatically confirm the order. An administrator must review it.
        </div>

        <section className="customer-order-payment-history">
          <div className="customer-order-section-heading">
            <div>
              <h2>Payment receipt status</h2>
              <p>
                {order.paymentProofs.length
                  ? `${order.paymentProofs.length} receipt submission${order.paymentProofs.length === 1 ? "" : "s"}`
                  : "No receipts submitted"}
              </p>
            </div>
          </div>
          {order.paymentProofs.length ? (
            <ul>
              {order.paymentProofs.map((proof) => (
                <li key={proof.id}>
                  <div>
                    <strong>{proof.method === "bank_transfer" ? "Bank transfer" : "Mobile money"}</strong>
                    <span>
                      {proof.transactionReference} · {numberFormat.format(proof.amount)} {proof.currency}
                    </span>
                    <span>{dateFormat.format(proof.createdAt)} UTC</span>
                    {proof.reviewReason && <span>Review note: {proof.reviewReason}</span>}
                  </div>
                  <span className={`customer-payment-proof-status is-${proof.status}`}>
                    {proof.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        {canSubmitProof && (
          <CustomerPaymentProofForm
            accounts={paymentAccounts}
            orderId={order.id}
          />
        )}

        <section className="customer-order-export">
          <div className="customer-order-section-heading">
            <div>
              <h2>Order record</h2>
              <p>Download or share a PDF of your order details.</p>
            </div>
          </div>
          <SuperAdminRecordActions
            fields={fields}
            recordId={order.id}
            title={title}
          />
        </section>
      </article>

      <div className="customer-order-page-actions">
        <Link className="customer-orders-back" href="/orders">
          <ArrowLeft aria-hidden="true" size={16} /> Back to my orders
        </Link>
        {hasUnresolvedPaymentProof ? (
          <p className="customer-order-cancel-note">
            Cancellation is unavailable while a payment receipt is pending review or approved.
          </p>
        ) : (
          <CustomerOrderCancelAction orderId={order.id} status={order.status} />
        )}
      </div>
    </div>
  );
}
