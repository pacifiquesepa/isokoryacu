import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import SuperAdminRecordActions from "@/components/super-admin/record-actions";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantProduct } from "@/lib/data-access/merchant-dashboard";

export const metadata: Metadata = {
  title: "Product details | Merchant portal",
};

const numberFormat = new Intl.NumberFormat("en-RW");
const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function MerchantProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading product details…</div>}>
      <MerchantProductDetailContent params={params} />
    </Suspense>
  );
}

async function MerchantProductDetailContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [seller, { id }] = await Promise.all([
    requireMerchantPageUser(),
    params,
  ]);
  const product = await getMerchantProduct(seller, id);
  if (!product) notFound();

  const fields = [
    { label: "Product ID", value: product.id },
    { label: "SKU", value: product.sku ?? "Not provided" },
    { label: "Brand", value: product.brand ?? "Not provided" },
    { label: "Name", value: product.name },
    { label: "Kinyarwanda name", value: product.nameRw ?? "Not provided" },
    { label: "French name", value: product.nameFr ?? "Not provided" },
    { label: "Category", value: product.categoryInfo.name },
    { label: "Subcategory", value: product.subcategory?.name ?? "Not provided" },
    { label: "Description", value: product.description ?? "Not provided" },
    { label: "Warranty", value: product.warranty ?? "Not provided" },
    {
      label: "Specifications",
      value: product.specifications?.length
        ? product.specifications.map(({ name, value }) => `${name}: ${value}`).join("; ")
        : "Not provided",
    },
    { label: "Return policy", value: product.returnPolicy ?? "Not provided" },
    { label: "Price", value: `${numberFormat.format(product.price)} RWF` },
    {
      label: "Previous price",
      value: product.previousPrice
        ? `${numberFormat.format(product.previousPrice)} RWF`
        : "Not discounted",
    },
    { label: "Shop location", value: product.location },
    { label: "Stock", value: numberFormat.format(product.stockQuantity) },
    {
      label: "Storefront status",
      value: product.isPublished
        ? "Published"
        : product.moderationStatus === "pending"
          ? "Pending review"
          : product.moderationStatus === "scheduled"
            ? "Scheduled"
            : product.moderationStatus === "rejected"
              ? "Rejected"
              : product.moderationStatus === "hidden"
                ? "Hidden"
                : "Draft",
    },
    {
      label: "Scheduled publication",
      value: product.scheduledAt
        ? dateFormat.format(product.scheduledAt)
        : "Not scheduled",
    },
    { label: "Added", value: dateFormat.format(product.createdAt) },
  ];

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">
            <Link href="/merchant/products">Products</Link> / Product details
          </div>
          <h1>{product.name}</h1>
          <p>Product record · {product.categoryInfo.name}</p>
        </div>
        <div className="merchant-record-heading-actions">
          <Link
            className="merchant-primary-action"
            href={`/merchant/products/${encodeURIComponent(product.id)}/edit`}
          >
            Edit product
          </Link>
        </div>
      </div>

      <article className="merchant-panel merchant-record-detail">
        <header className="merchant-record-brand">
          <Image
            alt=""
            height={42}
            src="/ilphotox-shop-logo.png"
            width={42}
          />
          <div>
            <strong>ILPhotoX Shop</strong>
            <span>Merchant · Product record</span>
          </div>
        </header>
        <div className="merchant-record-product">
          <div className="merchant-record-image-gallery">
            {product.uploadedImages.length ? (
              product.uploadedImages.map((image, index) => (
                <Image
                  alt={index === 0 ? product.name : `${product.name} photo ${index + 1}`}
                  className="merchant-record-product-image"
                  height={160}
                  key={image.id}
                  src={`/api/products/images/${image.id}`}
                  unoptimized
                  width={160}
                />
              ))
            ) : (
              <Image
                alt={product.name}
                className="merchant-record-product-image"
                height={160}
                src={product.image}
                unoptimized
                width={160}
              />
            )}
          </div>
          <span className={`merchant-status is-${product.isPublished ? "published" : "unpublished"}`}>
            {product.isPublished ? "Published" : "Unpublished"}
          </span>
        </div>
        <dl className="merchant-detail-list">
          {fields.map((field) => (
            <div key={field.label}>
              <dt>{field.label}</dt>
              <dd>{field.value}</dd>
            </div>
          ))}
        </dl>
        <div className="merchant-record-export">
          <h2>Product record</h2>
          <p>Download or share a PDF with the complete product details.</p>
          <SuperAdminRecordActions
            fields={fields}
            recordId={product.id}
            title={product.name}
          />
        </div>
      </article>
      <Link className="merchant-back-link" href="/merchant/products">
        <ChevronLeft size={16} /> Back to products
      </Link>
    </div>
  );
}
