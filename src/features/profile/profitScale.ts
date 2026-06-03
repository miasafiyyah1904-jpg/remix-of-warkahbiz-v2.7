// Maps a 1-10 profit scale to a price multiplier applied to (cost/unit + packaging).
// 1-3: Low margin (competitive / high volume)
// 4-7: Standard margin (balanced)
// 8-10: Premium margin (handmade / luxury)
export const SCALE_MULTIPLIERS: Record<number, number> = {
  1: 1.15,
  2: 1.25,
  3: 1.35,
  4: 1.50,
  5: 1.65,
  6: 1.85,
  7: 2.05,
  8: 2.30,
  9: 2.60,
  10: 3.00,
};

export function multiplierFor(scale: number): number {
  const s = Math.min(10, Math.max(1, Math.round(scale)));
  return SCALE_MULTIPLIERS[s];
}

export type ScaleTier = "low" | "standard" | "premium";
export function tierFor(scale: number): ScaleTier {
  if (scale <= 3) return "low";
  if (scale <= 7) return "standard";
  return "premium";
}

export function tierLabelKey(scale: number): "scaleLow" | "scaleStandard" | "scalePremium" {
  const t = tierFor(scale);
  return t === "low" ? "scaleLow" : t === "standard" ? "scaleStandard" : "scalePremium";
}
