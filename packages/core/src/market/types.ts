export type LegacyResourceType = number;

export interface LegacyIngredient {
  name: string;
  quantity: number;
  /**
   * Legacy `exchangeable` behavior. When true, the ingredient is expanded
   * recursively; when false, its direct market price is used as gold cost.
   */
  expandRecipe: boolean;
}

export interface LegacyMarketItem {
  name: string;
  resourceType: LegacyResourceType;
  resourceLevel: number;
  marketPrice: number;
  couponCost: number;
  ingredients: readonly LegacyIngredient[];
}

export interface AcquisitionCost {
  couponCost: number;
  goldCost: number;
}

export interface MarketEarnings {
  afterTaxRevenue: number;
  acquisition: AcquisitionCost;
  netProfit: number;
  couponYieldPercent: number;
  expectedNetProfit: number;
  expectedCouponYieldPercent: number;
}

export interface MarketCalculationOptions {
  taxRate: number;
  /** Legacy semi-finished-product bonus percentage. */
  productionBonusPercent?: number;
}
