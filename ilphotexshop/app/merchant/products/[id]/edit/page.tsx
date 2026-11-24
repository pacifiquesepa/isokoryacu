import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, PackageCheck } from "lucide-react";
import MerchantProductForm from "@/components/merchant/product-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import { getMerchantProduct } from "@/lib/data-access/merchant-dashboard";
import {
  getActiveMerchantProductSubcategories,
  getActiveProductCategories,
} from "@/lib/data-access/products";

export const metadata: Metadata = {
  title: "Edit product | Merchant portal",
};

export default function EditMerchantProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading product…</div>}>
      <EditMerchantProductContent params={params} />
    </Suspense>
  );
}

async function EditMerchantProductContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [seller, { id }] = await Promise.all([
    requireMerchantPageUser(),
    params,
  ]);
  const [product, subcategories, categories] = await Promise.all([
    getMerchantProduct(seller, id),
    getActiveMerchantProductSubcategories(),
    getActiveProductCategories(),
  ]);
  if (!product) notFound();

  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">
            <Link href="/merchant/products">Products</Link> / Edit listing
          </div>
          <h1>Edit product</h1>
          <p>Update product details and choose whether to save a draft, request approval, or schedule publication.</p>
        </div>
      </div>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading">
          <div>
            <h2><PackageCheck aria-hidden="true" size={18} /> Product details</h2>
            <p>Update the listing and keep your inventory accurate.</p>
          </div>
        </div>
        <MerchantProductForm categories={categories} product={product} subcategories={subcategories} />
      </section>
      <Link className="merchant-back-link" href="/merchant/products">
        <ChevronLeft size={16} /> Back to products
      </Link>
    </div>
  );
}
