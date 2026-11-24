import type { Metadata } from "next";
import { Suspense } from "react";
import { Layers3 } from "lucide-react";
import ProductCategoryManager from "@/components/super-admin/product-category-manager";
import { getSuperAdminProductCategories } from "@/lib/data-access/super-admin-product-management";

export const metadata: Metadata = {
  title: "Product Categories | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default function SuperAdminProductCategoriesPage() {
  return (
    <Suspense fallback={<div className="super-admin-loading">Loading product categories…</div>}>
      <SuperAdminProductCategoriesContent />
    </Suspense>
  );
}

async function SuperAdminProductCategoriesContent() {
  const categories = await getSuperAdminProductCategories();

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Product Management / Categories
          </div>
          <h1>Product categories</h1>
          <p>Create, rename, and remove product categories used across the marketplace.</p>
        </div>
        <Layers3 aria-hidden="true" size={25} />
      </div>

      <ProductCategoryManager categories={categories} />
    </div>
  );
}
