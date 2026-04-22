import { Trade } from "./data";

export function computeStats(trades: Trade[]) {
  if (!trades.length) return null;

  const pnls = trades.map((t) => t.pnl_usdc || 0);
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p <= 0);
  const totalPnl = pnls.reduce((a, b) => a + b, 0);

  // Daily P&L
  const dailyPnl: Record<string, number> = {};
  for (const t of trades) {
    const day = (t.closed_at || "").slice(0, 10);
    if (day) dailyPnl[day] = (dailyPnl[day] || 0) + (t.pnl_usdc || 0);
  }
  const dailyValues = Object.values(dailyPnl).sort((a, b) => a - b);

  // VaR
  const var95 = dailyValues.length >= 5 ? dailyValues[Math.floor(dailyValues.length * 0.05)] : 0;

  // Sharpe
  const avgDaily = dailyValues.reduce((a, b) => a + b, 0) / (dailyValues.length || 1);
  const variance = dailyValues.reduce((a, v) => a + (v - avgDaily) ** 2, 0) / (dailyValues.length || 1);
  const stdDaily = Math.sqrt(variance) || 0.001;
  const sharpe = (avgDaily / stdDaily) * Math.sqrt(365);

  // Drawdown
  let peak = 0, maxDD = 0, running = 0;
  const equity: number[] = [];
  const sortedTrades = [...trades].sort((a, b) => (a.closed_at || "").localeCompare(b.closed_at || ""));
  for (const t of sortedTrades) {
    running += t.pnl_usdc || 0;
    equity.push(running);
    if (running > peak) peak = running;
    const dd = running - peak;
    if (dd < maxDD) maxDD = dd;
  }

  // By symbol
  const bySymbol: Record<string, { trades: number; pnl: number; wins: number; avgMfe: number }> = {};
  for (const t of trades) {
    const sym = t.symbol;
    if (!bySymbol[sym]) bySymbol[sym] = { trades: 0, pnl: 0, wins: 0, avgMfe: 0 };
    bySymbol[sym].trades++;
    bySymbol[sym].pnl += t.pnl_usdc || 0;
    bySymbol[sym].avgMfe += t["mfe_%"] || 0;
    if ((t.pnl_usdc || 0) > 0) bySymbol[sym].wins++;
  }
  for (const s of Object.values(bySymbol)) {
    s.avgMfe = s.avgMfe / s.trades;
  }

  // By direction
  const byDirection: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of trades) {
    const d = t.direction;
    if (!byDirection[d]) byDirection[d] = { trades: 0, pnl: 0, wins: 0 };
    byDirection[d].trades++;
    byDirection[d].pnl += t.pnl_usdc || 0;
    if ((t.pnl_usdc || 0) > 0) byDirection[d].wins++;
  }

  // By hour
  const byHour: Record<number, { trades: number; pnl: number; wins: number }> = {};
  for (const t of trades) {
    const h = parseInt((t.opened_at || "T00").slice(11, 13));
    if (!byHour[h]) byHour[h] = { trades: 0, pnl: 0, wins: 0 };
    byHour[h].trades++;
    byHour[h].pnl += t.pnl_usdc || 0;
    if ((t.pnl_usdc || 0) > 0) byHour[h].wins++;
  }

  // By exit reason
  const byExit: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of trades) {
    const r = t.exit_reason || "unknown";
    if (!byExit[r]) byExit[r] = { trades: 0, pnl: 0, wins: 0 };
    byExit[r].trades++;
    byExit[r].pnl += t.pnl_usdc || 0;
    if ((t.pnl_usdc || 0) > 0) byExit[r].wins++;
  }

  // Loss streak
  let maxLossStreak = 0, curStreak = 0;
  for (const t of sortedTrades) {
    if ((t.pnl_usdc || 0) <= 0) { curStreak++; maxLossStreak = Math.max(maxLossStreak, curStreak); }
    else curStreak = 0;
  }

  // Sortino ratio (penalizes downside vol only)
  const negReturns = dailyValues.filter(d => d < 0);
  const downsideVar = negReturns.length > 1
    ? negReturns.reduce((a, v) => a + v * v, 0) / negReturns.length : 0.001;
  const downsideStd = Math.sqrt(downsideVar) || 0.001;
  const sortino = (avgDaily / downsideStd) * Math.sqrt(365);

  // Calmar ratio (annualized return / max drawdown)
  const annualizedReturn = avgDaily * 365;
  const calmar = maxDD !== 0 ? Math.round((annualizedReturn / Math.abs(maxDD)) * 100) / 100 : 0;

  // Win/loss ratio
  const winLossRatio = wins.length && losses.length
    ? Math.round(((wins.reduce((a, b) => a + b, 0) / wins.length) / Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length)) * 100) / 100
    : 0;

  // Recovery factor (total PnL / max drawdown)
  const recoveryFactor = maxDD !== 0 ? Math.round((totalPnl / Math.abs(maxDD)) * 100) / 100 : 0;

  // Max win streak
  let maxWinStreak = 0, curWinStreak = 0;
  for (const t of sortedTrades) {
    if ((t.pnl_usdc || 0) > 0) { curWinStreak++; maxWinStreak = Math.max(maxWinStreak, curWinStreak); }
    else curWinStreak = 0;
  }

  // Drawdown duration (bars from peak to recovery)
  let ddStart = 0, maxDDDuration = 0, curDDDuration = 0;
  let ddPeak = 0;
  for (let i = 0; i < equity.length; i++) {
    if (equity[i] >= ddPeak) {
      ddPeak = equity[i];
      if (curDDDuration > maxDDDuration) maxDDDuration = curDDDuration;
      curDDDuration = 0;
    } else {
      curDDDuration++;
    }
  }
  if (curDDDuration > maxDDDuration) maxDDDuration = curDDDuration;

  // Avg trade duration
  const durations = trades.map(t => t.hours_held || 0).filter(h => h > 0);
  const avgDuration = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : 0;

  // Tail ratio (avg of top 10% wins / avg of bottom 10% losses)
  const sortedPnls = [...pnls].sort((a, b) => a - b);
  const bottom10 = sortedPnls.slice(0, Math.max(1, Math.floor(sortedPnls.length * 0.1)));
  const top10 = sortedPnls.slice(-Math.max(1, Math.floor(sortedPnls.length * 0.1)));
  const tailRatio = bottom10.length && top10.length
    ? Math.round((Math.abs(top10.reduce((a, b) => a + b, 0) / top10.length) / Math.abs(bottom10.reduce((a, b) => a + b, 0) / bottom10.length)) * 100) / 100
    : 0;

  return {
    totalTrades: trades.length,
    winRate: wins.length / trades.length,
    totalPnl: Math.round(totalPnl * 100) / 100,
    profitFactor: losses.length ? Math.round((wins.reduce((a, b) => a + b, 0) / Math.abs(losses.reduce((a, b) => a + b, 0))) * 100) / 100 : Infinity,
    avgWin: wins.length ? Math.round((wins.reduce((a, b) => a + b, 0) / wins.length) * 100) / 100 : 0,
    avgLoss: losses.length ? Math.round((losses.reduce((a, b) => a + b, 0) / losses.length) * 100) / 100 : 0,
    expectancy: Math.round((totalPnl / trades.length) * 100) / 100,
    var95: Math.round(var95 * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    sortino: Math.round(sortino * 100) / 100,
    calmar,
    maxDrawdown: Math.round(maxDD * 100) / 100,
    currentEquity: Math.round(running * 100) / 100,
    maxLossStreak,
    maxWinStreak,
    currentLossStreak: curStreak,
    profitableDays: dailyValues.filter((d) => d > 0).length,
    totalDays: dailyValues.length,
    winLossRatio,
    recoveryFactor,
    maxDDDuration,
    avgDuration,
    tailRatio,
    equity,
    dailyPnl,
    bySymbol,
    byDirection,
    byHour,
    byExit,
  };
}
