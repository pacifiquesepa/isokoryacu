"use client";

import Image from "next/image";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { useEffect, useState } from "react";

type SuperAdminRecordActionsProps = {
  title: string;
  recordId: string;
  fields: { label: string; value: string }[];
};

function toBase64(data: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(data);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

function createFileName(title: string, recordId: string) {
  const normalizedTitle = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `ilphotox-${normalizedTitle || "record"}-${recordId.slice(-8)}.pdf`;
}

async function createRecordPdf(
  title: string,
  recordId: string,
  fields: { label: string; value: string }[],
) {
  const shareUrl = window.location.href;
  const [qrImage, logoResponse] = await Promise.all([
    QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 240,
      color: { dark: "#174f91", light: "#ffffff" },
    }),
    fetch("/ilphotox-shop-logo.png"),
  ]);
  if (!logoResponse.ok) throw new Error("The system logo could not be loaded.");
  const logo = toBase64(await logoResponse.arrayBuffer());

  const pdf = new jsPDF({ format: "a4", unit: "mm" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 17;
  const contentWidth = pageWidth - margin * 2;
  const fileName = createFileName(title, recordId);

  pdf.setFillColor(23, 79, 145);
  pdf.rect(0, 0, pageWidth, 32, "F");
  pdf.setFillColor(243, 181, 67);
  pdf.rect(0, 32, pageWidth, 2, "F");
  pdf.addImage(logo, "PNG", margin, 7, 18, 18);
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.text("ILPhotoX Shop", margin + 24, 15);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.text("OFFICIAL RECORD", margin + 24, 22);
  pdf.setTextColor(35, 54, 74);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  const titleLines = pdf.splitTextToSize(title, contentWidth);
  let y = 47;
  pdf.text(titleLines, margin, y);
  y += titleLines.length * 8 + 4;
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(103, 116, 130);
  pdf.text(`Record ID: ${recordId}`, margin, y);
  pdf.text(`Generated: ${new Date().toLocaleString("en-RW")}`, margin, y + 5);
  y += 14;

  for (const field of fields) {
    const lines = pdf.splitTextToSize(field.value, contentWidth - 4);
    const rowHeight = Math.max(12, 5 + lines.length * 4.5);
    if (y + rowHeight > pageHeight - 47) {
      pdf.addPage();
      y = 19;
    }
    pdf.setDrawColor(225, 231, 236);
    pdf.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(23, 79, 145);
    pdf.text(field.label, margin, y + 5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(35, 54, 74);
    pdf.text(lines, margin + 52, y + 5, { maxWidth: contentWidth - 52 });
    y += rowHeight;
  }

  if (y + 40 > pageHeight - 15) {
    pdf.addPage();
    y = 19;
  }
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(35, 54, 74);
  pdf.text("Scan to open this record", margin, y + 5);
  pdf.addImage(qrImage, "PNG", margin, y + 8, 31, 31);

  for (let page = 1; page <= pdf.getNumberOfPages(); page += 1) {
    pdf.setPage(page);
    pdf.setFillColor(23, 79, 145);
    pdf.rect(0, pageHeight - 10, pageWidth, 10, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(255, 255, 255);
    pdf.text("ILPhotoX Shop · Authorized record", margin, pageHeight - 4);
    pdf.text(`${page} / ${pdf.getNumberOfPages()}`, pageWidth - margin, pageHeight - 4, {
      align: "right",
    });
  }

  return { pdf, fileName };
}

export default function SuperAdminRecordActions({
  title,
  recordId,
  fields,
}: SuperAdminRecordActionsProps) {
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(window.location.href, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 180,
      color: { dark: "#174f91", light: "#ffffff" },
    })
      .then((image) => {
        if (active) setQrImage(image);
      })
      .catch((error: unknown) => {
        console.error("Could not create record QR code", error);
        if (active) setMessage("The record QR code could not be created.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleDownload() {
    setBusy(true);
    setMessage("");
    try {
      const { pdf, fileName } = await createRecordPdf(title, recordId, fields);
      pdf.save(fileName);
      setMessage("PDF downloaded.");
    } catch (error) {
      console.error("Could not generate record PDF", error);
      setMessage("PDF could not be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    setBusy(true);
    setMessage("");
    try {
      const { pdf, fileName } = await createRecordPdf(title, recordId, fields);
      const file = new File([pdf.output("blob")], fileName, {
        type: "application/pdf",
      });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title, text: "ILPhotoX Shop record" });
        setMessage("PDF shared.");
      } else if (navigator.share) {
        pdf.save(fileName);
        await navigator.share({
          title,
          text: "ILPhotoX Shop record",
          url: window.location.href,
        });
        setMessage("PDF downloaded and record shared.");
      } else if (navigator.clipboard) {
        pdf.save(fileName);
        await navigator.clipboard.writeText(window.location.href);
        setMessage("PDF downloaded; record link copied.");
      } else {
        pdf.save(fileName);
        setMessage("PDF downloaded. Sharing is not available in this browser.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Could not share record", error);
      setMessage("Record could not be shared. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="super-admin-detail-actions">
        <button
          className="super-admin-primary-action"
          disabled={busy}
          onClick={handleDownload}
          type="button"
        >
          Download PDF
        </button>
        <button
          className="super-admin-back-action"
          disabled={busy}
          onClick={handleShare}
          type="button"
        >
          Share PDF
        </button>
      </div>
      <p aria-live="polite" className="super-admin-action-message">
        {message}
      </p>
      <div className="super-admin-record-qr">
        <div>
          <strong>Share this record</strong>
          <span>Scan the QR code to open this protected record.</span>
        </div>
        {qrImage ? (
          <Image
            alt="QR code linking to this protected record"
            className="super-admin-qr-image"
            height={120}
            src={qrImage}
            unoptimized
            width={120}
          />
        ) : (
          <span className="super-admin-qr-loading">Preparing QR code…</span>
        )}
      </div>
    </>
  );
}
