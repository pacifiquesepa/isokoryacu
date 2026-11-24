import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_COMMISSION_BASIS_POINTS,
  getCommissionBreakdown,
  getLowStockThreshold,
} from "./pricing";

test("uses the default two-percent commission and rounds up to whole RWF", () => {
  assert.equal(DEFAULT_COMMISSION_BASIS_POINTS, 200);
  assert.deepEqual(getCommissionBreakdown(1_000, null, null), {
    basePrice: 1_000,
    rateBasisPoints: 200,
    commissionAmount: 20,
    customerPrice: 1_020,
  });
  assert.equal(getCommissionBreakdown(101, null, null).commissionAmount, 3);
});

test("subcategory commission overrides category and category overrides default", () => {
  assert.equal(getCommissionBreakdown(1_000, 500, null).commissionAmount, 50);
  assert.equal(getCommissionBreakdown(1_000, 500, 125).commissionAmount, 13);
  assert.equal(getCommissionBreakdown(1_000, 500, 0).customerPrice, 1_000);
});

test("low-stock threshold prefers product override, then category, then default", () => {
  assert.equal(getLowStockThreshold(null, null), 3);
  assert.equal(getLowStockThreshold(null, 8), 8);
  assert.equal(getLowStockThreshold(2, 8), 2);
  assert.equal(getLowStockThreshold(0, 8), 0);
});
