import { prisma } from "@/lib/prisma";
import { getAuthenticatedUser } from "@/lib/authorization";
import { productIdSchema } from "@/lib/validation/products";

export async function PUT(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const parsedId = productIdSchema.safeParse(id);
  if (!parsedId.success) {
    return Response.json({ error: "Invalid product ID" }, { status: 400 });
  }
  const user = await getAuthenticatedUser();
  if (!user) {
    return Response.json({ error: "Authentication required" }, { status: 401 });
  }
  const product = await prisma.product.findUnique({
    where: { id: parsedId.data },
    select: { id: true, isPublished: true },
  });
  if (!product?.isPublished) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }
  const existing = await prisma.productFavorite.findUnique({
    where: { productId_userId: { productId: product.id, userId: user.id } },
  });
  if (existing) {
    await prisma.productFavorite.delete({
      where: { id: existing.id },
    });
    return Response.json({ favorite: false }, { headers: { "Cache-Control": "no-store" } });
  }
  await prisma.productFavorite.create({
    data: { productId: product.id, userId: user.id },
  });
  return Response.json({ favorite: true }, { headers: { "Cache-Control": "no-store" } });
}
