export const DEFAULT_COMMISSION_BASIS_POINTS = 200;
export const DEFAULT_LOW_STOCK_THRESHOLD = 3;
const BASIS_POINTS_DENOMINATOR = 10_000;

export function getCommissionBreakdown(
  basePrice: number,
  categoryBasisPoints: number | null,
  subcategoryBasisPoints: number | null,
) {
  const rateBasisPoints =
    subcategoryBasisPoints ??
    categoryBasisPoints ??
    DEFAULT_COMMISSION_BASIS_POINTS;
  const commissionAmount = Math.ceil(
    (basePrice * rateBasisPoints) / BASIS_POINTS_DENOMINATOR,
  );
  return {
    basePrice,
    rateBasisPoints,
    commissionAmount,
    customerPrice: basePrice + commissionAmount,
  };
}

export function getLowStockThreshold(
  productThreshold: number | null,
  categoryThreshold: number | null,
) {
  return (
    productThreshold ??
    categoryThreshold ??
    DEFAULT_LOW_STOCK_THRESHOLD
  );
}
