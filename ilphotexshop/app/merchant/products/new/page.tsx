import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, PackagePlus } from "lucide-react";
import MerchantProductForm from "@/components/merchant/product-form";
import { requireMerchantPageUser } from "@/lib/authorization";
import {
  getActiveMerchantProductSubcategories,
  getActiveProductCategories,
} from "@/lib/data-access/products";

export const metadata: Metadata = {
  title: "Add product | Merchant portal",
};

export default function NewMerchantProductPage() {
  return (
    <Suspense fallback={<div className="merchant-loading">Loading product form…</div>}>
      <NewMerchantProductContent />
    </Suspense>
  );
}

async function NewMerchantProductContent() {
  await requireMerchantPageUser();
  const [subcategories, categories] = await Promise.all([
    getActiveMerchantProductSubcategories(),
    getActiveProductCategories(),
  ]);
  return (
    <div className="merchant-page">
      <div className="merchant-page-heading">
        <div>
          <div className="merchant-breadcrumb">
            <Link href="/merchant/products">Products</Link> / Add product
          </div>
          <h1>Add a product</h1>
          <p>Save drafts, submit listings for approval, or schedule a future publication.</p>
        </div>
      </div>
      <section className="merchant-panel merchant-form-panel">
        <div className="merchant-panel-heading">
          <div>
            <h2><PackagePlus aria-hidden="true" size={18} /> Product details</h2>
            <p>Enter accurate details so customers can find your product.</p>
          </div>
        </div>
        <MerchantProductForm categories={categories} subcategories={subcategories} />
      </section>
      <Link className="merchant-back-link" href="/merchant/products">
        <ChevronLeft size={16} /> Back to products
      </Link>
    </div>
  );
}
