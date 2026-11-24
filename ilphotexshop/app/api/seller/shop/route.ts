import { requireUserRole, authorizationErrorResponse } from "@/lib/authorization";
import { updateMerchantShopProfile } from "@/lib/data-access/merchant-shop";
import { apiErrorResponse } from "@/lib/http/api-error-response";
import { readMerchantShopFormData } from "@/lib/http/merchant-shop-upload";
import { readProductImageUpload } from "@/lib/http/product-image-upload";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import { checkMerchantShopMutationLimit } from "@/lib/rate-limit";
import { merchantShopProfileSchema } from "@/lib/validation/merchant-shop";

function getTextField(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function getCoordinate(form: FormData, name: string) {
  const value = getTextField(form, name).trim();
  return value ? Number(value) : null;
}

export async function PATCH(request: Request) {
  try {
    const seller = await requireUserRole("seller");
    const limit = await checkMerchantShopMutationLimit(seller.id);
    if (!limit.allowed) return rateLimitResponse(limit, "merchant shop update");

    const formResult = await readMerchantShopFormData(request);
    if (!formResult.ok) {
      return Response.json(
        { error: formResult.error },
        { status: formResult.status },
      );
    }

    let businessHours: unknown;
    try {
      businessHours = JSON.parse(getTextField(formResult.form, "businessHours"));
    } catch {
      return Response.json(
        { error: "Business hours are invalid" },
        { status: 400 },
      );
    }

    const input = merchantShopProfileSchema.safeParse({
      name: getTextField(formResult.form, "name"),
      businessCategory: getTextField(formResult.form, "businessCategory"),
      description: getTextField(formResult.form, "description"),
      phone: getTextField(formResult.form, "phone"),
      email: getTextField(formResult.form, "email"),
      businessAddress: getTextField(formResult.form, "businessAddress"),
      country: getTextField(formResult.form, "country"),
      province: getTextField(formResult.form, "province"),
      district: getTextField(formResult.form, "district"),
      sector: getTextField(formResult.form, "sector"),
      cell: getTextField(formResult.form, "cell"),
      village: getTextField(formResult.form, "village"),
      latitude: getCoordinate(formResult.form, "latitude"),
      longitude: getCoordinate(formResult.form, "longitude"),
      businessHours,
    });
    if (!input.success) {
      return Response.json(
        {
          error: "Review the shop details and correct the highlighted fields.",
          details: input.error.flatten(),
        },
        { status: 400 },
      );
    }

    const logo = await readProductImageUpload(
      formResult.form.get("logoFile"),
      false,
    );
    if (!logo.ok) {
      return Response.json({ error: `Logo: ${logo.error}` }, { status: 400 });
    }
    const banner = await readProductImageUpload(
      formResult.form.get("bannerFile"),
      false,
    );
    if (!banner.ok) {
      return Response.json({ error: `Banner: ${banner.error}` }, { status: 400 });
    }

    const removeLogo = getTextField(formResult.form, "removeLogo") === "true";
    const removeBanner =
      getTextField(formResult.form, "removeBanner") === "true";
    if ((removeLogo && logo.image) || (removeBanner && banner.image)) {
      return Response.json(
        { error: "Choose a new image or remove the current image, not both." },
        { status: 400 },
      );
    }

    const profile = await updateMerchantShopProfile(seller, input.data, {
      ...(removeLogo
        ? { logo: null }
        : logo.image
          ? {
              logo: {
                bytes: new Uint8Array(logo.image.imageData),
                mimeType: logo.image.mimeType,
              },
            }
          : {}),
      ...(removeBanner
        ? { banner: null }
        : banner.image
          ? {
              banner: {
                bytes: new Uint8Array(banner.image.imageData),
                mimeType: banner.image.mimeType,
              },
            }
          : {}),
    });

    return Response.json(profile, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const authorizationResponse = authorizationErrorResponse(error);
    if (authorizationResponse) return authorizationResponse;
    return apiErrorResponse(
      error,
      "Failed to update merchant shop",
      "Shop details could not be saved",
    );
  }
}
