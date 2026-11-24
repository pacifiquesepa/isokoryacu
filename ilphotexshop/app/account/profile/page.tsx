import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import CustomerPortalLayout from "@/components/customer/customer-portal-layout";
import CustomerProfileForm from "@/components/customer/customer-profile-form";
import { requireCustomerPageUser } from "@/lib/authorization";
import { getCustomerProfile } from "@/lib/data-access/customer-profile";

export const metadata: Metadata = {
  title: "My profile | ILPhotoX Shop",
  robots: { index: false, follow: false },
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export default function CustomerProfilePage() {
  return (
    <CustomerPortalLayout active="profile">
      <Suspense
        fallback={<div className="customer-orders-loading">Loading profile…</div>}
      >
        <CustomerProfileContent />
      </Suspense>
    </CustomerPortalLayout>
  );
}

async function CustomerProfileContent() {
  await connection();
  const customer = await requireCustomerPageUser("/account/profile");
  const profile = await getCustomerProfile(customer);
  if (!profile) notFound();

  return (
    <div className="customer-orders-page customer-account-page">
      <div className="customer-orders-heading">
        <div>
          <span className="customer-orders-breadcrumb">Account / Profile</span>
          <h1>My profile</h1>
          <p>Manage your personal information.</p>
        </div>
      </div>

      <section className="customer-account-card">
        <div className="customer-account-card-heading">
          <div>
            <h2>Personal details</h2>
            <p>Member since {dateFormat.format(profile.createdAt)}</p>
          </div>
        </div>
        <dl className="customer-account-summary">
          <div>
            <dt>Email</dt>
            <dd>{profile.email}</dd>
          </div>
        </dl>
        <CustomerProfileForm name={profile.name} phone={profile.phone} />
      </section>
    </div>
  );
}
