"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Eye,
  Heart,
  MapPin,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Star,
} from "lucide-react";
import type { Product } from "@/data/products";
import {
  formatMoney,
  translate,
  translateProduct,
  type Language,
} from "@/lib/marketplace-i18n";

type ProductCardProps = {
  language: Language;
  product: Product;
  onAddToCart: (product: Product) => void;
  onBuyNow: (product: Product) => void;
  onViewProduct: (product: Product) => void;
};

export default function ProductCard({
  language,
  product,
  onAddToCart,
  onBuyNow,
  onViewProduct,
}: ProductCardProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const copy = translateProduct(product, language);
  const isOutOfStock = product.stockQuantity === 0;
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  async function recordView() {
    try {
      await fetch(`/api/products/${encodeURIComponent(product.id)}/view`, {
        method: "POST",
        keepalive: true,
      });
    } catch {
      // Product viewing remains available if analytics recording fails.
    }
  }

  async function toggleFavorite() {
    try {
      const response = await fetch(
        `/api/products/${encodeURIComponent(product.id)}/favorite`,
        { method: "PUT", cache: "no-store" },
      );
      if (!response.ok) return;
      const result = await response.json();
      setIsFavorite(Boolean(result.favorite));
    } catch (error) {
      console.error("Could not update wishlist", error);
    }
  }

  function viewProduct() {
    void recordView();
    onViewProduct(product);
  }

  return (
    <article className="product-card">
      <div className="product-image-wrap">
        <button
          className="product-image-button"
          type="button"
          onClick={viewProduct}
          aria-label={translate(language, "viewProduct").replace(
            "{product}",
            copy.name,
          )}
        >
          <Image
            src={product.image}
            alt={copy.name}
            fill
            sizes="(max-width: 600px) 48vw, (max-width: 1000px) 30vw, 23vw"
            className="product-image"
          />
        </button>
        {copy.badge && <span className="product-badge">{copy.badge}</span>}
        <div className="product-image-actions">
          <button
            className={`favorite-button${isFavorite ? " is-favorite" : ""}`}
            type="button"
            onClick={() => void toggleFavorite()}
            aria-label={
              isFavorite
                ? translate(language, "removeFavorite").replace(
                    "{product}",
                    copy.name,
                  )
                : translate(language, "addFavorite").replace(
                    "{product}",
                    copy.name,
                  )
            }
            aria-pressed={isFavorite}
          >
            <Heart size={17} fill={isFavorite ? "currentColor" : "none"} />
          </button>
          <button
            className="product-view-button"
            type="button"
            onClick={viewProduct}
            aria-label={translate(language, "viewProduct").replace(
              "{product}",
              copy.name,
            )}
          >
            <Eye size={17} />
          </button>
        </div>
      </div>
      <div className="product-info">
        <p className="product-category">{copy.category}</p>
        <button
          className="product-name"
          type="button"
          onClick={viewProduct}
        >
          {copy.name}
        </button>
        <div className="product-recommendation">
          <Sparkles size={12} />
          <span>{t("recommendedForYou")}</span>
        </div>
        <div className="product-rating">
          <Star size={14} fill="currentColor" />
          <span>{product.rating.toFixed(1)}</span>
          <span className="review-count">({product.reviewCount})</span>
        </div>
        <div className="product-seller">
          <MapPin size={13} />
          <span>
            {product.seller} · {product.location}
          </span>
        </div>
        <div className="product-card-bottom">
          <div className="product-prices">
            <strong>{formatMoney(product.price, language)}</strong>
            {product.previousPrice && (
              <del>{formatMoney(product.previousPrice, language)}</del>
            )}
            {product.commissionAmount ? (
              <small className="product-fee-note">
                Platform fee included · {formatMoney(product.commissionAmount, language)}
              </small>
            ) : null}
          </div>
          <div className="product-stock">
            <span className="product-stock-dot" />
            <span>{t(isOutOfStock ? "outOfStock" : "inStock")}</span>
          </div>
          <div className="product-purchase-actions">
            <button
              className="buy-now-button"
              type="button"
              onClick={() => onBuyNow(product)}
              disabled={isOutOfStock}
              aria-label={t("buyNowProduct").replace("{product}", copy.name)}
            >
              <ShoppingBag size={14} />
              <span>{t("buyNow")}</span>
            </button>
            <button
              className="add-to-cart-button"
              type="button"
              onClick={() => onAddToCart(product)}
              disabled={isOutOfStock}
              aria-label={translate(language, "addProduct").replace(
                "{product}",
                copy.name,
              )}
            >
              <ShoppingCart size={15} />
              <span>{t("addToCart")}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
