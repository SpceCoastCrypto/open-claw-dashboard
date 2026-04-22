import { getTradeLog, getWalkForwardReport } from "@/lib/data";
import { computeStats } from "@/lib/analytics";
import { Card, Stat } from "@/components/Card";
import { EquityCurve } from "@/components/EquityCurve";
import { PnlBarChart } from "@/components/BarChart";
import { healthColor, healthBg, healthEmoji } from "@/components/HealthIndicator";

export const dynamic = "force-dynamic";

export default async function RiskPage() {
  const [trades, wfReport] = await Promise.all([getTradeLog(), getWalkForwardReport()]);
  const stats = computeStats(trades);
  const recommendations = wfReport?.recommendations || [];
  if (!stats) return <div className="text-gray-500">Loading...</div>;

  const dailyData = Object.entries(stats.dailyPnl)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, pnl]) => ({ name: day.slice(5), pnl: Math.round(pnl * 100) / 100 }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Risk Management</h1>

      {/* Health Summary — at-a-glance status */}
      <Card title="Health Check" className={healthBg("sharpe", stats.sharpe)}>
        <div className="grid grid-cols-4 md:grid-cols-8 gap-3 text-center text-xs">
          {[
            ["Sharpe", "sharpe", stats.sharpe],
            ["Sortino", "sortino", stats.sortino],
            ["PF", "profitFactor", stats.profitFactor],
            ["WR", "winRate", stats.winRate],
            ["W/L", "winLossRatio", stats.winLossRatio],
            ["Tail", "tailRatio", stats.tailRatio],
            ["DD", "maxDrawdown", stats.maxDrawdown],
            ["Streak", "currentLossStreak", stats.currentLossStreak],
          ].map(([label, metric, value]) => (
            <div key={label as string}>
              <div className="text-gray-500">{label as string}</div>
              <div className="text-lg font-bold">
                {healthEmoji(metric as string, value as number)}
              </div>
              <div className={healthColor(metric as string, value as number)}>
                {typeof value === "number" && Math.abs(value) < 100
                  ? (value as number).toFixed(2)
                  : `$${value}`}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Auto-recommendations */}
      {recommendations.length > 0 && (
        <Card title={`🔧 ${recommendations.length} Recommendations (auto-generated from live data)`}>
          <div className="space-y-3">
            {recommendations
              .sort((a: { confidence: number }, b: { confidence: number }) => b.confidence - a.confidence)
              .map((r: { type: string; current: string; suggested: string; evidence: string; confidence: number }, i: number) => {
                const bg = r.confidence >= 80 ? "border-l-4 border-red-500 bg-red-900/10"
                  : r.confidence >= 60 ? "border-l-4 border-yellow-500 bg-yellow-900/10"
                  : "border-l-4 border-gray-600 bg-gray-800/30";
                const badge = r.confidence >= 80 ? "bg-red-900/40 text-red-400"
                  : r.confidence >= 60 ? "bg-yellow-900/40 text-yellow-400"
                  : "bg-gray-800 text-gray-400";
                return (
                  <div key={i} className={`${bg} rounded-lg p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge}`}>
                        {r.confidence}% confidence
                      </span>
                      <span className="text-xs text-gray-500 uppercase">{r.type}</span>
                    </div>
                    <div className="text-sm text-gray-400">Current: {r.current}</div>
                    <div className="text-sm text-white font-medium">Suggested: {r.suggested}</div>
                    <div className="text-xs text-gray-500 mt-1">Evidence: {r.evidence}</div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {recommendations.length === 0 && (
        <Card>
          <div className="text-emerald-400 text-center py-4">
            ✅ All settings optimized — no recommendations
          </div>
        </Card>
      )}

      {/* Risk-adjusted returns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={healthBg("sharpe", stats.sharpe)}>
          <Stat label="Sharpe (ann.)" value={stats.sharpe}
              color={healthColor("sharpe", stats.sharpe)}
              sub="return / total vol" /></Card>
        <Card className={healthBg("sortino", stats.sortino)}>
          <Stat label="Sortino (ann.)" value={stats.sortino}
              color={healthColor("sortino", stats.sortino)}
              sub="return / downside vol" /></Card>
        <Card className={healthBg("calmar", stats.calmar)}>
          <Stat label="Calmar" value={stats.calmar}
              color={healthColor("calmar", stats.calmar)}
              sub="ann. return / max DD" /></Card>
        <Card className={healthBg("recoveryFactor", stats.recoveryFactor)}>
          <Stat label="Recovery Factor" value={stats.recoveryFactor}
              color={healthColor("recoveryFactor", stats.recoveryFactor)}
              sub="total PnL / max DD" /></Card>
      </div>

      {/* Drawdown metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={healthBg("maxDrawdown", stats.maxDrawdown)}>
          <Stat label="Max Drawdown" value={`$${stats.maxDrawdown}`}
              color={healthColor("maxDrawdown", stats.maxDrawdown)} /></Card>
        <Card><Stat label="DD Duration" value={`${stats.maxDDDuration} trades`}
              sub="longest peak-to-recovery" color="text-yellow-400" /></Card>
        <Card className={healthBg("var95", stats.var95)}>
          <Stat label="VaR 95% (daily)" value={`$${stats.var95}`}
              color={healthColor("var95", stats.var95)} /></Card>
        <Card><Stat label="Current Equity" value={`$${stats.currentEquity}`}
              color={stats.currentEquity >= 0 ? "text-emerald-400" : "text-red-400"} /></Card>
      </div>

      {/* Trade quality */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={healthBg("profitFactor", stats.profitFactor)}>
          <Stat label="Profit Factor" value={stats.profitFactor}
              color={healthColor("profitFactor", stats.profitFactor)} /></Card>
        <Card className={healthBg("winLossRatio", stats.winLossRatio)}>
          <Stat label="Win/Loss Ratio" value={stats.winLossRatio}
              sub="avg win / avg loss" color={healthColor("winLossRatio", stats.winLossRatio)} /></Card>
        <Card className={healthBg("tailRatio", stats.tailRatio)}>
          <Stat label="Tail Ratio" value={stats.tailRatio}
              sub="top 10% / bottom 10%" color={healthColor("tailRatio", stats.tailRatio)} /></Card>
        <Card className={healthBg("expectancy", stats.expectancy)}>
          <Stat label="Expectancy" value={`$${stats.expectancy}`}
              sub="per trade" color={healthColor("expectancy", stats.expectancy)} /></Card>
      </div>

      {/* Trade statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><Stat label="Avg Win" value={`$${stats.avgWin}`} color="text-emerald-400" /></Card>
        <Card><Stat label="Avg Loss" value={`$${stats.avgLoss}`} color="text-red-400" /></Card>
        <Card><Stat label="Avg Duration" value={`${stats.avgDuration}h`} /></Card>
        <Card className={healthBg("profitableDaysPct", stats.profitableDays / stats.totalDays * 100)}>
          <Stat label="Profitable Days" value={`${stats.profitableDays}/${stats.totalDays}`}
              sub={`${(stats.profitableDays / stats.totalDays * 100).toFixed(0)}%`}
              color={healthColor("profitableDaysPct", stats.profitableDays / stats.totalDays * 100)} /></Card>
      </div>

      {/* Streaks */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><Stat label="Max Win Streak" value={stats.maxWinStreak} color="text-emerald-400" /></Card>
        <Card className={healthBg("maxLossStreak", stats.maxLossStreak)}>
          <Stat label="Max Loss Streak" value={stats.maxLossStreak}
              color={healthColor("maxLossStreak", stats.maxLossStreak)} /></Card>
        <Card className={healthBg("currentLossStreak", stats.currentLossStreak)}>
          <Stat label="Current Loss Streak" value={stats.currentLossStreak}
              color={healthColor("currentLossStreak", stats.currentLossStreak)} /></Card>
        <Card><Stat label="Total Trades" value={stats.totalTrades} /></Card>
      </div>

      {/* Charts */}
      <Card title="Equity Curve (cumulative P&L)">
        <EquityCurve equity={stats.equity} />
      </Card>

      <Card title="Daily P&L">
        <PnlBarChart data={dailyData} />
      </Card>

      {/* Kill switches status */}
      <Card title="Kill Switches">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="bg-gray-800/30 rounded-lg p-3 text-center">
            <div className="text-gray-400">Daily Loss Limit</div>
            <div className="text-xl font-bold text-white">-$75</div>
            <div className="text-xs text-gray-500">1.9% of portfolio</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3 text-center">
            <div className="text-gray-400">Max Positions</div>
            <div className="text-xl font-bold text-white">6</div>
            <div className="text-xs text-gray-500">across all tokens</div>
          </div>
          <div className="bg-gray-800/30 rounded-lg p-3 text-center">
            <div className="text-gray-400">Max Crypto</div>
            <div className="text-xl font-bold text-white">2</div>
            <div className="text-xs text-gray-500">SOL/WBTC/WETH</div>
          </div>
        </div>
      </Card>

      {/* Position sizing stack */}
      <Card title="Position Sizing Stack — min(reducers) × ML boost (not multiplicative)">
        <div className="text-xs text-gray-500 mb-3">
          Reducers compete — the deepest applies once. ML boost multiplies on top for high-conviction scores.
          Changed 2026-04-20 from multiplicative (which collapsed sizes to ~$0) to min-of-reducers.
        </div>
        <div className="text-sm space-y-1">
          {[
            ["Base position", "$800 (20% × $4,000)", ""],
            ["— Hard gates (trade blocked) —", "", "text-gray-500"],
            ["ML score < 0.35", "BLOCK", "text-red-400"],
            ["Weekend shorts", "BLOCK", "text-red-400"],
            ["14:00 UTC (US equity open)", "BLOCK", "text-red-400"],
            ["— Size reducers (min applies) —", "", "text-gray-500"],
            ["Weekly drawdown (≤ -$150)", "floor 0.25×", "text-yellow-400"],
            ["Macro event (< 4h)", "floor 0.25×", "text-yellow-400"],
            ["Crypto concentration (2+ open)", "floor 0.50×", "text-yellow-400"],
            ["Weekend longs", "floor 0.50×", "text-yellow-400"],
            ["16:00-23:59 UTC", "floor 0.50×", "text-yellow-400"],
            ["Macro event (< 12h)", "floor 0.50×", "text-yellow-400"],
            ["Choppy regime", "floor 0.50×", "text-yellow-400"],
            ["Trending regime", "floor 0.50×", "text-yellow-400"],
            ["3+ loss streak", "floor 0.50×", "text-yellow-400"],
            ["2 loss streak", "floor 0.75×", "text-yellow-400"],
            ["Signal confidence", "floor 0.50–1.00×", "text-yellow-400"],
            ["— ML boost (stacks on top) —", "", "text-gray-500"],
            ["ML score 0.35 – 0.55", "1.00× (baseline)", "text-gray-300"],
            ["ML score 0.55 – 0.70", "1.50× boost", "text-emerald-400"],
            ["ML score ≥ 0.70", "1.75× boost", "text-emerald-400"],
          ].map(([label, value, color]) => (
            <div key={label} className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">{label}</span>
              <span className={color || "text-white"}>{value}</span>
            </div>
          ))}
          <div className="flex justify-between py-2 mt-2 text-xs text-gray-500">
            <span>Worst case (no block hit)</span>
            <span>$800 × 0.25 = $200 (no boost)</span>
          </div>
          <div className="flex justify-between text-xs text-gray-500">
            <span>Best case (top-bucket ML, no reducers)</span>
            <span>$800 × 1.75 = $1,400</span>
          </div>
        </div>
      </Card>

      {/* Metric explanations */}
      <Card title="Metric Guide">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-gray-400">
          <div><strong className="text-gray-300">Sharpe:</strong> Return per unit of total volatility. &gt;1 = good, &gt;2 = excellent</div>
          <div><strong className="text-gray-300">Sortino:</strong> Like Sharpe but only penalizes downside vol. Better for asymmetric strategies</div>
          <div><strong className="text-gray-300">Calmar:</strong> Annualized return / max drawdown. &gt;1 = recovering faster than drawing down</div>
          <div><strong className="text-gray-300">Recovery Factor:</strong> Total PnL / max drawdown. &gt;1 = fully recovered from worst drawdown</div>
          <div><strong className="text-gray-300">Win/Loss Ratio:</strong> Average win size / average loss size. &gt;1 = wins are bigger than losses</div>
          <div><strong className="text-gray-300">Tail Ratio:</strong> Top 10% wins / bottom 10% losses. &gt;1 = positive skew (big wins &gt; big losses)</div>
          <div><strong className="text-gray-300">VaR 95%:</strong> Maximum daily loss expected 95% of the time</div>
          <div><strong className="text-gray-300">DD Duration:</strong> Longest stretch (in trades) from equity peak to recovery</div>
        </div>
      </Card>
    </div>
  );
}
