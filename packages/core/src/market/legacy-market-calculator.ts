import type {
  AcquisitionCost,
  LegacyMarketItem,
  MarketCalculationOptions,
  MarketEarnings,
} from "./types.js";

const LEGACY_RAW_RESOURCE_TYPE_MAX = 4;
const LEGACY_SEMI_FINISHED_RESOURCE_TYPE = 5;

export class MarketDataError extends Error {
  constructor(
    message: string,
    readonly code: "DUPLICATE_ITEM" | "MISSING_ITEM" | "RECIPE_CYCLE",
    readonly path: readonly string[],
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function createLegacyMarketIndex(
  items: readonly LegacyMarketItem[],
): ReadonlyMap<string, LegacyMarketItem> {
  const index = new Map<string, LegacyMarketItem>();

  for (const item of items) {
    if (index.has(item.name)) {
      throw new MarketDataError(
        `Duplicate market item: ${item.name}`,
        "DUPLICATE_ITEM",
        [item.name],
      );
    }
    index.set(item.name, item);
  }

  return index;
}

export function calculateLegacyAcquisitionCost(
  itemName: string,
  items: ReadonlyMap<string, LegacyMarketItem>,
): AcquisitionCost {
  const memo = new Map<string, AcquisitionCost>();

  function visit(name: string, path: readonly string[]): AcquisitionCost {
    const cached = memo.get(name);
    if (cached) return cached;

    if (path.includes(name)) {
      const cycleStart = path.indexOf(name);
      const cycle = [...path.slice(cycleStart), name];
      throw new MarketDataError(
        `Recipe cycle detected: ${cycle.join(" -> ")}`,
        "RECIPE_CYCLE",
        cycle,
      );
    }

    const item = items.get(name);
    if (!item) {
      throw new MarketDataError(
        `Missing market item: ${name}`,
        "MISSING_ITEM",
        [...path, name],
      );
    }

    if (item.resourceType <= LEGACY_RAW_RESOURCE_TYPE_MAX) {
      const result = { couponCost: item.couponCost, goldCost: 0 };
      memo.set(name, result);
      return result;
    }

    let couponCost = 0;
    let goldCost = 0;
    const nextPath = [...path, name];

    for (const ingredient of item.ingredients) {
      const child = items.get(ingredient.name);
      if (!child) {
        throw new MarketDataError(
          `Missing ingredient ${ingredient.name} used by ${name}`,
          "MISSING_ITEM",
          [...nextPath, ingredient.name],
        );
      }

      if (ingredient.expandRecipe) {
        const childCost = visit(ingredient.name, nextPath);
        couponCost += ingredient.quantity * childCost.couponCost;
        goldCost += ingredient.quantity * childCost.goldCost;
      } else {
        goldCost += ingredient.quantity * child.marketPrice;
      }
    }

    const result = { couponCost, goldCost };
    memo.set(name, result);
    return result;
  }

  return visit(itemName, []);
}

export function calculateLegacyMarketEarnings(
  item: LegacyMarketItem,
  items: ReadonlyMap<string, LegacyMarketItem>,
  options: MarketCalculationOptions,
): MarketEarnings {
  assertFiniteRange("taxRate", options.taxRate, 0, 1);
  const productionBonusPercent = options.productionBonusPercent ?? 0;
  assertFiniteRange("productionBonusPercent", productionBonusPercent, 0, 10_000);

  const afterTaxRevenue = roundInteger(item.marketPrice * (1 - options.taxRate));
  const acquisition =
    item.resourceType <= LEGACY_RAW_RESOURCE_TYPE_MAX
      ? { couponCost: item.couponCost, goldCost: 0 }
      : calculateLegacyAcquisitionCost(item.name, items);
  const netProfit = afterTaxRevenue - acquisition.goldCost;
  const couponYieldPercent = yieldPercent(netProfit, item.marketPrice, acquisition.couponCost);

  const hasProductionBonus =
    productionBonusPercent >= 1 &&
    item.resourceType === LEGACY_SEMI_FINISHED_RESOURCE_TYPE;
  const expectedNetProfit = hasProductionBonus
    ? roundDecimal(
        item.marketPrice *
          (1 - options.taxRate) *
          ((100 + productionBonusPercent) / 100) -
          acquisition.goldCost,
        2,
      )
    : 0;
  const expectedCouponYieldPercent = hasProductionBonus
    ? yieldPercent(expectedNetProfit, item.marketPrice, acquisition.couponCost)
    : 0;

  return {
    afterTaxRevenue,
    acquisition,
    netProfit,
    couponYieldPercent,
    expectedNetProfit,
    expectedCouponYieldPercent,
  };
}

function yieldPercent(profit: number, price: number, couponCost: number): number {
  if (price === 0 || couponCost === 0) return 0;
  return roundDecimal((profit / couponCost) * 100, 2);
}

function roundInteger(value: number): number {
  return Number(value.toFixed(0));
}

function roundDecimal(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function assertFiniteRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
}
