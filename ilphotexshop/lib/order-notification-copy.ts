import type { OrderStatus } from "@prisma/client";
import type { Language } from "@/lib/marketplace-i18n";

type OrderNotificationEvent = "placed" | OrderStatus;

const eventText: Record<
  Language,
  Record<OrderNotificationEvent, { title: string; status: string }>
> = {
  en: {
    placed: { title: "Order received", status: "received" },
    pending: { title: "Order pending", status: "pending" },
    confirmed: { title: "Order confirmed", status: "confirmed" },
    processing: { title: "Order being prepared", status: "being prepared" },
    shipped: { title: "Order shipped", status: "shipped" },
    delivered: { title: "Order delivered", status: "delivered" },
    fulfilled: { title: "Order complete", status: "complete" },
    cancelled: { title: "Order cancelled", status: "cancelled" },
  },
  fr: {
    placed: { title: "Commande reçue", status: "reçue" },
    pending: { title: "Commande en attente", status: "en attente" },
    confirmed: { title: "Commande confirmée", status: "confirmée" },
    processing: { title: "Commande en préparation", status: "en préparation" },
    shipped: { title: "Commande expédiée", status: "expédiée" },
    delivered: { title: "Commande livrée", status: "livrée" },
    fulfilled: { title: "Commande terminée", status: "terminée" },
    cancelled: { title: "Commande annulée", status: "annulée" },
  },
  rw: {
    placed: { title: "Order yakiriwe", status: "yakiriwe" },
    pending: { title: "Order irategereje", status: "irategereje" },
    confirmed: { title: "Order yemejwe", status: "yemejwe" },
    processing: { title: "Order iri gutegurwa", status: "iri gutegurwa" },
    shipped: { title: "Order yoherejwe", status: "yoherejwe" },
    delivered: { title: "Order yagejejwe", status: "yagejejwe" },
    fulfilled: { title: "Order yarangiye", status: "yarangiye" },
    cancelled: { title: "Order yahagaritswe", status: "yahagaritswe" },
  },
};

export function getOrderNotificationCopy(
  event: OrderNotificationEvent,
  language: Language,
  orderNumber: string,
) {
  const copy = eventText[language][event];
  return {
    title: copy.title,
    body:
      language === "rw"
        ? `Order #${orderNumber} ${copy.status}. Reba amakuru yose muri konti yawe.`
        : language === "fr"
          ? `La commande n° ${orderNumber} est ${copy.status}. Consultez les détails dans votre compte.`
          : `Order #${orderNumber} is ${copy.status}. View the details in your account.`,
  };
}

export type { OrderNotificationEvent };
