"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import type { Product } from "@/data/products";
import {
  formatMoney,
  translate,
  translateProduct,
  type Language,
} from "@/lib/marketplace-i18n";

export type CartItem = {
  product: Product;
  quantity: number;
};

type CartDrawerProps = {
  language: Language;
  items: CartItem[];
  cartAdjusted: boolean;
  cartStorageFailed: boolean;
  onClose: () => void;
  onChangeQuantity: (productId: string, change: number) => void;
  onRemove: (productId: string) => void;
};

export default function CartDrawer({
  language,
  items,
  cartAdjusted,
  cartStorageFailed,
  onClose,
  onChangeQuantity,
  onRemove,
}: CartDrawerProps) {
  const subtotal = items.reduce(
    (total, item) => total + item.product.price * item.quantity,
    0,
  );
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <div className="drawer-layer">
      <button
        className="drawer-backdrop"
        type="button"
        onClick={onClose}
        aria-label={t("closeCart")}
      />
      <aside
        className="cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-title"
      >
        <div className="drawer-header">
          <div>
            <p className="eyebrow">{t("cartKicker")}</p>
            <h2 id="cart-title">{t("cartTitle")}</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label={t("closeCart")}
          >
            <X size={20} />
          </button>
        </div>

        {(cartAdjusted || cartStorageFailed) && (
          <div className="cart-notice" role="status">
            {cartAdjusted && <p>{t("cartStorageWarning")}</p>}
            {cartStorageFailed && <p>{t("cartStorageUnavailable")}</p>}
          </div>
        )}

        {items.length === 0 ? (
          <div className="cart-empty">
            <span className="cart-empty-icon">
              <ShoppingBag size={26} />
            </span>
            <h3>{t("emptyCartTitle")}</h3>
            <p>{t("emptyCartBody")}</p>
            <button
              className="button button-primary"
              type="button"
              onClick={onClose}
            >
              {t("browseProducts")}
            </button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(({ product, quantity }) => {
                const copy = translateProduct(product, language);
                const stockLimit = Math.min(
                  product.stockQuantity ?? 100,
                  100,
                );

                return (
                  <article className="cart-item" key={product.id}>
                    <div
                      className="cart-item-image"
                      role="img"
                      aria-label={copy.name}
                      style={{ backgroundImage: `url("${product.image}")` }}
                    />
                    <div className="cart-item-details">
                      <h3>{copy.name}</h3>
                      <p>{formatMoney(product.price, language)}</p>
                      {product.commissionAmount ? (
                        <small className="product-fee-note">
                          Platform fee included · {formatMoney(product.commissionAmount, language)}
                        </small>
                      ) : null}
                      <div className="quantity-control">
                        <button
                          type="button"
                          onClick={() => onChangeQuantity(product.id, -1)}
                          aria-label={t("decreaseQuantity").replace(
                            "{product}",
                            copy.name,
                          )}
                        >
                          <Minus size={14} />
                        </button>
                        <span aria-live="polite">{quantity}</span>
                        <button
                          type="button"
                          disabled={quantity >= stockLimit}
                          onClick={() => onChangeQuantity(product.id, 1)}
                          aria-label={t("increaseQuantity").replace(
                            "{product}",
                            copy.name,
                          )}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                    <button
                      className="remove-item-button"
                      type="button"
                      onClick={() => onRemove(product.id)}
                      aria-label={t("removeProduct").replace(
                        "{product}",
                        copy.name,
                      )}
                    >
                      <Trash2 size={17} />
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="cart-summary">
              <div className="cart-subtotal">
                <span>{t("subtotal")}</span>
                <strong>{formatMoney(subtotal, language)}</strong>
              </div>
              <p>{t("checkoutUnavailable")}</p>
              <Link
                className="button button-primary checkout-button"
                href="/checkout"
                onClick={onClose}
              >
                {t("continueCheckout")}
              </Link>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
