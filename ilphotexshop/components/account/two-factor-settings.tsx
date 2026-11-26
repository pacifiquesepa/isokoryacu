"use client";

import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import Image from "next/image";
import QRCode from "qrcode";

export default function TwoFactorSettings({ enabled }: { enabled: boolean }) {
  const [secret, setSecret] = useState("");
  const [otpauthUrl, setOtpAuthUrl] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [authenticatorEnabled, setAuthenticatorEnabled] = useState(enabled);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailCode, setEmailCode] = useState("");
  const [qrImage, setQrImage] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    fetch("/api/security/two-factor", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const result = await response.json() as {
          enabled?: boolean;
          authenticator?: boolean;
          email?: boolean;
        };
        setAuthenticatorEnabled(Boolean(result.authenticator ?? result.enabled));
        setEmailEnabled(Boolean(result.email));
      })
      .catch(() => {
        setMessage("Two-factor status could not be loaded.");
      });
  }, []);

  async function submit(
    action: "setup" | "enable" | "disable" | "configure" | "send_email_otp" | "verify_email_otp",
  ) {
    setPending(true);
    setMessage("");
    try {
      const body =
        action === "setup" || action === "send_email_otp"
          ? { action }
          : action === "enable"
            ? { action, code }
            : action === "verify_email_otp"
              ? { action, code: emailCode }
              : action === "configure"
                ? { action, authenticator: authenticatorEnabled, email: emailEnabled, password }
                : { action, code, password };
      const response = await fetch("/api/security/two-factor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as {
        error?: string;
        secret?: string;
        otpauthUrl?: string;
        enabled?: boolean;
      };
      if (!response.ok) throw new Error(result.error ?? "Two-factor update failed");
      if (action === "setup") {
        setSecret(result.secret ?? "");
        setOtpAuthUrl(result.otpauthUrl ?? "");
        if (result.otpauthUrl) {
          QRCode.toDataURL(result.otpauthUrl, {
            width: 220,
            margin: 1,
            color: { dark: "#174f91", light: "#ffffff" },
          })
            .then(setQrImage)
            .catch(() => setMessage("QR code could not be rendered. Use the secret below."));
        }
        setMessage("Add this authenticator secret to your app, then enter its current six-digit code to enable two-factor authentication.");
      } else if (action === "enable") {
        setSecret("");
        setOtpAuthUrl("");
        setCode("");
        setMessage("Two-factor authentication is enabled.");
      } else if (action === "send_email_otp") {
        setMessage("A 6-digit verification code was sent to your email.");
      } else if (action === "verify_email_otp") {
        setEmailEnabled(true);
        setEmailCode("");
        setMessage("Email verification is enabled.");
      } else if (action === "configure") {
        setPassword("");
        setMessage("Two-factor methods updated.");
      } else {
        setPassword("");
        setCode("");
        setMessage("Two-factor authentication was disabled. Your sessions were revoked; signing out.");
        await signOut({ callbackUrl: "/login" });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Two-factor update failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="super-admin-panel super-admin-security-settings">
      <h2>Two-factor verification methods</h2>
      <p>
        Choose authenticator app, email verification, or both.
      </p>
      <div className="super-admin-security-settings-form">
        <label>
          <input
            checked={authenticatorEnabled}
            onChange={(event) => setAuthenticatorEnabled(event.target.checked)}
            type="checkbox"
          />
          Authenticator app
        </label>
        <label>
          <input
            checked={emailEnabled}
            onChange={(event) => setEmailEnabled(event.target.checked)}
            type="checkbox"
          />
          Email OTP
        </label>
        {!authenticatorEnabled && !emailEnabled && (
          <p>Select at least one verification method.</p>
        )}
      </div>

      {authenticatorEnabled && (
        <div className="super-admin-security-settings-form">
          <button className="super-admin-primary-action" disabled={pending || Boolean(secret)} onClick={() => submit("setup")} type="button">
            {pending ? "Starting setup…" : "Scan QR with authenticator app"}
          </button>
          {secret && (
            <>
              {otpauthUrl && (
                <div className="merchant-record-qr" aria-label="Authenticator QR setup">
                  {qrImage ? (
                    <Image
                      alt="QR code for authenticator app setup"
                      height={220}
                      src={qrImage}
                      unoptimized
                      width={220}
                    />
                  ) : (
                    <span>Preparing QR code…</span>
                  )}
                </div>
              )}
              <p>Secret: <code>{secret}</code></p>
              <label>
                Six-digit authenticator code
                <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setCode(event.target.value)} pattern="[0-9]{6}" value={code} />
              </label>
              <button className="super-admin-primary-action" disabled={pending || code.length !== 6} onClick={() => submit("enable")} type="button">
                Verify authenticator
              </button>
            </>
          )}
        </div>
      )}

      {emailEnabled && (
        <div className="super-admin-security-settings-form">
          <button className="super-admin-primary-action" disabled={pending} onClick={() => submit("send_email_otp")} type="button">
            Send email verification code
          </button>
          <label>
            Email OTP
            <input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setEmailCode(event.target.value)} pattern="[0-9]{6}" value={emailCode} />
          </label>
          <button className="super-admin-primary-action" disabled={pending || emailCode.length !== 6} onClick={() => submit("verify_email_otp")} type="button">
            Verify email OTP
          </button>
        </div>
      )}

      <div className="super-admin-security-settings-form">
        <label>
          Confirm password
          <input autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
        </label>
        <button
          className="super-admin-primary-action"
          disabled={pending || !password || (!authenticatorEnabled && !emailEnabled)}
          onClick={() => submit("configure")}
          type="button"
        >
          Save verification methods
        </button>
      </div>
      <p aria-live="polite" role={message && message.includes("failed") ? "alert" : undefined}>{message}</p>
    </section>
  );
}
