import { getTradeLog, getShadowLog, matchTradeToShadow } from "@/lib/data";
import { Card, Stat } from "@/components/Card";

export const dynamic = "force-dynamic";

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null || score === undefined) {
    return <span className="text-gray-600">--</span>;
  }
  const pct = Math.round(score * 100);
  let color = "text-gray-400 bg-gray-800";
  if (score >= 0.5) color = "text-emerald-400 bg-emerald-900/30";
  else if (score >= 0.35) color = "text-yellow-400 bg-yellow-900/30";
  else color = "text-red-400 bg-red-900/30";

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${color}`}>
      {pct}%
    </span>
  );
}

function SizingLabel({ score }: { score: number | null }) {
  if (score === null || score === undefined) return null;
  if (score >= 0.5) return <span className="text-emerald-600 text-[10px]">full</span>;
  if (score >= 0.35) return <span className="text-yellow-600 text-[10px]">75%</span>;
  return <span className="text-red-600 text-[10px]">50%</span>;
}

export default async function TradesPage() {
  const trades = await getTradeLog();
  const shadowLog = await getShadowLog();
  const sorted = [...trades].sort((a, b) => (b.closed_at || "").localeCompare(a.closed_at || ""));

  // ML score stats
  const scored = sorted.map((t) => {
    const match = matchTradeToShadow(t, shadowLog);
    return { trade: t, mlScore: match?.ml_score ?? null };
  });

  const withScores = scored.filter((s) => s.mlScore !== null);
  const highConf = withScores.filter((s) => s.mlScore! >= 0.5);
  const lowConf = withScores.filter((s) => s.mlScore! < 0.35);
  const highWR = highConf.length > 0
    ? (highConf.filter((s) => (s.trade.pnl_usdc || 0) > 0).length / highConf.length * 100)
    : 0;
  const lowWR = lowConf.length > 0
    ? (lowConf.filter((s) => (s.trade.pnl_usdc || 0) > 0).length / lowConf.length * 100)
    : 0;
  const highPnl = highConf.reduce((s, t) => s + (t.trade.pnl_usdc || 0), 0);
  const lowPnl = lowConf.reduce((s, t) => s + (t.trade.pnl_usdc || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Trade History ({trades.length} trades)</h1>

      {withScores.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <Stat label="ML Scored Trades" value={withScores.length}
                  sub={`of ${trades.length} total`} />
          </Card>
          <Card>
            <Stat label="High Confidence (>50%)"
                  value={`${highConf.length}t`}
                  sub={`WR ${highWR.toFixed(0)}% | $${highPnl.toFixed(2)}`}
                  color={highPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          </Card>
          <Card>
            <Stat label="Low Confidence (<35%)"
                  value={`${lowConf.length}t`}
                  sub={`WR ${lowWR.toFixed(0)}% | $${lowPnl.toFixed(2)}`}
                  color={lowPnl >= 0 ? "text-emerald-400" : "text-red-400"} />
          </Card>
          <Card>
            <Stat label="Edge (High - Low)"
                  value={`${(highWR - lowWR).toFixed(0)}pp`}
                  sub={highWR > lowWR ? "Model separating" : "Not yet separating"}
                  color={highWR > lowWR ? "text-emerald-400" : "text-gray-400"} />
          </Card>
        </div>
      )}

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 uppercase">
                <th className="text-left py-2">Date</th>
                <th className="text-left">Token</th>
                <th className="text-left">Dir</th>
                <th className="text-right">Entry</th>
                <th className="text-right">Exit</th>
                <th className="text-right">PnL</th>
                <th className="text-right">PnL%</th>
                <th className="text-center">ML Score</th>
                <th className="text-right">MFE%</th>
                <th className="text-right">MAE%</th>
                <th className="text-left">Exit Reason</th>
                <th className="text-right">Held</th>
                <th className="text-left">Protocol</th>
              </tr>
            </thead>
            <tbody>
              {scored.map(({ trade: t, mlScore }, i) => (
                <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/50">
                  <td className="py-1.5 text-gray-400">{(t.opened_at || "").slice(0, 16)}</td>
                  <td className="font-medium">{t.symbol}</td>
                  <td className={t.direction === "long" ? "text-emerald-400" : "text-red-400"}>
                    {t.direction}
                  </td>
                  <td className="text-right">{t.entry?.toFixed(2)}</td>
                  <td className="text-right">{t.exit_price?.toFixed(2)}</td>
                  <td className={`text-right font-medium ${(t.pnl_usdc || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ${(t.pnl_usdc || 0).toFixed(2)}
                  </td>
                  <td className={`text-right ${(t["pnl_%"] || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {(t["pnl_%"] || 0).toFixed(2)}%
                  </td>
                  <td className="text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <ScoreBadge score={mlScore} />
                      <SizingLabel score={mlScore} />
                    </div>
                  </td>
                  <td className="text-right text-emerald-400">{(t["mfe_%"] || 0).toFixed(2)}%</td>
                  <td className="text-right text-red-400">{(t["mae_%"] || 0).toFixed(2)}%</td>
                  <td className="text-gray-400">{t.exit_reason}</td>
                  <td className="text-right">{t.hours_held}h</td>
                  <td className="text-gray-500">{t.protocol}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
