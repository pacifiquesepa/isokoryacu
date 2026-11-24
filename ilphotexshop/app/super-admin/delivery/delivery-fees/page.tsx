import type { Metadata } from "next";
import { Truck } from "lucide-react";
import SuperAdminDeliverySettingsForm from "@/components/super-admin/delivery-settings-form";
import { getDeliverySettings } from "@/lib/data-access/delivery-settings";

export const metadata: Metadata = {
  title: "Delivery fees and estimates | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

export default async function DeliveryFeesPage() {
  const settings = await getDeliverySettings();

  return (
    <div className="super-admin-records-page">
      <div className="super-admin-records-heading">
        <div>
          <div className="super-admin-breadcrumb">
            Workspace / Delivery & Logistics / Delivery Fees
          </div>
          <h1>Delivery fees and estimates</h1>
          <p>Set the delivery fee and the estimated delivery times shown at checkout.</p>
        </div>
        <Truck aria-hidden="true" size={25} />
      </div>
      <div className="super-admin-data-note" role="note">
        Changes apply to new orders only. Each order keeps the delivery fee and
        estimate shown when it was placed. Pickup orders are not charged a delivery fee.
      </div>
      <section className="super-admin-panel super-admin-profile-edit-panel">
        <SuperAdminDeliverySettingsForm settings={settings} />
      </section>
    </div>
  );
}
