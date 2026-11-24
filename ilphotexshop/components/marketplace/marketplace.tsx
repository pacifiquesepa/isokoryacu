"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import {
  ArrowDownWideNarrow,
  ArrowRight,
  KeyRound,
  LayoutGrid,
  Check,
  ChevronDown,
  Headphones,
  MapPin,
  Moon,
  Phone,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  Tag,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import CartDrawer, { type CartItem } from "@/components/marketplace/cart-drawer";
import SupportWidget from "@/components/marketplace/support-widget";
import LanguageSelector from "@/components/marketplace/language-selector";
import ProductCard from "@/components/marketplace/product-card";
import type { Product } from "@/data/products";
import {
  formatMoney,
  translate,
  translateProduct,
  type CategoryFilter,
  type Language,
} from "@/lib/marketplace-i18n";
import {
  getMarketplaceLanguageSnapshot,
  getServerMarketplaceLanguageSnapshot,
  setMarketplaceLanguage,
  subscribeToMarketplaceLanguage,
} from "@/lib/marketplace-language";

type MarketplaceProps = {
  products: Product[];
  categories: { slug: string; name: string }[];
  userRole: UserRole | null;
  announcementSlot?: ReactNode;
  marketing?: {
    banners: {
      id: string;
      title: string;
      subtitle: string | null;
      imageUrl: string;
      hrefUrl: string | null;
      position: number;
    }[];
    merchants: { id: string; name: string; position: number }[];
  };
};

type ColorMode = "light" | "dark";

const colorModeStorageKey = "ilphotox-color-mode";
const colorModeChangeEvent = "ilphotox-color-mode-change";
const cartStorageKey = "ilphotox-cart";

function subscribeToColorMode(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(colorModeChangeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(colorModeChangeEvent, onChange);
  };
}

function getColorModeSnapshot(): ColorMode {
  return window.localStorage.getItem(colorModeStorageKey) === "dark"
    ? "dark"
    : "light";
}

function getServerColorModeSnapshot(): ColorMode {
  return "light";
}

