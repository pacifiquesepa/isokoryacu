import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { createCustomerAccount } from "@/lib/data-access/users";
import { parseJsonRequest } from "@/lib/http/parse-json-request";
import { rateLimitResponse } from "@/lib/http/rate-limit-response";
import {
  checkRegistrationRateLimit,
  getClientIp,
} from "@/lib/rate-limit";
import { registerSchema } from "@/lib/validation/auth";

const registrationResponse = {
  message: "If you already have an account, please sign in. Otherwise, registration is complete.",
};

export async function POST(request: Request) {
  const ipAddress = getClientIp(
    request.headers.get("x-real-ip"),
    request.headers.get("x-forwarded-for"),
  );

  try {
    const rateLimit = await checkRegistrationRateLimit(ipAddress);
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, "registration");
    }

    const parsedBody = await parseJsonRequest(request, registerSchema, 4096);
    if (!parsedBody.success) return parsedBody.response;

    const passwordHash = await bcrypt.hash(parsedBody.data.password, 12);
    try {
      await createCustomerAccount({
        name: parsedBody.data.name,
        email: parsedBody.data.email,
        phone: parsedBody.data.phone,
        passwordHash,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return Response.json(registrationResponse);
      }
      throw error;
    }

    return Response.json(registrationResponse);
  } catch (error) {
    console.error("User registration failed", error);
    return Response.json(
      { error: "Registration is temporarily unavailable" },
      { status: 500 },
    );
  }
}
