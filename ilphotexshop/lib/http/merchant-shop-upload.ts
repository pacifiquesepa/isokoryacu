const maxMerchantShopFormBytes = 10 * 1024 * 1024 + 64 * 1024;

export type MerchantShopFormDataResult =
  | { ok: true; form: FormData }
  | { ok: false; status: 400 | 413; error: string };

export async function readMerchantShopFormData(
  request: Request,
): Promise<MerchantShopFormDataResult> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const bytes = Number(contentLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0) {
      return { ok: false, status: 400, error: "Invalid request size" };
    }
    if (bytes > maxMerchantShopFormBytes) {
      return { ok: false, status: 413, error: "Shop images are too large" };
    }
  }

  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return { ok: false, status: 400, error: "Invalid multipart form data" };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { ok: false, status: 400, error: "Invalid multipart form data" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxMerchantShopFormBytes) {
        await reader.cancel();
        return { ok: false, status: 413, error: "Shop images are too large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": contentType },
      body,
    }).formData();
    return { ok: true, form };
  } catch {
    return { ok: false, status: 400, error: "Invalid multipart form data" };
  }
}