export default function Marketplace({
  products,
  categories: productCategories,
  userRole,
  announcementSlot,
  marketing,
}: MarketplaceProps) {
  const router = useRouter();
  const language = useSyncExternalStore(
    subscribeToMarketplaceLanguage,
    getMarketplaceLanguageSnapshot,
    getServerMarketplaceLanguageSnapshot,
  );
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [sortOrder, setSortOrder] = useState("recommended");
  const [dealsOnly, setDealsOnly] = useState(false);
  const [popularStartIndex, setPopularStartIndex] = useState(0);
  const colorMode = useSyncExternalStore(
    subscribeToColorMode,
    getColorModeSnapshot,
    getServerColorModeSnapshot,
  );
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [cartHydrated, setCartHydrated] = useState(false);
  const [cartAdjusted, setCartAdjusted] = useState(false);
  const [cartStorageFailed, setCartStorageFailed] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const defaultCategoryMessages: Partial<
    Record<string, Parameters<typeof translate>[1]>
  > = {
    technology: "categoryTechnology",
    fashion: "categoryFashion",
    home: "categoryHome",
    beauty: "categoryBeauty",
  };
  const categories = [
    { key: "all" as const, label: t("categoryAll") },
    ...productCategories.map(({ slug, name }) => ({
      key: slug,
      label: defaultCategoryMessages[slug]
        ? t(defaultCategoryMessages[slug]!)
        : name,
    })),
  ];
  const selectedProductImages = selectedProduct
    ? selectedProduct.images?.length
      ? [...selectedProduct.images]
          .sort((left, right) => left.sortOrder - right.sortOrder)
          .map((image) => `/api/products/images/${image.id}`)
      : [selectedProduct.image]
    : [];

  function viewProduct(product: Product) {
    setSelectedImageIndex(0);
    setSelectedProduct(product);
  }

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    document.documentElement.dataset.theme = colorMode;
  }, [colorMode]);

  useEffect(() => {
    try {
      const savedCart = window.localStorage.getItem(cartStorageKey);
      if (savedCart) {
        const parsed: unknown = JSON.parse(savedCart);
        const availableProducts = new Map(
          products.map((product) => [product.id, product]),
        );
        let adjusted = false;
        const restoredItems: CartItem[] = [];

        if (Array.isArray(parsed)) {
          for (const entry of parsed) {
            if (
              !entry ||
              typeof entry !== "object" ||
              !("productId" in entry) ||
              !("quantity" in entry) ||
              typeof entry.productId !== "string" ||
              typeof entry.quantity !== "number" ||
              !Number.isInteger(entry.quantity) ||
              entry.quantity < 1
            ) {
              adjusted = true;
              continue;
            }

            const product = availableProducts.get(entry.productId);
            if (!product) {
              adjusted = true;
              continue;
            }
            const stockLimit = Math.min(product.stockQuantity ?? 100, 100);
            if (stockLimit < 1) {
              adjusted = true;
              continue;
            }
            const quantity = Math.min(entry.quantity, stockLimit);
            if (quantity !== entry.quantity) adjusted = true;
            restoredItems.push({ product, quantity });
          }
        } else {
          adjusted = true;
        }

        // Read browser-only cart data after mount to keep server and client markup aligned.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCartItems(restoredItems);
        setCartAdjusted(adjusted);
      }
      if (new URLSearchParams(window.location.search).get("checkout") === "1") {
        setIsCartOpen(true);
      }
    } catch (error) {
      console.error("Failed to restore the saved cart", error);
      setCartStorageFailed(true);
    } finally {
      setCartHydrated(true);
    }
  }, [products]);

  useEffect(() => {
    if (!cartHydrated) return;
    try {
      window.localStorage.setItem(
        cartStorageKey,
        JSON.stringify(
          cartItems.map(({ product, quantity }) => ({
            productId: product.id,
            quantity,
          })),
        ),
      );
    } catch (error) {
      console.error("Failed to save the cart", error);
      // Surface a failed browser-storage sync in the cart UI.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCartStorageFailed(true);
    }
  }, [cartHydrated, cartItems]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = products.filter((product) => {
      const copy = translateProduct(product, language);
      const matchesCategory =
        activeCategory === "all" || product.category === activeCategory;
      const matchesDeal = !dealsOnly || Boolean(product.previousPrice);
      const searchableText =
        `${copy.name} ${copy.category} ${product.name} ${product.seller} ${product.location}`.toLocaleLowerCase();
      return (
        matchesCategory &&
        matchesDeal &&
        (!query || searchableText.includes(query))
      );
    });

    if (sortOrder === "price-low") {
      return [...filtered].sort((a, b) => a.price - b.price);
    }
    if (sortOrder === "price-high") {
      return [...filtered].sort((a, b) => b.price - a.price);
    }
    if (sortOrder === "rating") {
      return [...filtered].sort((a, b) => b.rating - a.rating);
    }
    return filtered;
  }, [activeCategory, dealsOnly, language, products, search, sortOrder]);

  const popularProducts = useMemo(
    () =>
      products.some((product) => product.isFeatured)
        ? products.filter((product) => product.isFeatured)
        : [...products].sort(
            (first, second) => second.reviewCount - first.reviewCount,
          ),
    [products],
  );

  useEffect(() => {
    if (popularProducts.length <= 4) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setPopularStartIndex(
        (currentIndex) => (currentIndex + 1) % popularProducts.length,
      );
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [popularProducts.length]);

  const visiblePopularProducts = useMemo(
    () =>
      Array.from(
        { length: Math.min(4, popularProducts.length) },
        (_, index) =>
          popularProducts[
            (popularStartIndex + index) % popularProducts.length
          ],
      ),
    [popularProducts, popularStartIndex],
  );

  const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0);

  function updateCartItems(updater: (items: CartItem[]) => CartItem[]) {
    setCartStorageFailed(false);
    setCartItems(updater);
  }

  function changeLanguage(nextLanguage: Language) {
    setMarketplaceLanguage(nextLanguage);
  }

  function addToCart(product: Product) {
    const stockLimit = Math.min(product.stockQuantity ?? 100, 100);
    if (stockLimit < 1) return;
    updateCartItems((currentItems) => {
      const existing = currentItems.find((item) => item.product.id === product.id);
      if (existing) {
        return currentItems.map((item) =>
          item.product.id === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, stockLimit),
              }
            : item,
        );
      }
      return [...currentItems, { product, quantity: 1 }];
    });
  }

  function buyNow(product: Product) {
    addToCart(product);
    const existing = cartItems.find((item) => item.product.id === product.id);
    const quantity = existing
      ? Math.min(existing.quantity + 1, Math.min(product.stockQuantity ?? 100, 100))
      : 1;
    const nextCart = existing
      ? cartItems.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity }
            : item,
        )
      : [...cartItems, { product, quantity }];
    window.localStorage.setItem(
      cartStorageKey,
      JSON.stringify(
        nextCart.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
        })),
      ),
    );
    router.push("/checkout");
  }

  function changeQuantity(productId: string, change: number) {
    updateCartItems((currentItems) =>
      currentItems
        .map((item) =>
          item.product.id === productId
            ? {
                ...item,
                quantity: Math.min(
                  Math.min(item.product.stockQuantity ?? 100, 100),
                  item.quantity + change,
                ),
              }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  function toggleColorMode() {
    const nextMode = colorMode === "light" ? "dark" : "light";
    window.localStorage.setItem(colorModeStorageKey, nextMode);
    window.dispatchEvent(new Event(colorModeChangeEvent));
  }

  return (
    <main className="marketplace">
      <div className="site-topbar">
        <div className="topbar-inner content-width header-content-width">
          <div className="topbar-contact">
            <span>
              <MapPin size={14} /> {t("location")}
            </span>
            <a href="tel:0788390989" aria-label={`${t("contact")}: 0788390989`}>
              <Phone size={14} /> 0788390989
            </a>
          </div>
          <div className="topbar-right">
            <LanguageSelector language={language} onChange={changeLanguage} />
            <span className="currency-badge" aria-label={t("currency")}>
              RWF
            </span>
            <nav className="utility-nav" aria-label={t("navigation")}>
              <a href="#about">{t("about")}</a>
              <a href="#ubufasha">{t("sellWithUs")}</a>
              <a href="tel:0788390989">{t("contact")}</a>
            </nav>
          </div>
        </div>
      </div>

      <div className="sticky-store-header sticky top-0 z-20">
        <header className="market-header">
          <div className="header-main-row content-width header-content-width">
            <Link className="brand" href="/" aria-label="ILPhotoX Shop">
              <Image
                src="/ilphotox-shop-logo.png"
                alt="ILPhotoX Shop — Buy, Sell, Grow"
                width={634}
                height={312}
                className="brand-logo-image"
                loading="eager"
              />
            </Link>

            <form
              className="market-search"
              role="search"
              onSubmit={(event) => {
                event.preventDefault();
                scrollTo("ibicuruzwa");
              }}
            >
              <label className="search-category-control">
                <span className="sr-only">{t("searchCategories")}</span>
                <select
                  value={activeCategory}
                  onChange={(event) => {
                    const selectedCategory = categories.find(
                      (category) => category.key === event.target.value,
                    );
                    if (selectedCategory) {
                      setActiveCategory(selectedCategory.key);
                      setDealsOnly(false);
                    }
                  }}
                >
                  {categories.map((category) => (
                    <option key={category.key} value={category.key}>
                      {category.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={15} aria-hidden="true" />
              </label>
              <input
                aria-label={t("searchProducts")}
                type="search"
                placeholder={t("searchPlaceholder")}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button
                className="market-search-button"
                type="submit"
                aria-label={t("searchProducts")}
              >
                <Search size={19} />
                <span>{t("searchAction")}</span>
              </button>
            </form>

            <div className="header-tools">
              <button
                className="color-mode-toggle"
                type="button"
                aria-label={t(
                  colorMode === "light" ? "switchToDarkMode" : "switchToLightMode",
                )}
                title={t(
                  colorMode === "light" ? "switchToDarkMode" : "switchToLightMode",
                )}
                aria-pressed={colorMode === "dark"}
                onClick={toggleColorMode}
              >
                {colorMode === "dark" ? <Sun size={19} /> : <Moon size={19} />}
              </button>
              <div className="header-actions">
                {userRole === "customer" ? (
                  <Link className="account-action" href="/account">
                    <span className="action-icon" aria-hidden="true">
                      <LayoutGrid size={17} />
                    </span>
                    <span className="action-copy">
                      <strong>{t("myAccount")}</strong>
                    </span>
                  </Link>
                ) : userRole === "seller" ? (
                  <Link className="account-action" href="/merchant/dashboard">
                    <span className="action-icon" aria-hidden="true">
                      <Store size={17} />
                    </span>
                    <span className="action-copy">
                      <strong>{t("merchantWorkspace")}</strong>
                    </span>
                  </Link>
                ) : userRole === "super_admin" ? (
                  <Link className="account-action" href="/super-admin/dashboard">
                    <span className="action-icon" aria-hidden="true">
                      <ShieldCheck size={17} />
                    </span>
                    <span className="action-copy">
                      <strong>{t("adminWorkspace")}</strong>
                    </span>
                  </Link>
                ) : userRole === "admin" ? (
                  <span className="account-action">
                    <span className="action-icon" aria-hidden="true">
                      <ShieldCheck size={17} />
                    </span>
                    <span className="action-copy">
                      <strong>{t("administrator")}</strong>
                    </span>
                  </span>
                ) : (
                  <>
                    <Link
                      className="account-action"
                      href="/login"
                      aria-label={t("signIn")}
                    >
                      <span className="action-icon" aria-hidden="true">
                        <KeyRound size={17} />
                      </span>
                      <span className="action-copy">
                        <strong>{t("signIn")}</strong>
                        <small>{t("loginHint")}</small>
                      </span>
                    </Link>
                    <Link
                      className="register-action"
                      href="/register"
                      aria-label={t("register")}
                    >
                      <span className="action-icon" aria-hidden="true">
                        <UserPlus size={17} />
                      </span>
                      <span className="action-copy">
                        <strong>{t("register")}</strong>
                        <small>{t("joinFree")}</small>
                      </span>
                    </Link>
                  </>
                )}
                <button
                  className="cart-button"
                  type="button"
                  onClick={() => router.push("/checkout")}
                  aria-label={t("cartAria").replace("{count}", String(cartCount))}
                >
                  <ShoppingBag size={19} />
                  <span className="cart-label">{t("cart")}</span>
                  <span className="cart-count" aria-live="polite">
                    <span className="cart-count-number">{cartCount}</span>
                    {" "}
                    <span className="cart-count-label">
                      {t(
                        cartCount === 1
                          ? "cartOneItemLabel"
                          : "cartManyItemsLabel",
                      )}
                    </span>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </header>

        <nav className="bottom-nav" aria-label={t("navigation")}>
          <div className="bottom-nav-inner content-width header-content-width">
            <a
              className={`bottom-nav-link${dealsOnly ? "" : " active"}`}
              href="#ibicuruzwa"
            >
              <Store size={17} /> {t("shopNav")}
            </a>
            <a className="bottom-nav-link" href="#ibyiciro">
              <LayoutGrid size={17} /> {t("categories")}
            </a>
            <a className="bottom-nav-link" href="#ubufasha">
              <UserPlus size={17} /> {t("sellNav")}
            </a>
            <button
              className={`bottom-nav-link${dealsOnly ? " active" : ""}`}
              type="button"
              onClick={() => {
                setDealsOnly((current) => !current);
                setActiveCategory("all");
                scrollTo("ibicuruzwa");
              }}
              aria-pressed={dealsOnly}
            >
              <Tag size={16} /> {t("hotDealsNav")}
            </button>
            <a className="bottom-nav-link" href="tel:0788390989">
              <Headphones size={17} /> {t("supportNav")}
            </a>
          </div>
        </nav>
      </div>

      {announcementSlot}

      {marketing?.banners.length ? (
        <section className="content-width" aria-label="Featured promotions">
          {marketing.banners.map((banner) => (
            banner.hrefUrl ? (
              <a className="storefront-marketing-banner" href={banner.hrefUrl} key={banner.id}>
                <Image alt="" height={240} src={banner.imageUrl} unoptimized width={1200} />
                <span><strong>{banner.title}</strong>{banner.subtitle && <small>{banner.subtitle}</small>}</span>
              </a>
            ) : (
              <article className="storefront-marketing-banner" key={banner.id}>
                <Image alt="" height={240} src={banner.imageUrl} unoptimized width={1200} />
                <span><strong>{banner.title}</strong>{banner.subtitle && <small>{banner.subtitle}</small>}</span>
              </article>
            )
          ))}
        </section>
      ) : null}

      {marketing?.merchants.length ? (
        <section className="merchant-featured-strip content-width" aria-label="Featured merchants">
          <strong>Featured merchants</strong>
          <div>
            {marketing.merchants.map((merchant) => (
              <Link href="/our-market" key={merchant.id}>{merchant.name}</Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="hero-section">
        <div className="hero-copy">
          <div className="hero-popular-card">
            <div className="hero-popular-header">
              <h1>{t("featuredProducts")}</h1>
              <a
                className="hero-popular-more"
                href="#ibicuruzwa"
                aria-label={t("viewAll")}
              >
                <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <div className="hero-popular-grid">
              {visiblePopularProducts.map((product) => {
                const copy = translateProduct(product, language);
                return (
                  <a
                    className="hero-popular-item"
                    href="#ibicuruzwa"
                    key={product.id}
                  >
                    <span className="hero-popular-image-wrap">
                      <Image
                        src={product.image}
                        alt=""
                        width={220}
                        height={170}
                        sizes="(max-width: 760px) 40vw, 180px"
                        className="hero-popular-image"
                      />
                    </span>
                    <span>{copy.name}</span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-label={t("heroImage")} role="img">
          <div className="hero-photo hero-photo-main" />
          <div className="hero-photo hero-photo-small" />
          <div className="hero-floating-card">
            <span className="floating-icon">
              <Check size={17} />
            </span>
            <span>
              <strong>{t("shopWithConfidence")}</strong>
              <small>{t("localProducts")}</small>
            </span>
          </div>
          <div className="hero-sparkle sparkle-one">✳</div>
          <div className="hero-sparkle sparkle-two">✦</div>
        </div>
      </section>

      <section className="products-section content-width" id="ibicuruzwa">
        <div className="section-heading product-heading">
          <div>
            <h2>{t("featuredProducts")}</h2>
          </div>
          <label className="sort-control">
            <ArrowDownWideNarrow size={16} />
            <span className="sr-only">{t("sortProducts")}</span>
            <select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              aria-label={t("sortProducts")}
            >
              <option value="recommended">{t("sortRecommended")}</option>
              <option value="price-low">{t("sortPriceLow")}</option>
              <option value="price-high">{t("sortPriceHigh")}</option>
              <option value="rating">{t("sortRating")}</option>
            </select>
            <ChevronDown size={15} />
          </label>
        </div>
        <div className="product-toolbar" id="ibyiciro">
          <div className="product-filter-row">
            {categories.map(({ key, label }) => (
              <button
                className={`filter-chip${activeCategory === key ? " selected" : ""}`}
                key={key}
                type="button"
                onClick={() => {
                  setActiveCategory(key);
                  setDealsOnly(false);
                }}
                aria-pressed={activeCategory === key}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="result-count">
            {t(
              filteredProducts.length === 1
                ? "resultCountSingular"
                : "resultCountPlural",
            ).replace("{count}", String(filteredProducts.length))}
          </span>
        </div>
        {filteredProducts.length > 0 ? (
          <div className="product-grid">
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                language={language}
                product={product}
                onAddToCart={addToCart}
                onBuyNow={buyNow}
                onViewProduct={viewProduct}
              />
            ))}
          </div>
        ) : (
          <div className="no-results">
            <span className="no-results-icon">
              <Search size={23} />
            </span>
            <h3>{t("noResultsTitle")}</h3>
            <p>{t("noResultsBody")}</p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                setSearch("");
                setActiveCategory("all");
              }}
            >
              {t("clearFilters")}
            </button>
          </div>
        )}
      </section>

      <section className="merchant-banner content-width" id="ubufasha">
        <div className="merchant-banner-copy">
          <span className="merchant-label">{t("merchantKicker")}</span>
          <h2>{t("merchantHeadline")}</h2>
          <p>{t("merchantBody")}</p>
        </div>
        <span className="merchant-decoration" aria-hidden="true">
          <ShoppingBag size={54} />
        </span>
        <Link className="button button-light" href="/apply-to-sell">
          {t("merchantApply")} <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="market-footer" id="about">
        <div className="footer-main content-width">
          <div className="footer-brand">
            <Link className="brand brand-light" href="/" aria-label="ILPhotoX Shop">
              <Image
                src="/ilphotox-shop-logo.png"
                alt="ILPhotoX Shop — Buy, Sell, Grow"
                width={634}
                height={312}
                className="brand-logo-image brand-logo-footer"
              />
            </Link>
            <p>{t("footerDescription")}</p>
          </div>
          <div className="footer-links">
            <strong>{t("footerHelp")}</strong>
            <a href="#ubufasha">{t("footerHelpInfo")}</a>
            <a href="#ibicuruzwa">{t("products")}</a>
            <a href="#ibyiciro">{t("categories")}</a>
          </div>
          <div className="footer-contact">
            <strong>{t("supportTitle")}</strong>
            <a href="tel:0788390989">{t("supportDescription")}</a>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="content-width footer-bottom-inner">
            <span>{t("footerRights")}</span>
            <span>
              {t("madeInRwanda")} <span className="footer-heart">♥</span>
            </span>
          </div>
        </div>
      </footer>

      {isCartOpen && (
        <CartDrawer
          language={language}
          items={cartItems}
          cartAdjusted={cartAdjusted}
          cartStorageFailed={cartStorageFailed}
          onClose={() => setIsCartOpen(false)}
          onChangeQuantity={changeQuantity}
          onRemove={(productId) =>
            updateCartItems((currentItems) =>
              currentItems.filter((item) => item.product.id !== productId),
            )
          }
        />
      )}

      {selectedProduct && (
        <div
          className="modal-layer"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedProduct(null);
          }}
        >
          <section
            className="product-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
          >
            <button
              className="icon-button modal-close"
              type="button"
              onClick={() => setSelectedProduct(null)}
              aria-label={t("closeProductDetails")}
            >
              <X size={20} />
            </button>
            <div className="modal-product-media">
              <div
                className="modal-product-image"
                role="img"
                aria-label={translateProduct(selectedProduct, language).name}
                style={{
                  backgroundImage: `url("${selectedProductImages[selectedImageIndex] ?? selectedProduct.image}")`,
                }}
              />
              {selectedProductImages.length > 1 && (
                <div aria-label={t("productGallery")} className="modal-product-gallery">
                  {selectedProductImages.map((image, index) => (
                    <button
                      aria-label={`${t("productGallery")} ${index + 1}`}
                      aria-pressed={selectedImageIndex === index}
                      className={selectedImageIndex === index ? "is-selected" : ""}
                      key={image}
                      onClick={() => setSelectedImageIndex(index)}
                      style={{ backgroundImage: `url("${image}")` }}
                      type="button"
                    />
                  ))}
                </div>
              )}
            </div>
            <div className="modal-product-info">
              <p className="eyebrow">
                {translateProduct(selectedProduct, language).category}
              </p>
              <h2 id="product-modal-title">
                {translateProduct(selectedProduct, language).name}
              </h2>
              <p className="modal-seller">
                {t("productSeller")
                  .replace("{seller}", selectedProduct.seller)
                  .replace("{location}", selectedProduct.location)}
              </p>
              <p className="modal-rating">
                <span>★</span> {selectedProduct.rating.toFixed(1)} (
                {t("reviewCount").replace(
                  "{count}",
                  String(selectedProduct.reviewCount),
                )}
                )
              </p>
              <strong className="modal-price">
                {formatMoney(selectedProduct.price, language)}
              </strong>
              {selectedProduct.commissionAmount ? (
                <small className="product-fee-note">
                  Platform fee included · {formatMoney(selectedProduct.commissionAmount, language)}
                </small>
              ) : null}
              <p className="modal-description">
                {selectedProduct.description || t("productDescription")}
              </p>
              {(selectedProduct.brand || selectedProduct.sku) && (
                <dl className="modal-product-meta">
                  {selectedProduct.brand && (
                    <div><dt>{t("productBrand")}</dt><dd>{selectedProduct.brand}</dd></div>
                  )}
                  {selectedProduct.sku && (
                    <div><dt>{t("productSku")}</dt><dd>{selectedProduct.sku}</dd></div>
                  )}
                  {selectedProduct.subcategory && (
                    <div><dt>{t("productSubcategory")}</dt><dd>{selectedProduct.subcategory}</dd></div>
                  )}
                </dl>
              )}
              {selectedProduct.specifications?.length ? (
                <section className="modal-product-extra">
                  <h3>{t("productSpecifications")}</h3>
                  <dl>
                    {selectedProduct.specifications.map((specification) => (
                      <div key={`${specification.name}-${specification.value}`}>
                        <dt>{specification.name}</dt>
                        <dd>{specification.value}</dd>
                      </div>
                    ))}
                  </dl>
                </section>
              ) : null}
              {selectedProduct.warranty && (
                <section className="modal-product-extra">
                  <h3>{t("productWarranty")}</h3>
                  <p>{selectedProduct.warranty}</p>
                </section>
              )}
              {selectedProduct.returnPolicy && (
                <section className="modal-product-extra">
                  <h3>{t("productReturnPolicy")}</h3>
                  <p>{selectedProduct.returnPolicy}</p>
                </section>
              )}
              <button
                className="button button-primary modal-add-button"
                type="button"
                onClick={() => {
                  addToCart(selectedProduct);
                  setSelectedProduct(null);
                  setIsCartOpen(true);
                }}
              >
                <ShoppingBag size={17} /> {t("addProduct").replace(
                  "{product}",
                  translateProduct(selectedProduct, language).name,
                )}
              </button>
            </div>
          </section>
        </div>
      )}
      <SupportWidget
        cartCount={cartCount}
        language={language}
        onOpenCart={() => setIsCartOpen(true)}
      />
    </main>
  );
}
