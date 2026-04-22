/**
 * Color-coded health indicator with institutional-standard thresholds.
 * Green = healthy, Yellow = watch, Red = action needed.
 */

export function healthColor(metric: string, value: number): string {
  const thresholds: Record<string, { green: [number, number]; yellow: [number, number] }> = {
    sharpe:          { green: [1, Infinity],  yellow: [0.5, 1] },       // <0.5 = red
    sortino:         { green: [1.5, Infinity], yellow: [0.75, 1.5] },   // <0.75 = red
    calmar:          { green: [1, Infinity],  yellow: [0.5, 1] },
    profitFactor:    { green: [1.2, Infinity], yellow: [1, 1.2] },      // <1 = losing money
    winRate:         { green: [0.5, 1],       yellow: [0.4, 0.5] },     // <40% = red
    recoveryFactor:  { green: [1, Infinity],  yellow: [0.5, 1] },
    winLossRatio:    { green: [1.2, Infinity], yellow: [0.8, 1.2] },
    tailRatio:       { green: [1, Infinity],  yellow: [0.7, 1] },
    expectancy:      { green: [0.5, Infinity], yellow: [0, 0.5] },      // <0 = red
    maxDrawdown:     { green: [-50, 0],       yellow: [-100, -50] },     // < -100 = red
    maxLossStreak:   { green: [0, 4],         yellow: [4, 7] },          // >7 = red
    currentLossStreak: { green: [0, 2],       yellow: [2, 4] },          // >4 = red
    var95:           { green: [-20, 0],       yellow: [-40, -20] },      // < -40 = red
    profitableDaysPct: { green: [50, 100],    yellow: [35, 50] },        // <35% = red
  };

  const t = thresholds[metric];
  if (!t) return "text-white";

  if (value >= t.green[0] && value <= t.green[1]) return "text-emerald-400";
  if (value >= t.yellow[0] && value <= t.yellow[1]) return "text-yellow-400";
  return "text-red-400";
}

export function healthBg(metric: string, value: number): string {
  const color = healthColor(metric, value);
  if (color === "text-emerald-400") return "border-l-4 border-emerald-500";
  if (color === "text-yellow-400") return "border-l-4 border-yellow-500";
  return "border-l-4 border-red-500";
}

export function healthEmoji(metric: string, value: number): string {
  const color = healthColor(metric, value);
  if (color === "text-emerald-400") return "🟢";
  if (color === "text-yellow-400") return "🟡";
  return "🔴";
}
