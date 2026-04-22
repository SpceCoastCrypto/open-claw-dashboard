import { getTradeLog } from "@/lib/data";
import { computeStats } from "@/lib/analytics";
import { Card, Stat } from "@/components/Card";
import { PnlBarChart } from "@/components/BarChart";
import { EquityCurve } from "@/components/EquityCurve";
import { healthColor, healthEmoji } from "@/components/HealthIndicator";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const trades = await getTradeLog();
  const stats = computeStats(trades);
  if (!stats) return <div className="text-gray-500">Loading...</div>;

  const dirData = Object.entries(stats.byDirection).map(([name, s]) => ({
    name, pnl: Math.round(s.pnl * 100) / 100,
  }));

  const hourData = Object.entries(stats.byHour)
    .map(([h, s]) => ({ name: `${h}:00`, pnl: Math.round(s.pnl * 100) / 100 }))
    .sort((a, b) => parseInt(a.name) - parseInt(b.name));

  const exitData = Object.entries(stats.byExit)
    .map(([name, s]) => ({ name: name.replace("trigger_", "t_"), pnl: Math.round(s.pnl * 100) / 100 }))
    .sort((a, b) => b.pnl - a.pnl);

  const symbolData = Object.entries(stats.bySymbol)
    .map(([name, s]) => ({ name, pnl: Math.round(s.pnl * 100) / 100 }))
    .sort((a, b) => b.pnl - a.pnl);

  // Compute weekly P&L for trend chart
  const weeklyPnl: Record<string, number> = {};
  for (const t of trades) {
    const d = new Date(t.closed_at || "");
    const week = `W${Math.ceil(d.getDate() / 7)}`;
    const key = `${(t.closed_at || "").slice(5, 7)}-${week}`;
    weeklyPnl[key] = (weeklyPnl[key] || 0) + (t.pnl_usdc || 0);
  }
  const weeklyData = Object.entries(weeklyPnl).map(([name, pnl]) => ({
    name, pnl: Math.round(pnl * 100) / 100,
  }));

  // Rolling win rate (last 20 trades)
  const rollingWR: number[] = [];
  const sortedTrades = [...trades].sort((a, b) => (a.closed_at || "").localeCompare(b.closed_at || ""));
  for (let i = 19; i < sortedTrades.length; i++) {
    const window = sortedTrades.slice(i - 19, i + 1);
    const wr = window.filter(t => (t.pnl_usdc || 0) > 0).length / window.length;
    rollingWR.push(Math.round(wr * 100));
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><Stat label="Total PnL" value={`$${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl}`}
              color={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} /></Card>
        <Card><Stat label="Win Rate" value={`${(stats.winRate * 100).toFixed(0)}%`}
              color={healthColor("winRate", stats.winRate)}
              sub={`${stats.totalTrades} trades`} /></Card>
        <Card><Stat label="Profit Factor" value={stats.profitFactor}
              color={healthColor("profitFactor", stats.profitFactor)} /></Card>
        <Card><Stat label="Avg Win" value={`$${stats.avgWin}`} color="text-emerald-400" /></Card>
        <Card><Stat label="Avg Loss" value={`$${stats.avgLoss}`} color="text-red-400" /></Card>
      </div>

      {/* Token performance table */}
      <Card title="Performance by Token">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase">
                <th className="text-left py-2 pr-4">Token</th>
                <th className="text-right px-3">Trades</th>
                <th className="text-right px-3">Wins</th>
                <th className="text-right px-3">WR</th>
                <th className="text-right px-3">PnL</th>
                <th className="text-right px-3">Avg MFE</th>
                <th className="text-right px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.bySymbol)
                .sort(([, a], [, b]) => b.pnl - a.pnl)
                .map(([sym, s]) => {
                  const wr = s.trades > 0 ? s.wins / s.trades : 0;
                  return (
                    <tr key={sym} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="py-2 pr-4 font-medium">{sym}</td>
                      <td className="text-right px-3">{s.trades}</td>
                      <td className="text-right px-3">{s.wins}</td>
                      <td className={`text-right px-3 ${healthColor("winRate", wr)}`}>
                        {(wr * 100).toFixed(0)}%
                      </td>
                      <td className={`text-right px-3 font-medium ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${s.pnl.toFixed(2)}
                      </td>
                      <td className="text-right px-3 text-gray-400">{s.avgMfe.toFixed(2)}%</td>
                      <td className="text-right px-3">{healthEmoji("winRate", wr)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Charts row 1 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="P&L by Token">
          <PnlBarChart data={symbolData} />
        </Card>
        <Card title="P&L by Direction">
          <PnlBarChart data={dirData} />
        </Card>
      </div>

      {/* Charts row 2 */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="P&L by Exit Reason">
          <PnlBarChart data={exitData} />
        </Card>
        <Card title="Weekly P&L Trend">
          <PnlBarChart data={weeklyData} />
        </Card>
      </div>

      {/* Time of day */}
      <Card title="P&L by Hour (UTC)">
        <PnlBarChart data={hourData} />
      </Card>

      {/* Hour heatmap */}
      <Card title="Win Rate by Hour (UTC) — 🟢 >55% | 🔴 <35%">
        <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {Object.entries(stats.byHour)
            .sort(([a], [b]) => parseInt(a) - parseInt(b))
            .map(([h, s]) => {
              const wr = s.wins / s.trades;
              const bg = wr > 0.55 ? "bg-emerald-900/40 border border-emerald-800"
                : wr < 0.35 ? "bg-red-900/40 border border-red-800"
                : "bg-gray-800/40 border border-gray-700";
              return (
                <div key={h} className={`${bg} rounded-lg p-2 text-center text-xs`}>
                  <div className="text-gray-400">{h}:00</div>
                  <div className={`font-bold text-lg ${wr > 0.55 ? "text-emerald-400" : wr < 0.35 ? "text-red-400" : "text-white"}`}>
                    {(wr * 100).toFixed(0)}%
                  </div>
                  <div className={s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}>
                    ${s.pnl.toFixed(0)}
                  </div>
                  <div className="text-gray-600">{s.trades}T</div>
                </div>
              );
            })}
        </div>
      </Card>

      {/* Rolling win rate */}
      {rollingWR.length > 5 && (
        <Card title="Rolling Win Rate (20-trade window)">
          <EquityCurve equity={rollingWR} />
        </Card>
      )}

      {/* Exit reason breakdown */}
      <Card title="Performance by Exit Reason">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase">
                <th className="text-left py-2 pr-4">Exit Reason</th>
                <th className="text-right px-3">Trades</th>
                <th className="text-right px-3">Wins</th>
                <th className="text-right px-3">WR</th>
                <th className="text-right px-3">PnL</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byExit)
                .sort(([, a], [, b]) => b.pnl - a.pnl)
                .map(([reason, s]) => {
                  const wr = s.trades > 0 ? s.wins / s.trades : 0;
                  return (
                    <tr key={reason} className="border-t border-gray-800">
                      <td className="py-1.5 pr-4 text-gray-300">{reason}</td>
                      <td className="text-right px-3">{s.trades}</td>
                      <td className="text-right px-3">{s.wins}</td>
                      <td className="text-right px-3">{(wr * 100).toFixed(0)}%</td>
                      <td className={`text-right px-3 font-medium ${s.pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        ${s.pnl.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
