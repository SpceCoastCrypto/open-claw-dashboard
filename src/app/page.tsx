import { getTradeLog, getState } from "@/lib/data";
import { computeStats } from "@/lib/analytics";
import { Card, Stat } from "@/components/Card";
import { EquityCurve } from "@/components/EquityCurve";
import { PnlBarChart } from "@/components/BarChart";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const [trades, state] = await Promise.all([getTradeLog(), getState()]);
  const stats = computeStats(trades);
  const positions = Object.values(state.positions || {});

  if (!stats) return <div className="text-gray-500">Loading trades...</div>;

  const symbolData = Object.entries(stats.bySymbol)
    .map(([name, s]) => ({ name, pnl: Math.round(s.pnl * 100) / 100 }))
    .sort((a, b) => b.pnl - a.pnl);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <Stat label="Total P&L" value={`$${stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl}`}
                color={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
        </Card>
        <Card>
          <Stat label="Win Rate" value={`${(stats.winRate * 100).toFixed(0)}%`}
                sub={`${stats.totalTrades} trades`} />
        </Card>
        <Card>
          <Stat label="Profit Factor" value={stats.profitFactor}
                color={stats.profitFactor >= 1 ? "text-emerald-400" : "text-red-400"} />
        </Card>
        <Card>
          <Stat label="Sharpe" value={stats.sharpe}
                color={stats.sharpe >= 1 ? "text-emerald-400" : "text-yellow-400"} />
        </Card>
        <Card>
          <Stat label="Max Drawdown" value={`$${stats.maxDrawdown}`} color="text-red-400" />
        </Card>
        <Card>
          <Stat label="VaR 95%" value={`$${stats.var95}`}
                sub="daily" color="text-yellow-400" />
        </Card>
      </div>

      <Card title={`Open Positions (${positions.length})`}>
        {positions.length === 0 ? (
          <div className="text-gray-500 text-sm">No open positions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="text-left py-2">Token</th>
                  <th className="text-left">Dir</th>
                  <th className="text-right">Entry</th>
                  <th className="text-right">SL</th>
                  <th className="text-right">TP</th>
                  <th className="text-right">Collateral</th>
                  <th className="text-right">Held</th>
                  <th className="text-left">Protocol</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} className="border-t border-gray-800">
                    <td className="py-2 font-medium">{p.symbol}</td>
                    <td className={p.direction === "long" ? "text-emerald-400" : "text-red-400"}>
                      {p.direction.toUpperCase()}
                    </td>
                    <td className="text-right">${p.entry.toFixed(2)}</td>
                    <td className="text-right text-red-400">${p.sl.toFixed(2)}</td>
                    <td className="text-right text-emerald-400">${p.tp.toFixed(2)}</td>
                    <td className="text-right">${p.collateral_usdc}</td>
                    <td className="text-right">{p.hours_held?.toFixed(1)}h</td>
                    <td className="text-gray-400">{p.protocol}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Equity Curve">
          <EquityCurve equity={stats.equity} />
        </Card>
        <Card title="P&L by Token">
          <PnlBarChart data={symbolData} />
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><Stat label="Avg Win" value={`$${stats.avgWin}`} color="text-emerald-400" /></Card>
        <Card><Stat label="Avg Loss" value={`$${stats.avgLoss}`} color="text-red-400" /></Card>
        <Card><Stat label="Expectancy" value={`$${stats.expectancy}/trade`}
              color={stats.expectancy >= 0 ? "text-emerald-400" : "text-red-400"} /></Card>
        <Card><Stat label="Loss Streak" value={`${stats.maxLossStreak} max`}
              sub={`${stats.currentLossStreak} current`} /></Card>
      </div>

      <div className="text-xs text-gray-600 text-center">
        Data refreshes every 5 minutes from GitHub repo
      </div>
    </div>
  );
}
