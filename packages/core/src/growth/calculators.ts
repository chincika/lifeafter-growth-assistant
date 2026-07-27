import { calculateExpectedClicks, type CriticalProgressProbabilities } from "../progression/critical-progress.js";

export interface UpgradeRangeResult { levels: number; total: number }

export function calculateUpgradeRange(costBySourceLevel: readonly number[], fromLevel: number, toLevel: number): UpgradeRangeResult {
  if (!Number.isInteger(fromLevel) || !Number.isInteger(toLevel) || fromLevel < 1 || toLevel < fromLevel || toLevel > costBySourceLevel.length + 1) {
    throw new RangeError("Invalid upgrade level range");
  }
  return { levels: toLevel - fromLevel, total: costBySourceLevel.slice(fromLevel - 1, toLevel - 1).reduce((sum, value) => sum + value, 0) };
}

export interface ProgressionLevelCost { progress: number; materialsPerClick: Readonly<Record<string, number>>; criticalAllowed?: boolean }
export interface ProgressionCostResult { deterministicClicks: number; expectedClicks: number; deterministicMaterials: Record<string, number>; expectedMaterials: Record<string, number> }

export function calculateProgressionCosts(levels: readonly ProgressionLevelCost[], probabilities: CriticalProgressProbabilities): ProgressionCostResult {
  const deterministicMaterials: Record<string, number> = {};
  const expectedMaterials: Record<string, number> = {};
  let deterministicClicks = 0;
  let expectedClicks = 0;
  for (const level of levels) {
    if (!Number.isSafeInteger(level.progress) || level.progress < 0) throw new RangeError("Progress must be a non-negative integer");
    const expected = calculateExpectedClicks(level.progress, level.criticalAllowed === false ? { bonus1Percent: 0, bonus4Percent: 0, bonus9Percent: 0 } : probabilities);
    deterministicClicks += level.progress;
    expectedClicks += expected;
    for (const [material, amount] of Object.entries(level.materialsPerClick)) {
      if (!Number.isFinite(amount) || amount < 0) throw new RangeError("Material cost must be non-negative");
      deterministicMaterials[material] = (deterministicMaterials[material] ?? 0) + amount * level.progress;
      expectedMaterials[material] = (expectedMaterials[material] ?? 0) + amount * expected;
    }
  }
  return { deterministicClicks, expectedClicks, deterministicMaterials, expectedMaterials };
}

export interface GeneProbability { multiplier: 1 | 2 | 4; percent: number }
export function calculateExpectedGeneClicks(progress: number, bonus2Percent: number, bonus4Percent: number): number {
  if (!Number.isSafeInteger(progress) || progress < 0) throw new RangeError("Gene progress must be a non-negative integer");
  for (const value of [bonus2Percent, bonus4Percent]) if (!Number.isFinite(value) || value < 0 || value > 100) throw new RangeError("Gene probabilities must be between 0 and 100");
  if (bonus2Percent + bonus4Percent > 100) throw new RangeError("Gene probabilities cannot exceed 100%");
  const probabilities: GeneProbability[] = [{ multiplier: 1, percent: 100 - bonus2Percent - bonus4Percent }, { multiplier: 2, percent: bonus2Percent }, { multiplier: 4, percent: bonus4Percent }];
  const expected = new Array<number>(progress + 1).fill(0);
  for (let remaining = 1; remaining <= progress; remaining += 1) expected[remaining] = 1 + probabilities.reduce((sum, outcome) => sum + outcome.percent / 100 * expected[Math.max(0, remaining - outcome.multiplier)]!, 0);
  return expected[progress]!;
}

export interface SimulationResult { clicks: number; progress: number; outcomes: Record<string, number>; seed: string }
export function simulateProgress(progressRequired: number, outcomes: readonly { progress: number; percent: number; label: string }[], seed: string): SimulationResult {
  if (!Number.isSafeInteger(progressRequired) || progressRequired < 0) throw new RangeError("Simulation progress must be a non-negative integer");
  const total = outcomes.reduce((sum, outcome) => sum + outcome.percent, 0);
  if (outcomes.some((outcome) => outcome.progress <= 0 || outcome.percent < 0) || Math.abs(total - 100) > 1e-9) throw new RangeError("Simulation outcomes must be positive and total 100%");
  const random = seededRandom(seed); let progress = 0; let clicks = 0; const counts: Record<string, number> = {};
  while (progress < progressRequired) {
    const roll = random() * 100; let cursor = 0; let selected = outcomes[outcomes.length - 1]!;
    for (const outcome of outcomes) { cursor += outcome.percent; if (roll < cursor) { selected = outcome; break; } }
    progress += selected.progress; clicks += 1; counts[selected.label] = (counts[selected.label] ?? 0) + 1;
  }
  return { clicks, progress, outcomes: counts, seed };
}
function seededRandom(seed: string): () => number {
  let state = 2166136261;
  for (let index = 0; index < seed.length; index += 1) { state ^= seed.charCodeAt(index); state = Math.imul(state, 16777619); }
  return () => { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
}

export interface ReformationStage { clicks: number; moleculePerClick: number; nano3PerClick: number; goldPerClick: number; promotionMolecule: number; promotionNano3: number; promotionGold: number }
export function calculateReformationCosts(stages: readonly ReformationStage[]) {
  return stages.reduce((total, stage) => ({
    clicks: total.clicks + stage.clicks + 1,
    molecule: total.molecule + stage.clicks * stage.moleculePerClick + stage.promotionMolecule,
    nano3: total.nano3 + stage.clicks * stage.nano3PerClick + stage.promotionNano3,
    gold: total.gold + stage.clicks * stage.goldPerClick + stage.promotionGold,
  }), { clicks: 0, molecule: 0, nano3: 0, gold: 0 });
}
