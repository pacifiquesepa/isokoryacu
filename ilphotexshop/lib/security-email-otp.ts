import { createHash, randomInt } from "node:crypto";
import { SMTPClient } from "emailjs";

export function createEmailOtp() {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  return { code, hash: createHash("sha256").update(code).digest("hex") };
}

export function hashEmailOtp(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

export async function sendEmailOtp(recipient: string, code: string) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE?.toLowerCase() === "true";
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM;
  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !password ||
    !from
  ) {
    throw new Error("SMTP email provider is not configured");
  }
  const client = new SMTPClient({
    host,
    port,
    ssl: secure,
    tls: !secure,
    user,
    password,
    timeout: 10_000,
  });
  try {
    await client.sendAsync({
      from,
      to: recipient,
      subject: "ILPhotoX Shop verification code",
      text: `Your ILPhotoX Shop verification code is ${code}. It expires in 10 minutes and can be used once.`,
    });
  } finally {
    client.smtp.close();
  }
}
