export interface CriticalProgressProbabilities {
  bonus1Percent: number;
  bonus4Percent: number;
  bonus9Percent: number;
}

export interface NormalizedCriticalProgressProbabilities
  extends CriticalProgressProbabilities {
  noBonusPercent: number;
}

const OUTCOMES = [
  { bonus: 0, probabilityKey: "noBonusPercent" },
  { bonus: 1, probabilityKey: "bonus1Percent" },
  { bonus: 4, probabilityKey: "bonus4Percent" },
  { bonus: 9, probabilityKey: "bonus9Percent" },
] as const;

export function normalizeCriticalProgressProbabilities(
  probabilities: CriticalProgressProbabilities,
): NormalizedCriticalProgressProbabilities {
  for (const [name, value] of Object.entries(probabilities)) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new RangeError(`${name} must be between 0 and 100`);
    }
  }

  const criticalPercent =
    probabilities.bonus1Percent +
    probabilities.bonus4Percent +
    probabilities.bonus9Percent;
  if (criticalPercent > 100) {
    throw new RangeError("Critical progress probabilities cannot exceed 100%");
  }

  return {
    ...probabilities,
    noBonusPercent: 100 - criticalPercent,
  };
}

/**
 * Calculates the exact expected click count for one level.
 *
 * Every click grants one base progress plus a bonus of 0, 1, 4, or 9.
 * Progress that overshoots the target is intentionally discarded, matching
 * the legacy level-by-level behavior without relying on Math.random().
 */
export function calculateExpectedClicks(
  progressRequired: number,
  probabilities: CriticalProgressProbabilities,
): number {
  if (!Number.isSafeInteger(progressRequired) || progressRequired < 0) {
    throw new RangeError("progressRequired must be a non-negative safe integer");
  }
  if (progressRequired === 0) return 0;

  const normalized = normalizeCriticalProgressProbabilities(probabilities);
  const expectedByRemaining = new Array<number>(progressRequired + 1).fill(0);

  for (let remaining = 1; remaining <= progressRequired; remaining += 1) {
    let expectedAfterClick = 0;
    for (const outcome of OUTCOMES) {
      const probability = normalized[outcome.probabilityKey] / 100;
      const progress = 1 + outcome.bonus;
      expectedAfterClick +=
        probability * expectedByRemaining[Math.max(0, remaining - progress)]!;
    }
    expectedByRemaining[remaining] = 1 + expectedAfterClick;
  }

  return expectedByRemaining[progressRequired]!;
}

export function calculateExpectedClicksForLevels(
  progressByLevel: readonly number[],
  probabilities: CriticalProgressProbabilities,
  levelsWithoutCriticalProgress: ReadonlySet<number> = new Set(),
): number {
  const noCriticalProgress: CriticalProgressProbabilities = {
    bonus1Percent: 0,
    bonus4Percent: 0,
    bonus9Percent: 0,
  };

  return progressByLevel.reduce(
    (total, progressRequired, levelIndex) =>
      total +
      calculateExpectedClicks(
        progressRequired,
        levelsWithoutCriticalProgress.has(levelIndex)
          ? noCriticalProgress
          : probabilities,
      ),
    0,
  );
}
