import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/authorization";
import { productIdSchema } from "@/lib/validation/products";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsedId = productIdSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid product ID" }, { status: 400 });
  }
  const product = await prisma.product.findUnique({
    where: { id: parsedId.data },
    select: { id: true, isPublished: true },
  });
  if (!product?.isPublished) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }
  const user = await getAuthenticatedUser();
  await prisma.productView.create({
    data: { productId: product.id, viewerId: user?.id ?? null },
  });
  return Response.json({ recorded: true }, { headers: { "Cache-Control": "no-store" } });
}
