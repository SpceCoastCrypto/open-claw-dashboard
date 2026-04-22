import { getWalkForwardReport } from "@/lib/data";
import { Card, Stat } from "@/components/Card";

export const dynamic = "force-dynamic";

interface EdgeDecay {
  symbol: string;
  direction: string;
  all_time_wr: number;
  recent_wr: number;
  all_time_pnl: number;
  recent_pnl: number;
  trades: number;
  recent_trades: number;
  decay_sd: number;
  status: string;
}

interface Investigation {
  symbol: string;
  diagnosis_1?: string;
  diagnosis_2?: string;
  diagnosis_3?: string[];
  recommendation?: string;
  action?: string;
  all_time?: { trades: number; wr: number; pnl: number; avg_pnl: number };
  recent_15?: { trades: number; wr: number; pnl: number; avg_pnl: number };
}

interface Recommendation {
  type: string;
  current: string;
  suggested: string;
  evidence: string;
  confidence: number;
}

export default async function SignalsPage() {
  const report = await getWalkForwardReport();
  const edgeDecay: EdgeDecay[] = report?.edge_decay || [];
  const investigations: Record<string, Investigation> = report?.investigations || {};
  const recommendations: Recommendation[] = report?.recommendations || [];

  const statusColor: Record<string, string> = {
    CRITICAL: "text-red-400",
    WARNING: "text-orange-400",
    WATCH: "text-yellow-400",
    OK: "text-emerald-400",
  };

  const statusBg: Record<string, string> = {
    CRITICAL: "bg-red-900/20 border-l-4 border-red-500",
    WARNING: "bg-orange-900/20 border-l-4 border-orange-500",
    WATCH: "bg-yellow-900/20 border-l-4 border-yellow-500",
    OK: "bg-gray-800/20 border-l-4 border-emerald-500",
  };

  const statusEmoji: Record<string, string> = {
    CRITICAL: "🔴",
    WARNING: "🟠",
    WATCH: "🟡",
    OK: "🟢",
  };

  const actionEmoji: Record<string, string> = {
    pause: "🔴",
    wait: "🟡",
    reduce: "🟠",
    monitor: "🟡",
    none: "🟢",
  };

  // Summary counts
  const counts = { CRITICAL: 0, WARNING: 0, WATCH: 0, OK: 0 };
  for (const r of edgeDecay) {
    counts[r.status as keyof typeof counts]++;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Signal Health</h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><Stat label="Critical" value={counts.CRITICAL}
              color={counts.CRITICAL ? "text-red-400" : "text-emerald-400"} /></Card>
        <Card><Stat label="Warning" value={counts.WARNING}
              color={counts.WARNING ? "text-orange-400" : "text-emerald-400"} /></Card>
        <Card><Stat label="Watch" value={counts.WATCH}
              color={counts.WATCH ? "text-yellow-400" : "text-emerald-400"} /></Card>
        <Card><Stat label="OK" value={counts.OK} color="text-emerald-400" /></Card>
      </div>

      {/* Edge Decay Table */}
      <Card title="Edge Decay Monitor (all tokens, all directions)">
        {edgeDecay.length === 0 ? (
          <div className="text-gray-500 text-sm">No data yet — runs every Sunday 7am UTC</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs uppercase">
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left pr-3">Token</th>
                  <th className="text-left pr-3">Direction</th>
                  <th className="text-right px-3">All-Time WR</th>
                  <th className="text-right px-3">Recent WR</th>
                  <th className="text-right px-3">Decay (σ)</th>
                  <th className="text-right px-3">All-Time PnL</th>
                  <th className="text-right px-3">Recent PnL</th>
                  <th className="text-right px-3">Trades</th>
                </tr>
              </thead>
              <tbody>
                {edgeDecay.map((r, i) => (
                  <tr key={i} className={`border-t border-gray-800 ${statusBg[r.status]}`}>
                    <td className="py-2 pr-3">
                      <span className={`text-lg`}>{statusEmoji[r.status]}</span>
                      <span className={`ml-1 text-xs ${statusColor[r.status]}`}>{r.status}</span>
                    </td>
                    <td className="pr-3 font-medium">{r.symbol}</td>
                    <td className={`pr-3 ${r.direction === "long" ? "text-emerald-400" : "text-red-400"}`}>
                      {r.direction}
                    </td>
                    <td className="text-right px-3">{(r.all_time_wr * 100).toFixed(0)}%</td>
                    <td className={`text-right px-3 font-medium ${r.recent_wr < r.all_time_wr ? "text-red-400" : "text-emerald-400"}`}>
                      {(r.recent_wr * 100).toFixed(0)}%
                    </td>
                    <td className={`text-right px-3 font-bold ${statusColor[r.status]}`}>
                      {r.decay_sd.toFixed(1)}σ
                    </td>
                    <td className={`text-right px-3 ${r.all_time_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${r.all_time_pnl.toFixed(0)}
                    </td>
                    <td className={`text-right px-3 ${r.recent_pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      ${r.recent_pnl.toFixed(0)}
                    </td>
                    <td className="text-right px-3 text-gray-400">{r.trades}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Investigations */}
      {Object.keys(investigations).length > 0 && (
        <Card title="Signal Investigations (auto-triggered)">
          <div className="space-y-4">
            {Object.entries(investigations).map(([sym, inv]) => {
              const action = inv.action || "none";
              return (
                <div key={sym} className={`rounded-lg p-4 ${
                  action === "pause" ? "bg-red-900/20 border border-red-800" :
                  action === "reduce" ? "bg-orange-900/20 border border-orange-800" :
                  action === "wait" ? "bg-yellow-900/20 border border-yellow-800" :
                  "bg-gray-800/30 border border-gray-700"
                }`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">{actionEmoji[action] || "⚪"}</span>
                    <span className="text-lg font-bold">{sym}</span>
                    {inv.all_time && inv.recent_15 && (
                      <span className="text-xs text-gray-500 ml-auto">
                        {inv.all_time.trades}T total → {inv.recent_15.trades}T recent
                      </span>
                    )}
                  </div>

                  {inv.all_time && inv.recent_15 && (
                    <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                      <div className="bg-gray-900/50 rounded p-2">
                        <div className="text-gray-500 text-xs">All-Time</div>
                        <div>WR: {(inv.all_time.wr * 100).toFixed(0)}% | ${inv.all_time.pnl.toFixed(2)}</div>
                      </div>
                      <div className="bg-gray-900/50 rounded p-2">
                        <div className="text-gray-500 text-xs">Recent 15</div>
                        <div className={inv.recent_15.pnl < 0 ? "text-red-400" : ""}>
                          WR: {(inv.recent_15.wr * 100).toFixed(0)}% | ${inv.recent_15.pnl.toFixed(2)}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1 text-sm">
                    <div className="text-gray-300">1️⃣ {inv.diagnosis_1 || "N/A"}</div>
                    <div className="text-gray-300">2️⃣ {inv.diagnosis_2 || "N/A"}</div>
                    {inv.diagnosis_3 && inv.diagnosis_3.length > 0 && (
                      <div>
                        <span className="text-gray-300">3️⃣ Changes:</span>
                        {inv.diagnosis_3.map((c, j) => (
                          <div key={j} className="text-gray-400 ml-4">• {c}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`mt-3 font-medium text-sm ${
                    action === "pause" ? "text-red-400" :
                    action === "reduce" ? "text-orange-400" :
                    action === "wait" ? "text-yellow-400" :
                    "text-emerald-400"
                  }`}>
                    → {inv.recommendation}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card title={`Optimization Recommendations (${recommendations.length})`}>
          <div className="space-y-3">
            {recommendations
              .sort((a, b) => b.confidence - a.confidence)
              .map((r, i) => {
                const bg = r.confidence >= 80 ? "border-l-4 border-red-500 bg-red-900/10"
                  : r.confidence >= 60 ? "border-l-4 border-yellow-500 bg-yellow-900/10"
                  : "border-l-4 border-gray-600 bg-gray-800/30";
                return (
                  <div key={i} className={`${bg} rounded-lg p-3`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.confidence >= 80 ? "bg-red-900/40 text-red-400" : "bg-yellow-900/40 text-yellow-400"
                      }`}>
                        {r.confidence}%
                      </span>
                      <span className="text-xs text-gray-500 uppercase">{r.type}</span>
                    </div>
                    <div className="text-sm text-gray-400">Current: {r.current}</div>
                    <div className="text-sm text-white font-medium">→ {r.suggested}</div>
                    <div className="text-xs text-gray-500 mt-1">{r.evidence}</div>
                  </div>
                );
              })}
          </div>
        </Card>
      )}

      {edgeDecay.length === 0 && Object.keys(investigations).length === 0 && recommendations.length === 0 && (
        <Card>
          <div className="text-gray-500 text-center py-8">
            No walkforward report yet — runs every Sunday 7am UTC
          </div>
        </Card>
      )}

      <div className="text-xs text-gray-600 text-center">
        Last updated: {report?.date ? new Date(report.date).toLocaleString() : "never"}
        {" • "}Edge decay uses 15-trade rolling window vs all-time
        {" • "}Recommendations require 15+ trades minimum
      </div>
    </div>
  );
}
