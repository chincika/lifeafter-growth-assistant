export type LegacyNanoType = "nano1" | "nano2" | "nano3" | "research";
export interface LegacyNanoInput {
  type: LegacyNanoType;
  average: number;
  nano2Average: number;
  couponCost: number;
  processingGoldCost: number;
  marketPrice: number | null;
  convertNano3ProcessingCost: boolean;
}
export interface LegacyNanoMetrics { amount: number; effectiveCouponCost: number; couponRatio: number; purchaseRatio: number }
export function calculateLegacyNanoMetrics(input: LegacyNanoInput): LegacyNanoMetrics {
  for (const value of [input.average, input.nano2Average, input.couponCost, input.processingGoldCost]) if (!Number.isFinite(value) || value < 0) throw new RangeError("Nano inputs must be finite and non-negative");
  if (input.marketPrice !== null && (!Number.isFinite(input.marketPrice) || input.marketPrice < 0)) throw new RangeError("Market price must be null or non-negative");
  const amount = input.type === "research" ? (input.nano2Average > 0 ? Number((750 / input.nano2Average).toFixed(4)) : 0) : input.average;
  const effectiveCouponCost = input.type === "nano3" && input.convertNano3ProcessingCost && input.processingGoldCost > 0 ? Number((input.couponCost + input.processingGoldCost / 0.425).toFixed(1)) : input.couponCost;
  const couponRatio = input.type === "research" ? (amount > 0 && effectiveCouponCost > 0 ? Number((10_000 / (amount * effectiveCouponCost)).toFixed(5)) : 0) : (effectiveCouponCost > 0 ? Number((amount / effectiveCouponCost).toFixed(5)) : 0);
  const purchaseRatio = input.type === "research" ? (amount > 0 && (input.marketPrice ?? 0) > 0 ? Number((10_000 / (amount * input.marketPrice!)).toFixed(5)) : 0) : ((input.marketPrice ?? 0) > 0 ? Number((amount / input.marketPrice!).toFixed(5)) : 0);
  return { amount, effectiveCouponCost, couponRatio, purchaseRatio };
}
