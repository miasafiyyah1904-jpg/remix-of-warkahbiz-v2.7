/**
 * Probabilistic sales forecast model.
 * Sinusoidal seasonal component models the cyclical wave of weekday troughs
 * and weekend peaks: S(t) = A * sin(omega * t + phi) + D
 *
 *  - D (mean) = baseline daily revenue
 *  - A (amplitude) = peak-to-trough swing / 2
 *  - omega = 2*pi / 7  (weekly period)
 *  - phi = phase shift so that Saturday is the peak
 *
 * We then return a confidence interval using a coefficient of variation (CV)
 * derived from observed sales noise (default ~12%). Weather and other
 * external multipliers can scale the mean before the CI is computed.
 */

export interface ForecastPoint {
  expected: number;         // central estimate after all multipliers
  low: number;              // lower bound of CI
  high: number;             // upper bound of CI
  probHitExpected: number;  // % chance of hitting >= expected
  confidence: number;       // % central confidence (e.g. 85)
}

const TWO_PI = Math.PI * 2;

/**
 * @param dayIndex 0=Mon .. 6=Sun (display order in Malaysia)
 * @param baseline mean daily revenue (D)
 * @param swingPct peak swing as fraction of baseline (default 0.55)
 * @param multiplier external multiplier (e.g. 0.85 for rain, 1.10 for payday)
 * @param noiseCV coefficient of variation of daily sales noise (default 0.12)
 * @param confidence central confidence band (0-1, default 0.85)
 */
export function forecastDay(
  dayIndex: number,
  baseline: number,
  swingPct = 0.55,
  multiplier = 1,
  noiseCV = 0.12,
  confidence = 0.85,
): ForecastPoint {
  // Phase shift so Saturday (index 5) is the peak of the sine wave.
  // sin reaches +1 at omega*t + phi = pi/2  →  phi = pi/2 - omega*5
  const omega = TWO_PI / 7;
  const phi = Math.PI / 2 - omega * 5;
  const seasonal = Math.sin(omega * dayIndex + phi); // -1..+1
  const A = baseline * swingPct;
  const seasonalRevenue = baseline + A * seasonal;
  const expected = Math.max(0, seasonalRevenue * multiplier);

  // z-score for two-sided central interval (rough lookup)
  const z = confidence >= 0.95 ? 1.96 : confidence >= 0.9 ? 1.645 : confidence >= 0.85 ? 1.44 : 1.28;
  const sigma = expected * noiseCV;
  const low = Math.max(0, expected - z * sigma);
  const high = expected + z * sigma;

  // Probability of meeting/beating the expected value with normal noise ≈ 50%.
  // We translate "confidence in our central call" to ~ confidence * 100, capped.
  const probHitExpected = Math.round(confidence * 100);

  return {
    expected: Math.round(expected),
    low: Math.round(low),
    high: Math.round(high),
    probHitExpected,
    confidence: Math.round(confidence * 100),
  };
}

/** Cap multiplier into a sane range so a single signal doesn't blow up the forecast. */
export const clampMultiplier = (m: number) => Math.max(0.4, Math.min(1.6, m));