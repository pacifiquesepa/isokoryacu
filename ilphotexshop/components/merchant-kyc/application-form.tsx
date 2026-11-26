"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  FileCheck2,
  LockKeyhole,
  ShieldCheck,
  Upload,
} from "lucide-react";

type KycApplication = {
  id: string;
  businessName: string;
  businessAddress: string;
  taxId: string | null;
  status: "pending" | "approved";
  reviewReason: string | null;
  submittedAt: Date;
  reviewedAt: Date | null;
};

type MerchantKycApplicationFormProps = {
  ownerName: string;
  application: KycApplication | null;
};

const dateFormat = new Intl.DateTimeFormat("en-RW", {
  dateStyle: "long",
  timeZone: "UTC",
});

export default function MerchantKycApplicationForm({
  ownerName,
  application,
}: MerchantKycApplicationFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicantName, setApplicantName] = useState(ownerName);
  const [businessName, setBusinessName] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [registrationFile, setRegistrationFile] = useState("");
  const [identityFile, setIdentityFile] = useState("");
  const completedSteps = [
    applicantName.trim().length >= 2,
    businessName.trim().length >= 2,
    businessAddress.trim().length >= 3,
    Boolean(registrationFile),
    Boolean(identityFile),
  ].filter(Boolean).length;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/merchant-kyc", {
        method: "POST",
        body: new FormData(event.currentTarget),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMessage(result.error ?? "Application could not be submitted.");
        return;
      }
      setMessage("Application submitted for review.");
      router.refresh();
    } catch (error) {
      console.error("Could not submit merchant verification", error);
      setMessage("Application could not be submitted. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="merchant-kyc-page">
      <header className="merchant-kyc-header">
        <Link className="merchant-kyc-brand" href="/">
          <span className="merchant-kyc-brand-mark">IL</span>
          <span>ILPhotoX <strong>Shop</strong></span>
        </Link>
        <span className="merchant-kyc-header-label">
          <ShieldCheck aria-hidden="true" size={16} />
          Secure merchant verification
        </span>
      </header>
      <main className="merchant-kyc-main">
        <section className="merchant-kyc-intro">
          <span className="merchant-kyc-kicker">
            <span aria-hidden="true" />
            SELL WITH US
          </span>
          <h1>Bring your business to <span>ILPhotoX Shop.</span></h1>
          <p className="merchant-kyc-intro-copy">
            Reach more customers and grow your business. Send us a few details
            and our team will review your application.
          </p>

          <div className="merchant-kyc-benefits">
            <div className="merchant-kyc-benefit">
              <span className="merchant-kyc-benefit-icon">
                <Building2 aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>Your business, your storefront</strong>
                <small>Showcase your products to shoppers across Rwanda.</small>
              </span>
            </div>
            <div className="merchant-kyc-benefit">
              <span className="merchant-kyc-benefit-icon">
                <BadgeCheck aria-hidden="true" size={19} />
              </span>
              <span>
                <strong>A simple verification process</strong>
                <small>Share your details and two supporting documents.</small>
              </span>
            </div>
          </div>

          <div className="merchant-kyc-steps" aria-label="Application steps">
            <div className="merchant-kyc-step is-current">
              <span className="merchant-kyc-step-number">01</span>
              <span><strong>Apply</strong><small>Tell us about your business</small></span>
            </div>
            <span className="merchant-kyc-step-connector" aria-hidden="true" />
            <div className="merchant-kyc-step">
              <span className="merchant-kyc-step-number">02</span>
              <span><strong>Review</strong><small>Our team checks your details</small></span>
            </div>
            <span className="merchant-kyc-step-connector" aria-hidden="true" />
            <div className="merchant-kyc-step">
              <span className="merchant-kyc-step-number">03</span>
              <span><strong>Start selling</strong><small>Set up your merchant shop</small></span>
            </div>
          </div>

          <p className="merchant-kyc-trust-note">
            <LockKeyhole aria-hidden="true" size={15} />
            Your verification documents are handled securely.
          </p>
        </section>

        <div className="merchant-kyc-panel">
          {application ? (
            <section aria-live="polite" className="merchant-kyc-status-card">
              <span className="merchant-kyc-card-eyebrow">
                <ShieldCheck aria-hidden="true" size={17} />
                YOUR APPLICATION
              </span>
              <span className={`merchant-kyc-status is-${application.status}`}>
                <span aria-hidden="true" />
                {application.status === "pending" ? "Under review" : "Approved"}
              </span>
              <h2>{application.businessName}</h2>
              <p>
                Submitted {dateFormat.format(application.submittedAt)} ·{" "}
                {application.businessAddress}
              </p>
              {application.status === "pending" ? (
                <div className="merchant-kyc-status-detail">
                  <span className="merchant-kyc-status-icon">
                    <FileCheck2 aria-hidden="true" size={20} />
                  </span>
                  <span>
                    <strong>Your application is in the review queue.</strong>
                    <small>
                      Our team will verify your information and update your
                      account when a decision is made.
                    </small>
                  </span>
                </div>
              ) : (
                <>
                  <div className="merchant-kyc-status-detail is-approved">
                    <span className="merchant-kyc-status-icon">
                      <Check aria-hidden="true" size={20} />
                    </span>
                    <span>
                      <strong>You’re ready to start selling.</strong>
                      <small>
                        Your products will still go through the usual
                        publication review process.
                      </small>
                    </span>
                  </div>
                  <Link className="merchant-kyc-primary" href="/merchant">
                    Open merchant workspace <ArrowRight aria-hidden="true" size={17} />
                  </Link>
                </>
              )}
              {application.reviewReason && (
                <p className="merchant-kyc-review-note">
                  Review note: {application.reviewReason}
                </p>
              )}
            </section>
          ) : (
            <form
              className="merchant-kyc-form"
              encType="multipart/form-data"
              onSubmit={handleSubmit}
            >
              <div className="merchant-kyc-form-heading">
                <div>
                  <span className="merchant-kyc-card-eyebrow">GET STARTED</span>
                  <h2>Merchant application</h2>
                  <p>Complete the details below to apply.</p>
                </div>
                <span className="merchant-kyc-progress-count">
                  {completedSteps} <span>/ 5</span>
                </span>
              </div>

              <div
                aria-label={`${completedSteps} of 5 required details completed`}
                className="merchant-kyc-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={5}
                aria-valuenow={completedSteps}
              >
                <span style={{ width: `${(completedSteps / 5) * 100}%` }} />
              </div>

              <div className="merchant-kyc-section-heading">
                <span>01</span>
                <div><strong>Business details</strong><small>Tell us who you are and what you sell.</small></div>
              </div>
              <div className="merchant-kyc-fields">
                <label className="merchant-kyc-field">
                  <span>Owner / applicant full name <b>*</b></span>
                  <input
                    autoComplete="name"
                    maxLength={100}
                    minLength={2}
                    name="ownerFullName"
                    onChange={(event) => setApplicantName(event.target.value)}
                    placeholder="e.g. Aline Mukamana"
                    required
                    value={applicantName}
                  />
                </label>
                <label className="merchant-kyc-field">
                  <span>Business name <b>*</b></span>
                  <input
                    autoComplete="organization"
                    maxLength={160}
                    minLength={2}
                    name="businessName"
                    onChange={(event) => setBusinessName(event.target.value)}
                    placeholder="Your registered business name"
                    required
                    value={businessName}
                  />
                </label>
                <label className="merchant-kyc-field merchant-kyc-field-wide">
                  <span>Business address <b>*</b></span>
                  <textarea
                    autoComplete="street-address"
                    maxLength={500}
                    minLength={3}
                    name="businessAddress"
                    onChange={(event) => setBusinessAddress(event.target.value)}
                    placeholder="District, sector, street or landmark"
                    required
                    rows={2}
                    value={businessAddress}
                  />
                </label>
                <label className="merchant-kyc-field merchant-kyc-field-wide">
                  <span>Tax identification number <small>Optional</small></span>
                  <input
                    maxLength={64}
                    name="taxId"
                    placeholder="Enter your TIN if available"
                  />
                </label>
              </div>

              <div className="merchant-kyc-section-heading merchant-kyc-section-documents">
                <span>02</span>
                <div><strong>Verification documents</strong><small>Upload clear photos or PDF files.</small></div>
              </div>
              <div className="merchant-kyc-fields merchant-kyc-document-fields">
                <label className="merchant-kyc-file-field">
                  <span className="merchant-kyc-file-title">Business registration certificate <b>*</b></span>
                  <span className={`merchant-kyc-file-drop${registrationFile ? " is-selected" : ""}`}>
                    <span className="merchant-kyc-upload-icon">
                      {registrationFile ? <Check aria-hidden="true" size={19} /> : <Upload aria-hidden="true" size={19} />}
                    </span>
                    <span className="merchant-kyc-file-copy">
                      <strong>{registrationFile || "Choose a file to upload"}</strong>
                      <small>{registrationFile ? "Ready to submit" : "PDF, JPG or PNG · up to 2 MB"}</small>
                    </span>
                    <span className="merchant-kyc-file-browse">Browse</span>
                    <input
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      name="registrationDocument"
                      onChange={(event) => setRegistrationFile(event.target.files?.[0]?.name ?? "")}
                      required
                      type="file"
                    />
                  </span>
                </label>
                <label className="merchant-kyc-file-field">
                  <span className="merchant-kyc-file-title">Owner identity document <b>*</b></span>
                  <span className={`merchant-kyc-file-drop${identityFile ? " is-selected" : ""}`}>
                    <span className="merchant-kyc-upload-icon">
                      {identityFile ? <Check aria-hidden="true" size={19} /> : <Upload aria-hidden="true" size={19} />}
                    </span>
                    <span className="merchant-kyc-file-copy">
                      <strong>{identityFile || "Choose a file to upload"}</strong>
                      <small>{identityFile ? "Ready to submit" : "PDF, JPG or PNG · up to 2 MB"}</small>
                    </span>
                    <span className="merchant-kyc-file-browse">Browse</span>
                    <input
                      accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                      name="identityDocument"
                      onChange={(event) => setIdentityFile(event.target.files?.[0]?.name ?? "")}
                      required
                      type="file"
                    />
                  </span>
                </label>
              </div>

              <p className="merchant-kyc-privacy-note">
                <LockKeyhole aria-hidden="true" size={17} />
                <span>
                  <strong>Your documents stay private.</strong> Only authorized
                  administrators can review your verification information.
                </span>
              </p>
              <div className="merchant-kyc-submit-row">
                <span><ShieldCheck aria-hidden="true" size={15} /> Secure submission</span>
                <button
                  className="merchant-kyc-primary"
                  disabled={isSubmitting}
                  type="submit"
                >
                  {isSubmitting ? "Submitting…" : "Submit application"}
                  {!isSubmitting && <ArrowRight aria-hidden="true" size={17} />}
                </button>
              </div>
              <p aria-live="polite" className="merchant-kyc-message">
                {message}
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
