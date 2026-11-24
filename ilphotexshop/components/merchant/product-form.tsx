"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { ProductModerationStatus } from "@prisma/client";
import { maxProductImageCount } from "@/lib/http/product-image-upload";

export type MerchantProductFormValues = {
  id?: string;
  sku?: string | null;
  brand?: string | null;
  subcategoryId?: string | null;
  subcategory?: { id: string; name: string; category: string; isActive: boolean } | null;
  name?: string;
  nameRw?: string | null;
  nameFr?: string | null;
  description?: string | null;
  warranty?: string | null;
  specifications?: { name: string; value: string }[] | null;
  returnPolicy?: string | null;
  category?: string;
  price?: number;
  previousPrice?: number | null;
  image?: string;
  images?: { id: string; sortOrder: number }[];
  location?: string;
  stockQuantity?: number;
  lowStockThreshold?: number | null;
  moderationStatus?: ProductModerationStatus;
  scheduledAt?: Date | string | null;
};

type SubcategoryOption = {
  id: string;
  category: string;
  name: string;
  isActive?: boolean;
};

type Specification = { name: string; value: string };

function toLocalDateTimeValue(value: Date | string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export default function MerchantProductForm({
  product,
  subcategories = [],
  categories,
}: {
  product?: MerchantProductFormValues;
  subcategories?: SubcategoryOption[];
  categories: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [category, setCategory] = useState(
    product?.category ?? categories[0]?.slug ?? "",
  );
  const [subcategoryId, setSubcategoryId] = useState(product?.subcategoryId ?? "");
  const [imageSource, setImageSource] = useState<"url" | "upload">(
    product?.image?.startsWith("/api/products/images/") ? "upload" : "url",
  );
  const [publicationMode, setPublicationMode] = useState<
    "draft" | "review" | "schedule"
  >(
    product?.moderationStatus === "draft"
      ? "draft"
      : product?.scheduledAt
        ? "schedule"
        : "review",
  );
  const [specifications, setSpecifications] = useState<Specification[]>(
    product?.specifications?.length
      ? product.specifications
      : [{ name: "", value: "" }],
  );
  const [selectedImageCount, setSelectedImageCount] = useState(0);
  const editing = Boolean(product?.id);
  const subcategoryOptions = [
    ...subcategories.filter((item) => item.category === category),
    ...(product?.subcategory &&
    product.subcategory.category === category &&
    !subcategories.some((item) => item.id === product.subcategory?.id)
      ? [product.subcategory]
      : []),
  ];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const formData = new FormData(event.currentTarget);
    const populatedSpecifications = specifications.filter(
      ({ name, value }) => name.trim() && value.trim(),
    );
    const incompleteSpecification = specifications.some(
      ({ name, value }) => Boolean(name.trim()) !== Boolean(value.trim()),
    );
    if (incompleteSpecification) {
      setError("Complete both the name and value for each specification.");
      setBusy(false);
      return;
    }

    const scheduledLocal = String(formData.get("scheduledAt") ?? "").trim();
    if (publicationMode === "schedule") {
      const scheduledDate = new Date(scheduledLocal);
      if (!scheduledLocal || Number.isNaN(scheduledDate.getTime())) {
        setError("Choose a valid publication date and time.");
        setBusy(false);
        return;
      }
      if (scheduledDate.getTime() <= Date.now()) {
        setError("Publication time must be in the future.");
        setBusy(false);
        return;
      }
      formData.set("scheduledAt", scheduledDate.toISOString());
    } else {
      formData.set("scheduledAt", "");
    }
    formData.set("publicationMode", publicationMode);
    formData.set("specifications", JSON.stringify(populatedSpecifications));
    formData.set("imageSource", imageSource);

    try {
      const response = await fetch(
        editing
          ? `/api/seller/products/${encodeURIComponent(product?.id ?? "")}`
          : "/api/seller/products",
        {
          method: editing ? "PATCH" : "POST",
          body: formData,
        },
      );
      const result = (await response.json().catch(() => null)) as
        | { error?: string; details?: { fieldErrors?: Record<string, string[]> } }
        | null;
      if (!response.ok) {
        const detail = Object.values(result?.details?.fieldErrors ?? {})
          .flat()
          .find(Boolean);
        throw new Error(detail || result?.error || "Product could not be saved.");
      }

      if (editing) {
        setNotice(
          publicationMode === "draft"
            ? "Changes saved as a draft."
            : "Changes saved and sent for review.",
        );
        router.refresh();
      } else {
        router.replace("/merchant/products?status=unpublished");
      }
    } catch (caught) {
      console.error("Could not save merchant product", caught);
      setError(
        caught instanceof Error ? caught.message : "Product could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="merchant-product-form" onSubmit={handleSubmit}>
      <div className="merchant-form-grid">
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-sku">SKU</label>
          <input
            autoComplete="off"
            defaultValue={product?.sku ?? ""}
            id="merchant-product-sku"
            maxLength={64}
            name="sku"
            placeholder="e.g. PHONE-128-BLK"
          />
          <small>Optional, but it must be unique when provided.</small>
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-brand">Brand</label>
          <input
            defaultValue={product?.brand ?? ""}
            id="merchant-product-brand"
            maxLength={120}
            name="brand"
          />
        </div>
        <div className="merchant-form-field is-wide">
          <label htmlFor="merchant-product-name">Product name</label>
          <input
            autoComplete="off"
            defaultValue={product?.name ?? ""}
            id="merchant-product-name"
            maxLength={160}
            minLength={2}
            name="name"
            required
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-name-rw">Kinyarwanda name</label>
          <input
            defaultValue={product?.nameRw ?? ""}
            id="merchant-product-name-rw"
            maxLength={160}
            name="nameRw"
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-name-fr">French name</label>
          <input
            defaultValue={product?.nameFr ?? ""}
            id="merchant-product-name-fr"
            maxLength={160}
            name="nameFr"
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-category">Category</label>
          <select
            id="merchant-product-category"
            name="category"
            onChange={(event) => {
              const nextCategory = event.target.value;
              setCategory(nextCategory);
              if (!subcategoryOptions.some((item) => item.id === subcategoryId && item.category === nextCategory)) {
                setSubcategoryId("");
              }
            }}
            required
            value={category}
          >
            {categories.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-subcategory">Subcategory</label>
          <select
            id="merchant-product-subcategory"
            name="subcategoryId"
            onChange={(event) => setSubcategoryId(event.target.value)}
            value={subcategoryId}
          >
            <option value="">No subcategory</option>
            {subcategoryOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
                {"isActive" in item && item.isActive === false ? " (inactive)" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-price">Price (RWF)</label>
          <input
            defaultValue={product?.price ?? ""}
            id="merchant-product-price"
            max={1_000_000_000}
            min={1}
            name="price"
            required
            step={1}
            type="number"
          />
          <small>Your listed price; the platform fee is added to the customer-facing price.</small>
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-previous-price">Previous price (RWF)</label>
          <input
            defaultValue={product?.previousPrice ?? ""}
            id="merchant-product-previous-price"
            max={1_000_000_000}
            min={1}
            name="previousPrice"
            step={1}
            type="number"
          />
          <small>Leave blank if the product is not discounted.</small>
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-stock">Stock quantity</label>
          <input
            defaultValue={product?.stockQuantity ?? 0}
            id="merchant-product-stock"
            max={1_000_000}
            min={0}
            name="stockQuantity"
            required
            step={1}
            type="number"
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-location">Shop location</label>
          <input
            defaultValue={product?.location ?? ""}
            id="merchant-product-location"
            maxLength={120}
            minLength={2}
            name="location"
            required
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-low-stock-threshold">
            Low-stock alert threshold
          </label>
          <input
            defaultValue={product?.lowStockThreshold ?? ""}
            id="merchant-product-low-stock-threshold"
            max={1_000_000}
            min={0}
            name="lowStockThreshold"
            placeholder="Use category default"
            step={1}
            type="number"
          />
          <small>Leave blank to use the category threshold (or 3 units).</small>
        </div>
        <div className="merchant-form-field is-wide">
          <label htmlFor="merchant-product-description">Detailed description</label>
          <textarea
            defaultValue={product?.description ?? ""}
            id="merchant-product-description"
            maxLength={10000}
            name="description"
            rows={5}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-warranty">Warranty</label>
          <textarea
            defaultValue={product?.warranty ?? ""}
            id="merchant-product-warranty"
            maxLength={1000}
            name="warranty"
            rows={3}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-product-return-policy">Return policy</label>
          <textarea
            defaultValue={product?.returnPolicy ?? ""}
            id="merchant-product-return-policy"
            maxLength={2000}
            name="returnPolicy"
            rows={3}
          />
        </div>
        <div className="merchant-form-field is-wide">
          <div className="merchant-field-heading">
            <label>Specifications</label>
            <button
              className="merchant-secondary-action"
              disabled={specifications.length >= 30}
              onClick={() =>
                setSpecifications((current) => [...current, { name: "", value: "" }])
              }
              type="button"
            >
              Add specification
            </button>
          </div>
          <div className="merchant-specification-list">
            {specifications.map((specification, index) => (
              <div className="merchant-specification-row" key={index}>
                <input
                  aria-label={`Specification ${index + 1} name`}
                  maxLength={80}
                  onChange={(event) =>
                    setSpecifications((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, name: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Name (e.g. Color)"
                  value={specification.name}
                />
                <input
                  aria-label={`Specification ${index + 1} value`}
                  maxLength={500}
                  onChange={(event) =>
                    setSpecifications((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    )
                  }
                  placeholder="Value"
                  value={specification.value}
                />
                <button
                  aria-label={`Remove specification ${index + 1}`}
                  className="merchant-secondary-action"
                  disabled={specifications.length === 1}
                  onClick={() =>
                    setSpecifications((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  type="button"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
        <fieldset className="merchant-image-source-field">
          <legend>Product photos</legend>
          <div className="merchant-option-row">
            <label>
              <input
                checked={imageSource === "upload"}
                name="imageSource"
                onChange={() => setImageSource("upload")}
                type="radio"
                value="upload"
              />
              Upload photos
            </label>
            <label>
              <input
                checked={imageSource === "url"}
                name="imageSource"
                onChange={() => setImageSource("url")}
                type="radio"
                value="url"
              />
              Use image URL
            </label>
          </div>
          {imageSource === "url" ? (
            <div className="merchant-form-field">
              <label htmlFor="merchant-product-image">Product image URL</label>
              <input
                defaultValue={
                  product?.image?.startsWith("/api/products/images/")
                    ? ""
                    : product?.image ?? ""
                }
                id="merchant-product-image"
                maxLength={2048}
                name="image"
                placeholder="https://images.unsplash.com/…"
                required
                type="url"
              />
              <small>Use a secure image URL from images.unsplash.com.</small>
            </div>
          ) : (
            <div className="merchant-form-field">
              <label htmlFor="merchant-product-images">Upload product photos</label>
              <input
                accept="image/jpeg,image/png,image/webp"
                id="merchant-product-images"
                multiple
                name="imageFiles"
                onChange={(event) => {
                  const count = event.target.files?.length ?? 0;
                  if (count > maxProductImageCount) {
                    event.target.value = "";
                    setSelectedImageCount(0);
                    setError(`Upload no more than ${maxProductImageCount} photos.`);
                    return;
                  }
                  setError("");
                  setSelectedImageCount(count);
                }}
                required={!editing && imageSource === "upload"}
                type="file"
              />
              <small>
                JPEG, PNG, or WebP; up to {maxProductImageCount} photos and 5 MB each.
                {editing ? " Leave empty to keep the current photos." : ""}
              </small>
              {selectedImageCount > 0 && (
                <small>{selectedImageCount} new photo(s) selected.</small>
              )}
              {product?.images?.length ? (
                <div className="merchant-product-image-previews">
                  {product.images.map((image) => (
                    <Image
                      alt=""
                      height={72}
                      key={image.id}
                      src={`/api/products/images/${image.id}`}
                      unoptimized
                      width={72}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          )}
        </fieldset>
        <fieldset className="merchant-publication-field">
          <legend>Listing status</legend>
          <label>
            <input
              checked={publicationMode === "draft"}
              name="publicationMode"
              onChange={() => setPublicationMode("draft")}
              type="radio"
              value="draft"
            />
            Save as draft
          </label>
          <label>
            <input
              checked={publicationMode === "review"}
              name="publicationMode"
              onChange={() => setPublicationMode("review")}
              type="radio"
              value="review"
            />
            Submit for review
          </label>
          <label>
            <input
              checked={publicationMode === "schedule"}
              name="publicationMode"
              onChange={() => setPublicationMode("schedule")}
              type="radio"
              value="schedule"
            />
            Schedule publication
          </label>
          {publicationMode === "schedule" && (
            <div className="merchant-form-field">
              <label htmlFor="merchant-product-scheduled-at">Publish at</label>
              <input
                defaultValue={toLocalDateTimeValue(product?.scheduledAt)}
                id="merchant-product-scheduled-at"
                name="scheduledAt"
                required
                type="datetime-local"
              />
              <small>
                Scheduled products remain hidden until approved by a super admin and
                the scheduled time arrives.
              </small>
            </div>
          )}
        </fieldset>
      </div>

      {editing && (
        <div className="merchant-info-banner" role="note">
          Saving as a draft keeps the listing private. Review and scheduled listings
          stay hidden until a super admin approves them.
        </div>
      )}

      <div className="merchant-form-footer">
        {error && <p aria-live="polite" className="merchant-form-error">{error}</p>}
        {notice && <p aria-live="polite" className="merchant-form-success">{notice}</p>}
        <Link className="merchant-secondary-action" href="/merchant/products">
          Cancel
        </Link>
        <button className="merchant-primary-action" disabled={busy} type="submit">
          {busy ? "Saving…" : editing ? "Save changes" : "Create product"}
        </button>
      </div>
    </form>
  );
}
