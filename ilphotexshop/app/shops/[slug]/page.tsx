import { Suspense } from "react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BadgeCheck, Clock3, Mail, MapPin, Phone, Store } from "lucide-react";
import { getPublicMerchantShopBySlug } from "@/lib/data-access/merchant-shop";

export const metadata: Metadata = {
  title: "Shop | ILPhotoX Shop",
};

const priceFormat = new Intl.NumberFormat("en-RW", {
  style: "currency",
  currency: "RWF",
  maximumFractionDigits: 0,
});

export default function PublicShopPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="public-shop-loading">Loading shop…</div>}>
      <PublicShopContent params={params} />
    </Suspense>
  );
}

async function PublicShopContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await connection();
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,220}$/.test(slug)) notFound();

  const shop = await getPublicMerchantShopBySlug(slug);
  if (!shop) notFound();

  const address = [
    shop.businessAddress,
    shop.village,
    shop.cell,
    shop.sector,
    shop.district,
    shop.province,
    shop.country,
  ]
    .filter(Boolean)
    .join(", ");
  const mapUrl =
    shop.latitude !== null && shop.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${shop.latitude},${shop.longitude}`
      : null;
  const currentDay = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: "Africa/Kigali",
  }).format(new Date());

  return (
    <main className="public-shop-page">
      <header className="public-shop-topbar">
        <Link aria-label="ILPhotoX Shop home" href="/">
          <Image
            alt=""
            height={38}
            src="/ilphotox-shop-logo.png"
            width={38}
          />
          <strong>ILPhotoX Shop</strong>
        </Link>
        <Link className="public-shop-home-link" href="/">
          Browse marketplace
        </Link>
      </header>

      <section className="public-shop-hero">
        <div className="public-shop-cover">
          {shop.hasBanner ? (
            <Image
              alt={`${shop.name} cover`}
              fill
              priority
              src={`/api/shops/${encodeURIComponent(shop.slug)}/media?type=banner&v=${encodeURIComponent(shop.updatedAt.toISOString())}`}
              unoptimized
            />
          ) : null}
        </div>
        <div className="public-shop-identity">
          <div className="public-shop-logo">
            {shop.hasLogo ? (
              <Image
                alt={`${shop.name} logo`}
                fill
                src={`/api/shops/${encodeURIComponent(shop.slug)}/media?type=logo&v=${encodeURIComponent(shop.updatedAt.toISOString())}`}
                unoptimized
              />
            ) : (
              <Store aria-hidden="true" size={38} />
            )}
          </div>
          <div className="public-shop-title">
            <span className="public-shop-category">{shop.businessCategory}</span>
            <h1>{shop.name}</h1>
            {shop.verificationStatus === "approved" && (
              <span className="public-shop-verified">
                <BadgeCheck aria-hidden="true" size={15} /> Verified business
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="public-shop-content">
        <section className="public-shop-products">
          <div className="public-shop-section-heading">
            <div>
              <h2>Products</h2>
              <p>Showing {shop.products.length} published products</p>
            </div>
          </div>
          {shop.products.length ? (
            <div className="public-shop-product-grid">
              {shop.products.map((product) => (
                <article className="public-shop-product-card" key={product.id}>
                  <div className="public-shop-product-image">
                    <Image
                      alt={product.name}
                      fill
                      src={product.image}
                      unoptimized
                    />
                  </div>
                  <div className="public-shop-product-copy">
                    <span>{product.categoryInfo.name}</span>
                    <h3>{product.name}</h3>
                    <strong>{priceFormat.format(product.price)}</strong>
                    {product.previousPrice !== null &&
                      product.previousPrice > product.price && (
                        <del>{priceFormat.format(product.previousPrice)}</del>
                      )}
                    <small>
                      {product.stockQuantity > 0 ? "In stock" : "Out of stock"}
                    </small>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="public-shop-empty">
              <Store aria-hidden="true" size={28} />
              <strong>No published products yet</strong>
              <span>Check back later to see what this shop has to offer.</span>
            </div>
          )}
        </section>

        <aside className="public-shop-details">
          {shop.description && (
            <section className="public-shop-detail-card">
              <h2>About this shop</h2>
              <p>{shop.description}</p>
            </section>
          )}
          <section className="public-shop-detail-card">
            <h2>Contact and location</h2>
            {shop.phone && (
              <a href={`tel:${shop.phone}`}>
                <Phone aria-hidden="true" size={16} />
                {shop.phone}
              </a>
            )}
            {shop.email && (
              <a href={`mailto:${shop.email}`}>
                <Mail aria-hidden="true" size={16} />
                {shop.email}
              </a>
            )}
            <p>
              <MapPin aria-hidden="true" size={16} />
              {address}
            </p>
            {mapUrl && (
              <a href={mapUrl} rel="noreferrer" target="_blank">
                Open map
              </a>
            )}
          </section>
          <section className="public-shop-detail-card">
            <h2><Clock3 aria-hidden="true" size={17} /> Business hours</h2>
            <ul className="public-shop-hours">
              {shop.businessHours.map((entry) => (
                <li
                  className={entry.day === currentDay ? "is-today" : ""}
                  key={entry.day}
                >
                  <span>{entry.day}</span>
                  <span>
                    {entry.closed ? "Closed" : `${entry.open} – ${entry.close}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
      <footer className="public-shop-footer">
        <Link href="/">ILPhotoX Shop</Link>
        <span>Shop directly from local businesses.</span>
      </footer>
    </main>
  );
}
