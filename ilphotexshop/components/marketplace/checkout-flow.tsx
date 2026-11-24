"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Headphones,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  ReceiptText,
  ShoppingBag,
  Truck,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import type { Product } from "@/data/products";
import LanguageSelector from "@/components/marketplace/language-selector";
import { checkoutMessage } from "@/lib/checkout-i18n";
import {
  getMarketplaceLanguageSnapshot,
  getServerMarketplaceLanguageSnapshot,
  setMarketplaceLanguage,
  subscribeToMarketplaceLanguage,
} from "@/lib/marketplace-language";

type CheckoutProduct = Product & {
  ownerId?: string | null;
  owner?: { phone: string | null } | null;
};

type CartEntry = { productId: string; quantity: number };
type CheckoutItem = { product: CheckoutProduct; quantity: number };
type DeliveryZone = "kigali" | "outside_kigali" | "international";

type PaymentAccount = {
  id: string;
  type: "bank" | "mobile_money";
  provider: string;
  accountName: string;
  accountNumber: string;
  currency: string;
};

type DeliverySettings = {
  deliveryFeeRwf: number;
  etaKigali: string;
  etaOutsideKigali: string;
  etaInternational: string;
};

export default function CheckoutFlow({
  accounts,
  customerName,
  userRole,
  deliverySettings,
}: {
  accounts: PaymentAccount[];
  customerName: string;
  userRole: UserRole | null;
  deliverySettings: DeliverySettings;
}) {
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [loading, setLoading] = useState(true);
  const language = useSyncExternalStore(
    subscribeToMarketplaceLanguage,
    getMarketplaceLanguageSnapshot,
    getServerMarketplaceLanguageSnapshot,
  );
  const [fulfillment, setFulfillment] = useState<"delivery" | "pickup">("delivery");
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone>("kigali");
  const [fulfillmentComplete, setFulfillmentComplete] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<"receipt" | "cod">(
    accounts.length ? "receipt" : "cod",
  );
  const [paymentMethod, setPaymentMethod] = useState<"bank_transfer" | "mobile_money">(
    accounts.some((account) => account.type === "mobile_money")
      ? "mobile_money"
      : "bank_transfer",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [receiptSubmitted, setReceiptSubmitted] = useState(false);
  const [receiptError, setReceiptError] = useState(false);
  const [notificationWarning, setNotificationWarning] = useState(false);
  const [merchantMessage, setMerchantMessage] = useState("");
  const [merchantSubject, setMerchantSubject] = useState("");
  const [merchantNotice, setMerchantNotice] = useState("");
  const idempotencyRequest = useRef<{ fingerprint: string; key: string } | null>(
    null,
  );
  const isCustomer = userRole === "customer";
  const router = useRouter();
  const t = (key: Parameters<typeof checkoutMessage>[1]) =>
    checkoutMessage(language, key);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    let active = true;
    async function loadCart() {
      try {
        const saved = localStorage.getItem("ilphotox-cart");
        const entries: unknown = saved ? JSON.parse(saved) : [];
        if (!Array.isArray(entries)) throw new Error("Invalid cart");
        const validEntries = entries.filter(
          (entry): entry is CartEntry =>
            Boolean(entry) &&
            typeof entry === "object" &&
            typeof entry.productId === "string" &&
            typeof entry.quantity === "number" &&
            Number.isInteger(entry.quantity) &&
            entry.quantity > 0,
        );
        const response = await fetch("/api/products?limit=100&offset=0", {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Catalog could not be loaded");
        const payload = (await response.json()) as { products: CheckoutProduct[] };
        const productsById = new Map(
          payload.products.map((product) => [product.id, product]),
        );
        if (!active) return;
        setItems(
          validEntries
            .map((entry) => {
              const product = productsById.get(entry.productId);
              if (!product) return null;
              return {
                product,
                quantity: Math.min(entry.quantity, product.stockQuantity ?? 100),
              };
            })
            .filter((item): item is CheckoutItem => Boolean(item)),
        );
      } catch (caught) {
        if (active) {
          console.error("Could not load the checkout cart", caught);
          setError(
            caught instanceof Error
              ? caught.message
              : "Your cart could not be loaded.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCart();
    return () => {
      active = false;
    };
  }, []);

  const subtotal = useMemo(
    () =>
      items.reduce(
        (total, item) => total + item.product.price * item.quantity,
        0,
      ),
    [items],
  );
  const deliveryFee =
    fulfillment === "delivery" ? deliverySettings.deliveryFeeRwf : 0;
  const total = subtotal + deliveryFee;
  const estimatedDelivery =
    deliveryZone === "kigali"
      ? deliverySettings.etaKigali
      : deliveryZone === "international"
        ? deliverySettings.etaInternational
        : deliverySettings.etaOutsideKigali;
  const numberLocale =
    language === "fr" ? "fr-RW" : language === "rw" ? "rw-RW" : "en-RW";
  const formatMoney = (amount: number) =>
    `${new Intl.NumberFormat(numberLocale).format(amount)} RWF`;

  function completeFulfillment() {
    setError("");
    const form = document.querySelector<HTMLFormElement>(".checkout-main");
    if (!form) return;
    const name = form.elements.namedItem("deliveryName") as HTMLInputElement | null;
    const phone = form.elements.namedItem("deliveryPhone") as HTMLInputElement | null;
    const address = form.elements.namedItem("deliveryAddress") as HTMLTextAreaElement | null;
    const pickupLocation = form.elements.namedItem("pickupLocation") as HTMLInputElement | null;

    if (!name || name.value.trim().length < 2) {
      setError(t("invalidName"));
      name?.focus();
      return;
    }
    const phoneDigits = phone?.value.replace(/\D/g, "") ?? "";
    if (!phone || phoneDigits.length < 7 || phoneDigits.length > 15) {
      setError(t("invalidPhone"));
      phone?.focus();
      return;
    }
    if (fulfillment === "delivery") {
      if (!address || address.value.trim().length < 5) {
        setError(t("invalidAddress"));
        address?.focus();
        return;
      }
    } else if (!pickupLocation || pickupLocation.value.trim().length < 3) {
      setError(t("invalidPickupLocation"));
      pickupLocation?.focus();
      return;
    }
    setFulfillmentComplete(true);
  }

  function changeQuantity(productId: string, change: number) {
    setItems((current) =>
      current
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
    setFulfillmentComplete(false);
  }

  function removeItem(productId: string) {
    setItems((current) =>
      current.filter((item) => item.product.id !== productId),
    );
    setFulfillmentComplete(false);
  }

  function persistItems(nextItems: CheckoutItem[]) {
    try {
      localStorage.setItem(
        "ilphotox-cart",
        JSON.stringify(
          nextItems.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
        ),
      );
    } catch (caught) {
      console.error("Could not save the checkout cart", caught);
    }
  }

  useEffect(() => {
    if (!loading) persistItems(items);
  }, [items, loading]);

  function useMyLocation() {
    setError("");
    if (!navigator.geolocation) {
      setError(t("locationUnavailable"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const address = document.querySelector<HTMLTextAreaElement>(
          "[name=deliveryAddress]",
        );
        if (address) {
          address.value =
            `Map location: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
          address.dataset.latitude = String(position.coords.latitude);
          address.dataset.longitude = String(position.coords.longitude);
        }
      },
      () => setError(t("locationFailed")),
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  async function submitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isCustomer) {
      router.push("/login?callbackUrl=%2Fcheckout");
      return;
    }
    if (!fulfillmentComplete) {
      setError(t("completeDelivery"));
      return;
    }

    setBusy(true);
    setError("");
    setReceiptError(false);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const addressInput = form.elements.namedItem(
      "deliveryAddress",
    ) as HTMLTextAreaElement | null;
    const latitude = addressInput?.dataset.latitude
      ? Number(addressInput.dataset.latitude)
      : undefined;
    const longitude = addressInput?.dataset.longitude
      ? Number(addressInput.dataset.longitude)
      : undefined;
    const orderInput = {
      items: items.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      })),
      deliveryName: String(formData.get("deliveryName") ?? "").trim(),
      deliveryPhone: String(formData.get("deliveryPhone") ?? "").trim(),
      deliveryAddress:
        fulfillment === "delivery"
          ? String(formData.get("deliveryAddress") ?? "").trim()
          : "Pickup",
      fulfillmentMethod: fulfillment,
      paymentMode:
        paymentChoice === "receipt" ? "receipt" : "cash_on_delivery",
      deliveryZone: fulfillment === "delivery" ? deliveryZone : undefined,
      pickupLocation:
        fulfillment === "pickup"
          ? String(formData.get("pickupLocation") ?? "").trim()
          : undefined,
      deliveryLatitude: latitude,
      deliveryLongitude: longitude,
      notifyByEmail: formData.get("notifyByEmail") === "on",
      notifyByWhatsapp: formData.get("notifyByWhatsapp") === "on",
      notificationLanguage: language,
    };
    const fingerprint = JSON.stringify(orderInput);
    if (idempotencyRequest.current?.fingerprint !== fingerprint) {
      idempotencyRequest.current = {
        fingerprint,
        key:
          typeof window.crypto.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`,
      };
    }
    let createdOrderId = "";

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyRequest.current.key,
        },
        body: fingerprint,
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            order?: { id: string };
            error?: string;
            notificationDelivery?: {
              delivery?: { failed: number; unavailable: number } | null;
              warning?: string | null;
            };
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || t("orderFailed"));
      }
      if (!payload?.order?.id) throw new Error("Order ID was not returned.");

      createdOrderId = payload.order.id;
      setOrderId(payload.order.id);
      setNotificationWarning(
        Boolean(
          payload.notificationDelivery?.warning ||
            payload.notificationDelivery?.delivery?.failed ||
            payload.notificationDelivery?.delivery?.unavailable,
        ),
      );
      try {
        localStorage.removeItem("ilphotox-cart");
      } catch (caught) {
        console.error("Could not clear the saved cart after order creation", caught);
      }
      setItems([]);

      if (paymentChoice === "receipt") {
        const receipt = form.querySelector<HTMLInputElement>(
          'input[name="receipt"]',
        )?.files?.[0];
        const reference = String(
          formData.get("transactionReference") ?? "",
        ).trim();
        if (receipt) {
          const proofForm = new FormData();
          proofForm.set("method", paymentMethod);
          proofForm.set("transactionReference", reference);
          proofForm.set("document", receipt);
          const proofResponse = await fetch(
            `/api/orders/${encodeURIComponent(payload.order.id)}/payment-proofs`,
            { method: "POST", body: proofForm },
          );
          if (!proofResponse.ok) {
            const proofPayload = (await proofResponse.json().catch(
              () => null,
            )) as { error?: string } | null;
            setReceiptError(true);
            setError(
              proofPayload?.error || t("paymentReceiptFailed"),
            );
            return;
          }
          setReceiptSubmitted(true);
        }
      }
    } catch (caught) {
      if (createdOrderId) {
        setReceiptError(true);
      }
      setError(
        caught instanceof Error ? caught.message : t("checkoutFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function messageMerchant(ownerId: string, merchantName: string) {
    setMerchantNotice("");
    if (!isCustomer) {
      router.push("/login?callbackUrl=%2Fcheckout");
      return;
    }
    try {
      const response = await fetch("/api/checkout/merchant-conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          merchantId: ownerId,
          subject: merchantSubject || `Question about ${merchantName}`,
          message:
            merchantMessage ||
            `I have a question about products in my checkout.`,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error || "Message could not be sent.");
      }
      setMerchantNotice(`${t("messageSent")} ${merchantName}`);
      setMerchantMessage("");
      setMerchantSubject("");
    } catch (caught) {
      setMerchantNotice(
        caught instanceof Error
          ? caught.message
          : "Message could not be sent.",
      );
    }
  }

  if (loading) {
    return <div className="checkout-loading">{t("loading")}</div>;
  }

  if (orderId) {
    return (
      <div className="checkout-success">
        <span><CheckCircle2 size={34} /></span>
        <h1>{t("orderPlaced")}</h1>
        <p>{t("orderNumber")} #{orderId.slice(-8).toUpperCase()}</p>
        {receiptSubmitted && <p>{t("receiptSubmitted")}</p>}
        {notificationWarning && (
          <p role="status">{t("externalNotificationWarning")}</p>
        )}
        {receiptError && (
          <div className="checkout-error" role="alert">
            <p>{error || t("receiptFailed")}</p>
            <Link href={`/orders/${encodeURIComponent(orderId)}`}>
              {t("retryReceiptOnOrder")}
            </Link>
          </div>
        )}
        <div className="checkout-contact-actions">
          <a href="tel:0788390989"><Phone size={17} /> {t("callSupport")}</a>
          <a
            href="https://wa.me/250736494012"
            rel="noopener noreferrer"
            target="_blank"
          >
            <MessageCircle size={17} /> {t("whatsappSupport")}
          </a>
          <Link href={`/orders/${encodeURIComponent(orderId)}`}>
            {t("viewOrder")}
          </Link>
        </div>
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="checkout-empty">
        <span><Package size={30} /></span>
        <h1>{t("cartEmpty")}</h1>
        <p>{t("cartEmptyDescription")}</p>
        <Link href="/">{t("continueShopping")}</Link>
      </div>
    );
  }

  const merchantIds = [
    ...new Map(
      items
        .filter((item) => item.product.ownerId)
        .map((item) => [
          item.product.ownerId as string,
          item.product.seller,
        ]),
    ).entries(),
  ];

  return (
    <main className="checkout-page">
      <header className="checkout-topbar">
        <Link href="/" className="checkout-brand">
          <Image alt="" height={38} src="/ilphotox-shop-logo.png" width={38} />
          <span>ILPhotoX Shop</span>
        </Link>
        <nav aria-label={t("navigation")}>
          <Link href="/"><ShoppingBag size={16} /> {t("home")}</Link>
          <Link href="/support/all-in-one">
            <Headphones size={16} /> {t("support")}
          </Link>
          <Link href="/checkout"><Banknote size={16} /> {t("payment")}</Link>
          {isCustomer && (
            <Link href="/orders"><Package size={16} /> {t("myOrders")}</Link>
          )}
          <LanguageSelector
            language={language}
            onChange={setMarketplaceLanguage}
          />
        </nav>
      </header>

      <div className="checkout-layout">
        <form className="checkout-main" onSubmit={submitOrder}>
          <div className="checkout-heading">
            <Link href="/"><ArrowLeft size={16} /> {t("continueShopping")}</Link>
            <h1>{t("checkout")}</h1>
            <p>
              {isCustomer
                ? `${t("signedInAs")} ${customerName}`
                : userRole
                  ? t("customerAccountRequired")
                  : t("reviewCart")}
            </p>
          </div>

          {!isCustomer && (
            <section className="checkout-card checkout-guest-summary">
              <h2><ShoppingBag size={19} /> {t("itemsInCart")}</h2>
              <p>
                {userRole
                  ? t("customerAccountRequired")
                  : t("signInToContinue")}
              </p>
              {userRole && (
                <button
                  className="checkout-location-button"
                  onClick={() =>
                    signOut({
                      callbackUrl: "/login?callbackUrl=%2Fcheckout",
                    })
                  }
                  type="button"
                >
                  {t("signOut")}
                </button>
              )}
            </section>
          )}

          {isCustomer && (
            <section className="checkout-card">
              <h2><Truck size={19} /> {t("fulfillment")}</h2>
              <div className="checkout-choice-grid">
                <button
                  className={fulfillment === "delivery" ? "is-selected" : ""}
                  onClick={() => {
                    setFulfillment("delivery");
                    setFulfillmentComplete(false);
                  }}
                  type="button"
                >
                  <Truck size={20} />
                  <span>
                    <strong>{t("delivery")}</strong>
                    <small>{t("deliveryDescription")}</small>
                  </span>
                </button>
                <button
                  className={fulfillment === "pickup" ? "is-selected" : ""}
                  onClick={() => {
                    setFulfillment("pickup");
                    setFulfillmentComplete(false);
                  }}
                  type="button"
                >
                  <MapPin size={20} />
                  <span>
                    <strong>{t("pickup")}</strong>
                    <small>{t("pickupDescription")}</small>
                  </span>
                </button>
              </div>

              {fulfillment === "delivery" ? (
                <div className="checkout-fields">
                  <label>
                    {t("recipientName")}
                    <input autoComplete="name" name="deliveryName" minLength={2} required />
                  </label>
                  <label>
                    {t("phoneNumber")}
                    <input
                      autoComplete="tel"
                      name="deliveryPhone"
                      minLength={7}
                      maxLength={32}
                      required
                    />
                  </label>
                  <label>
                    {t("deliveryZone")}
                    <select
                      onChange={(event) => {
                        setDeliveryZone(event.target.value as DeliveryZone);
                        setFulfillmentComplete(false);
                      }}
                      value={deliveryZone}
                    >
                      <option value="kigali">{t("kigali")}</option>
                      <option value="outside_kigali">{t("outsideKigali")}</option>
                      <option value="international">{t("international")}</option>
                    </select>
                  </label>
                  <label className="checkout-full-field">
                    {t("deliveryAddress")}
                    <textarea
                      data-longitude=""
                      data-latitude=""
                      name="deliveryAddress"
                      minLength={5}
                      required
                      rows={3}
                    />
                  </label>
                  <button
                    className="checkout-location-button checkout-full-field"
                    onClick={useMyLocation}
                    type="button"
                  >
                    <MapPin size={16} /> {t("currentLocation")}
                  </button>
                </div>
              ) : (
                <div className="checkout-fields">
                  <label>
                    {t("recipientName")}
                    <input autoComplete="name" name="deliveryName" minLength={2} required />
                  </label>
                  <label>
                    {t("phoneNumber")}
                    <input
                      autoComplete="tel"
                      name="deliveryPhone"
                      minLength={7}
                      maxLength={32}
                      required
                    />
                  </label>
                  <label className="checkout-full-field">
                    {t("pickupLocation")}
                    <input
                      name="pickupLocation"
                      minLength={3}
                      placeholder={t("pickupPlaceholder")}
                      required
                    />
                  </label>
                </div>
              )}
              <button
                className="checkout-location-button"
                disabled={fulfillmentComplete}
                onClick={completeFulfillment}
                type="button"
              >
                {fulfillmentComplete
                  ? t("fulfillmentConfirmed")
                  : t("confirmFulfillment")}
              </button>
            </section>
          )}

          {isCustomer && fulfillmentComplete && (
            <section className="checkout-card">
              <h2><Banknote size={19} /> {t("paymentHeading")}</h2>
              <div className="checkout-choice-grid">
                {accounts.length > 0 && (
                  <button
                    className={paymentChoice === "receipt" ? "is-selected" : ""}
                    onClick={() => setPaymentChoice("receipt")}
                    type="button"
                  >
                    <ReceiptText size={20} />
                    <span>
                      <strong>{t("payByReceipt")}</strong>
                      <small>{t("payByReceiptDescription")}</small>
                    </span>
                  </button>
                )}
                <button
                  className={paymentChoice === "cod" ? "is-selected" : ""}
                  onClick={() => setPaymentChoice("cod")}
                  type="button"
                >
                  <Truck size={20} />
                  <span>
                    <strong>{t("payOnCollection")}</strong>
                    <small>{t("payOnCollectionDescription")}</small>
                  </span>
                </button>
              </div>

              {accounts.length === 0 && (
                <p role="note">{t("noPaymentAccount")}</p>
              )}

              {paymentChoice === "receipt" && accounts.length > 0 && (
                <div className="checkout-payment-details">
                  <h3>{t("paymentInstructions")}</h3>
                  {accounts.map((account) => (
                    <div className="checkout-payment-account" key={account.id}>
                      <strong>
                        {account.type === "bank"
                          ? t("bankTransfer")
                          : t("mobileMoney")}{" "}
                        · {account.provider}
                      </strong>
                      <span>{account.accountName}</span>
                      <code>{account.accountNumber}</code>
                    </div>
                  ))}
                  <div className="checkout-fields">
                    <label>
                      {t("paymentHeading")}
                      <select
                        onChange={(event) =>
                          setPaymentMethod(
                            event.target.value as "bank_transfer" | "mobile_money",
                          )
                        }
                        value={paymentMethod}
                      >
                        {accounts.some((account) => account.type === "bank") && (
                          <option value="bank_transfer">{t("bankTransfer")}</option>
                        )}
                        {accounts.some(
                          (account) => account.type === "mobile_money",
                        ) && (
                          <option value="mobile_money">{t("mobileMoney")}</option>
                        )}
                      </select>
                    </label>
                    <label>
                      {t("transactionReference")}
                      <input
                        name="transactionReference"
                        minLength={3}
                        maxLength={120}
                        required
                      />
                    </label>
                    <label className="checkout-full-field">
                      {t("uploadReceipt")}
                      <input
                        accept="application/pdf,image/jpeg,image/png"
                        name="receipt"
                        required
                        type="file"
                      />
                    </label>
                  </div>
                </div>
              )}
            </section>
          )}

          {isCustomer && fulfillmentComplete && (
            <>
              <section className="checkout-card">
                <h2><MessageCircle size={19} /> {t("messageMerchants")}</h2>
                {merchantIds.map(([ownerId, merchantName]) => {
                  const merchant = items.find(
                    (item) => item.product.ownerId === ownerId,
                  )?.product;
                  return (
                    <div className="checkout-merchant-row" key={ownerId}>
                      <div>
                        <strong>{merchantName}</strong>
                        {merchant?.owner?.phone && (
                          <a href={`tel:${merchant.owner.phone}`}>
                            <Phone size={14} /> {t("callMerchant")}
                          </a>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => messageMerchant(ownerId, merchantName)}
                      >
                        <MessageCircle size={16} /> {t("sendMessage")}
                      </button>
                    </div>
                  );
                })}
                <div className="checkout-fields">
                  <label>
                    {t("subject")}
                    <input
                      maxLength={200}
                      onChange={(event) => setMerchantSubject(event.target.value)}
                      value={merchantSubject}
                    />
                  </label>
                  <label className="checkout-full-field">
                    {t("message")}
                    <textarea
                      maxLength={4000}
                      onChange={(event) => setMerchantMessage(event.target.value)}
                      rows={3}
                      value={merchantMessage}
                    />
                  </label>
                </div>
                {merchantNotice && <p role="status">{merchantNotice}</p>}
              </section>

              <section className="checkout-card checkout-notification-preferences">
                <h2>{t("orderUpdates")}</h2>
                <label>
                  <input name="notifyByEmail" type="checkbox" />
                  <span>{t("emailUpdates")}</span>
                </label>
                <label>
                  <input name="notifyByWhatsapp" type="checkbox" />
                  <span>{t("whatsappUpdates")}</span>
                </label>
              </section>
            </>
          )}

          {error && !orderId && (
            <p className="checkout-error" role="alert">{error}</p>
          )}
          <button
            className="checkout-submit"
            disabled={
              busy ||
              (isCustomer && !fulfillmentComplete) ||
              Boolean(userRole && !isCustomer)
            }
            onClick={
              !isCustomer && !userRole
                ? () => router.push("/login?callbackUrl=%2Fcheckout")
                : undefined
            }
            type={isCustomer ? "submit" : "button"}
          >
            {busy
              ? t("placingOrder")
              : isCustomer
                ? `${t("placeOrder")} · ${formatMoney(total)}`
                : userRole
                  ? t("customerAccountRequired")
                  : `${t("signInToPlaceOrder")} · ${formatMoney(total)}`}
          </button>
        </form>

        <aside className="checkout-summary">
          <h2>{t("orderSummary")}</h2>
          {items.map((item) => (
            <article key={item.product.id}>
              <Image
                alt=""
                height={64}
                src={item.product.image}
                unoptimized
                width={64}
              />
              <div>
                <strong>{item.product.name}</strong>
                <small>
                  {item.quantity} × {formatMoney(item.product.price)}
                </small>
                {item.product.commissionAmount ? (
                  <small className="product-fee-note">
                    Platform fee included · {formatMoney(item.product.commissionAmount)}
                  </small>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={t("remove")}
                onClick={() => removeItem(item.product.id)}
              >
                {t("remove")}
              </button>
              <div className="checkout-summary-quantity">
                <button
                  aria-label={t("decreaseQuantity")}
                  type="button"
                  onClick={() => changeQuantity(item.product.id, -1)}
                >
                  −
                </button>
                <span>{item.quantity}</span>
                <button
                  aria-label={t("increaseQuantity")}
                  type="button"
                  onClick={() => changeQuantity(item.product.id, 1)}
                >
                  +
                </button>
              </div>
            </article>
          ))}
          <div className="checkout-summary-total">
            <span>{t("subtotal")}</span>
            <strong>{formatMoney(subtotal)}</strong>
          </div>
          <div className="checkout-summary-total">
            <span>{t("deliveryFee")}</span>
            <strong>{deliveryFee ? formatMoney(deliveryFee) : t("free")}</strong>
          </div>
          {fulfillment === "delivery" && (
            <div className="checkout-summary-total">
              <span>{t("estimatedDelivery")}</span>
              <strong>{estimatedDelivery}</strong>
            </div>
          )}
          <div className="checkout-summary-total">
            <span>{t("orderTotal")}</span>
            <strong>{formatMoney(total)}</strong>
          </div>
          <div className="checkout-call-actions">
            <a href="tel:0788390989"><Phone size={16} /> {t("callSupport")}</a>
            <a href="tel:0788390989"><Truck size={16} /> {t("delivery")}</a>
          </div>
        </aside>
      </div>
    </main>
  );
}
