"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Clock3,
  ExternalLink,
  ImagePlus,
  MapPin,
  Store,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import {
  merchantShopCategories,
  type MerchantBusinessHour,
} from "@/lib/merchant-shop";

type MerchantShopProfile = {
  name: string;
  slug: string;
  businessCategory: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  businessAddress: string;
  country: string;
  province: string | null;
  district: string | null;
  sector: string | null;
  cell: string | null;
  village: string | null;
  latitude: number | null;
  longitude: number | null;
  businessHours: MerchantBusinessHour[];
  hasLogo: boolean;
  hasBanner: boolean;
  verificationStatus: "pending" | "approved" | "not_submitted";
  reviewReason: string | null;
  updatedAt: Date;
};

type ShopUpdateResponse = {
  error?: string;
  details?: { fieldErrors?: Record<string, string[]> };
  verificationStatus?: MerchantShopProfile["verificationStatus"];
  reverificationRequested?: boolean;
};

function verificationLabel(status: MerchantShopProfile["verificationStatus"]) {
  if (status === "approved") return "Verified";
  if (status === "pending") return "Under review";
  return "Not submitted";
}

export default function MerchantShopForm({
  profile,
}: {
  profile: MerchantShopProfile;
}) {
  const router = useRouter();
  const [hours, setHours] = useState(profile.businessHours);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("businessHours", JSON.stringify(hours));

    try {
      const response = await fetch("/api/seller/shop", {
        method: "PATCH",
        body: formData,
      });
      const result = (await response.json().catch(() => null)) as
        | ShopUpdateResponse
        | null;

      if (!response.ok) {
        const detail = Object.values(result?.details?.fieldErrors ?? {})
          .flat()
          .find(Boolean);
        throw new Error(detail || result?.error || "Shop details could not be saved.");
      }

      setNotice(
        result?.reverificationRequested
          ? "Shop saved. Your changed business details were sent for verification."
          : "Shop details saved.",
      );
      for (const name of ["logoFile", "bannerFile"]) {
        const fileInput = form.querySelector<HTMLInputElement>(
          `input[name="${name}"]`,
        );
        if (fileInput) fileInput.value = "";
      }
      router.refresh();
    } catch (caught) {
      console.error("Could not save merchant shop", caught);
      setError(
        caught instanceof Error
          ? caught.message
          : "Shop details could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }

  function updateHours(
    index: number,
    update: Partial<MerchantBusinessHour>,
  ) {
    setHours((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...update } : entry,
      ),
    );
  }

  const shopUrl = `/shops/${encodeURIComponent(profile.slug)}`;
  const mediaUrl = (type: "logo" | "banner") =>
    `/api/shops/${encodeURIComponent(profile.slug)}/media?type=${type}&v=${encodeURIComponent(profile.updatedAt.toISOString())}`;

  return (
    <form className="merchant-shop-form" onSubmit={handleSubmit}>
      <section className="merchant-shop-status-panel">
        <div className="merchant-shop-status-icon">
          {profile.verificationStatus === "approved" ? (
            <BadgeCheck aria-hidden="true" size={22} />
          ) : (
            <Store aria-hidden="true" size={22} />
          )}
        </div>
        <div className="merchant-shop-status-copy">
          <span className={`merchant-shop-status is-${profile.verificationStatus}`}>
            {verificationLabel(profile.verificationStatus)}
          </span>
          <h2>{profile.name}</h2>
          <p>
            {profile.verificationStatus === "approved"
              ? "Your business details are verified."
              : profile.verificationStatus === "pending"
                ? "Your business details are being reviewed."
                : "Your shop profile is not yet verified."}
          </p>
          {profile.reviewReason && (
            <p className="merchant-shop-review-reason">{profile.reviewReason}</p>
          )}
        </div>
        <Link
          className="merchant-secondary-action merchant-shop-preview-link"
          href={shopUrl}
          rel="noreferrer"
          target="_blank"
        >
          <ExternalLink aria-hidden="true" size={16} />
          Preview shop
        </Link>
      </section>

      <div className="merchant-shop-section-heading">
        <div>
          <h2>Shop identity</h2>
          <p>These details appear on your public shop page.</p>
        </div>
      </div>
      <div className="merchant-form-grid">
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-name">Shop name</label>
          <input
            autoComplete="organization"
            defaultValue={profile.name}
            id="merchant-shop-name"
            maxLength={160}
            minLength={2}
            name="name"
            required
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-category">Business category</label>
          <select
            defaultValue={profile.businessCategory}
            id="merchant-shop-category"
            name="businessCategory"
            required
          >
            {!merchantShopCategories.some(
              (category) => category === profile.businessCategory,
            ) && (
              <option value={profile.businessCategory}>
                {profile.businessCategory}
              </option>
            )}
            {merchantShopCategories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </div>
        <div className="merchant-form-field merchant-shop-field-full">
          <label htmlFor="merchant-shop-description">Description</label>
          <textarea
            defaultValue={profile.description ?? ""}
            id="merchant-shop-description"
            maxLength={1500}
            name="description"
            rows={4}
          />
        </div>
      </div>

      <div className="merchant-shop-section-heading">
        <div>
          <h2>Logo and cover image</h2>
          <p>Upload a JPEG, PNG, or WebP image up to 5 MB each.</p>
        </div>
      </div>
      <div className="merchant-shop-branding-grid">
        <div className="merchant-shop-image-field">
          <div className="merchant-shop-image-preview is-logo">
            {profile.hasLogo ? (
              <Image
                alt={`${profile.name} logo`}
                fill
                src={mediaUrl("logo")}
                unoptimized
              />
            ) : (
              <Store aria-hidden="true" size={28} />
            )}
          </div>
          <div className="merchant-shop-image-controls">
            <label htmlFor="merchant-shop-logo">Shop logo</label>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="merchant-shop-logo"
              name="logoFile"
              type="file"
            />
            {profile.hasLogo && (
              <label className="merchant-shop-remove-image">
                <input name="removeLogo" type="checkbox" value="true" />
                Remove current logo
              </label>
            )}
          </div>
        </div>
        <div className="merchant-shop-image-field">
          <div className="merchant-shop-image-preview is-banner">
            {profile.hasBanner ? (
              <Image
                alt={`${profile.name} cover`}
                fill
                src={mediaUrl("banner")}
                unoptimized
              />
            ) : (
              <ImagePlus aria-hidden="true" size={28} />
            )}
          </div>
          <div className="merchant-shop-image-controls">
            <label htmlFor="merchant-shop-banner">Cover image</label>
            <input
              accept="image/jpeg,image/png,image/webp"
              id="merchant-shop-banner"
              name="bannerFile"
              type="file"
            />
            {profile.hasBanner && (
              <label className="merchant-shop-remove-image">
                <input name="removeBanner" type="checkbox" value="true" />
                Remove current cover image
              </label>
            )}
          </div>
        </div>
      </div>

      <div className="merchant-shop-section-heading">
        <div>
          <h2>Contact and location</h2>
          <p>Share the best way to reach you and where your shop is located.</p>
        </div>
      </div>
      <div className="merchant-form-grid">
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-phone">Shop phone</label>
          <input
            autoComplete="tel"
            id="merchant-shop-phone"
            maxLength={32}
            name="phone"
            pattern="^\+?[0-9][0-9 ()-]*$"
            type="tel"
            defaultValue={profile.phone ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-email">Shop email</label>
          <input
            autoComplete="email"
            id="merchant-shop-email"
            maxLength={254}
            name="email"
            type="email"
            defaultValue={profile.email ?? ""}
          />
        </div>
        <div className="merchant-form-field merchant-shop-field-full">
          <label htmlFor="merchant-shop-address">Business address</label>
          <input
            autoComplete="street-address"
            id="merchant-shop-address"
            maxLength={500}
            minLength={3}
            name="businessAddress"
            required
            defaultValue={profile.businessAddress}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-country">Country</label>
          <input
            autoComplete="country-name"
            id="merchant-shop-country"
            maxLength={80}
            minLength={2}
            name="country"
            required
            defaultValue={profile.country}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-province">Province</label>
          <input
            id="merchant-shop-province"
            maxLength={120}
            name="province"
            defaultValue={profile.province ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-district">District</label>
          <input
            id="merchant-shop-district"
            maxLength={120}
            name="district"
            defaultValue={profile.district ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-sector">Sector</label>
          <input
            id="merchant-shop-sector"
            maxLength={120}
            name="sector"
            defaultValue={profile.sector ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-cell">Cell</label>
          <input
            id="merchant-shop-cell"
            maxLength={120}
            name="cell"
            defaultValue={profile.cell ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-village">Village</label>
          <input
            id="merchant-shop-village"
            maxLength={120}
            name="village"
            defaultValue={profile.village ?? ""}
          />
        </div>
      </div>

      <div className="merchant-shop-section-heading">
        <div>
          <h2><MapPin aria-hidden="true" size={18} /> Map coordinates</h2>
          <p>Optional. Add both coordinates to show a map link to customers.</p>
        </div>
      </div>
      <div className="merchant-form-grid merchant-shop-coordinate-grid">
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-latitude">Latitude</label>
          <input
            id="merchant-shop-latitude"
            max="90"
            min="-90"
            name="latitude"
            step="any"
            type="number"
            defaultValue={profile.latitude ?? ""}
          />
        </div>
        <div className="merchant-form-field">
          <label htmlFor="merchant-shop-longitude">Longitude</label>
          <input
            id="merchant-shop-longitude"
            max="180"
            min="-180"
            name="longitude"
            step="any"
            type="number"
            defaultValue={profile.longitude ?? ""}
          />
        </div>
      </div>

      <div className="merchant-shop-section-heading">
        <div>
          <h2><Clock3 aria-hidden="true" size={18} /> Business hours</h2>
          <p>Set the opening and closing times customers should see.</p>
        </div>
      </div>
      <div className="merchant-shop-hours">
        {hours.map((entry, index) => (
          <div className="merchant-shop-hour-row" key={entry.day}>
            <strong>{entry.day}</strong>
            <label className="merchant-shop-closed-toggle">
              <input
                checked={entry.closed}
                onChange={(event) =>
                  updateHours(index, { closed: event.target.checked })
                }
                type="checkbox"
              />
              Closed
            </label>
            <label className="merchant-shop-time">
              <span>Opens</span>
              <input
                disabled={entry.closed}
                onChange={(event) => updateHours(index, { open: event.target.value })}
                required={!entry.closed}
                type="time"
                value={entry.open}
              />
            </label>
            <label className="merchant-shop-time">
              <span>Closes</span>
              <input
                disabled={entry.closed}
                onChange={(event) => updateHours(index, { close: event.target.value })}
                required={!entry.closed}
                type="time"
                value={entry.close}
              />
            </label>
          </div>
        ))}
      </div>

      <div className="merchant-shop-form-footer">
        <div aria-live="polite">
          {error && <p className="merchant-form-error">{error}</p>}
          {notice && <p className="merchant-form-success">{notice}</p>}
        </div>
        <button className="merchant-primary-action" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save shop"}
        </button>
      </div>
    </form>
  );
}
