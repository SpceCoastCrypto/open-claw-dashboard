import { getShadowLog, type ShadowEntry } from "@/lib/data";
import { Card, Stat } from "@/components/Card";

export const dynamic = "force-dynamic";

interface SignalGroup {
  symbol: string;
  entries: ShadowEntry[];
  scored: ShadowEntry[];
  withOutcome: ShadowEntry[];
  longs: ShadowEntry[];
  shorts: ShadowEntry[];
}

function groupSignals(shadow: ShadowEntry[]): SignalGroup[] {
  const bySymbol: Record<string, ShadowEntry[]> = {};
  for (const e of shadow) {
    const sym = e.symbol || "?";
    if (!bySymbol[sym]) bySymbol[sym] = [];
    bySymbol[sym].push(e);
  }

  return Object.entries(bySymbol)
    .map(([symbol, entries]) => ({
      symbol,
      entries,
      scored: entries.filter((e) => e.ml_score !== null && e.ml_score !== undefined),
      withOutcome: entries.filter((e) => e.outcome),
      longs: entries.filter((e) => e.direction === "long"),
      shorts: entries.filter((e) => e.direction === "short"),
    }))
    .sort((a, b) => b.entries.length - a.entries.length);
}

function ScoreBadge({ score }: { score: number | null | undefined }) {
  if (score === null || score === undefined) return <span className="text-gray-600">--</span>;
  const pct = Math.round(score * 100);
  // Buckets match bot/main.py gate logic as of 2026-04-23:
  //   <0.35       → BLOCK (red)
  //   0.35–0.55   → baseline allow (gray)
  //   0.55–0.70   → 1.50× boost (yellow)
  //   ≥0.70       → 1.75× boost (green)
  let color = "text-gray-400 bg-gray-800";
  if (score >= 0.70)      color = "text-emerald-400 bg-emerald-900/30";
  else if (score >= 0.55) color = "text-yellow-400 bg-yellow-900/30";
  else if (score >= 0.35) color = "text-gray-300 bg-gray-700";
  else                    color = "text-red-400 bg-red-900/30";
  return <span className={`px-1.5 py-0.5 rounded text-xs font-mono ${color}`}>{pct}%</span>;
}

function isShadowSignal(sym: string): boolean {
  // Shadow-only signal suffixes (logged but not traded)
  return sym.includes("_MTF") || sym.includes("_HHHL") || sym.includes("_RSI_MOM")
    || sym.includes("_PULLBACK") || sym.includes("_MACD_MOM") || sym.includes("_COMBO")
    || sym.includes("_DONCHIAN") || sym.includes("_RSI2_SHORT");
}

// Mirrors PAUSED_TOKENS in bot/main.py as of 2026-04-23
// WBTC removed 2026-04-23 — shorts re-enabled, longs via PAUSED_DIRECTIONS
function isPausedToken(sym: string): boolean {
  return ["PUMP", "NATGAS", "NVDAX"].includes(sym) && !sym.includes("_");
}

// Helper: safely resolve a trade's PnL even for synthetic outcomes
function outcomePnlUsdc(outcome: NonNullable<ShadowEntry["outcome"]>): number {
  if (typeof outcome.pnl_usdc === "number") return outcome.pnl_usdc;
  // Synthetic outcomes carry pnl_pct only. Project to $ using default
  // base size ($800) × leverage (2×) = $1,600 notional.
  if (typeof outcome.pnl_pct === "number") return outcome.pnl_pct / 100 * 1600;
  if (typeof outcome.forward_return_pct === "number")
    return outcome.forward_return_pct / 100 * 1600;
  return 0;
}

function outcomeProfitable(outcome: NonNullable<ShadowEntry["outcome"]>): 0 | 1 {
  if (outcome.profitable === 1 || outcome.profitable === 0) return outcome.profitable;
  return outcomePnlUsdc(outcome) > 0 ? 1 : 0;
}

export default async function ShadowPage() {
  const shadow = await getShadowLog();
  const groups = groupSignals(shadow);

  const shadowGroups = groups.filter((g) => isShadowSignal(g.symbol));
  const pausedGroups = groups.filter((g) => isPausedToken(g.symbol));
  const liveGroups = groups.filter((g) => !isShadowSignal(g.symbol) && !isPausedToken(g.symbol));

  // Overall ML separation
  const allWithOutcome = shadow.filter((e) => e.outcome && e.ml_score != null);
  const winners = allWithOutcome.filter((e) => outcomeProfitable(e.outcome!) === 1);
  const losers = allWithOutcome.filter((e) => outcomeProfitable(e.outcome!) === 0);
  const winAvgScore = winners.length > 0
    ? winners.reduce((s, e) => s + (e.ml_score || 0), 0) / winners.length : 0;
  const loseAvgScore = losers.length > 0
    ? losers.reduce((s, e) => s + (e.ml_score || 0), 0) / losers.length : 0;

  function renderGroup(g: SignalGroup) {
    const scores = g.scored.map((e) => e.ml_score!);
    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
    // Match gate buckets exactly
    const boosted = scores.filter((s) => s >= 0.55).length;   // ≥0.55 → 1.5×/1.75×
    const blocked = scores.filter((s) => s < 0.35).length;    // <0.35 → BLOCK

    const oc = g.withOutcome;
    const ocWins = oc.filter((e) => outcomeProfitable(e.outcome!) === 1);
    const ocPnl = oc.reduce((s, e) => s + outcomePnlUsdc(e.outcome!), 0);
    const wr = oc.length > 0 ? (ocWins.length / oc.length * 100) : null;

    // Score vs outcome correlation
    const highConfOc = oc.filter((e) => (e.ml_score || 0) >= 0.55);
    const highConfWins = highConfOc.filter((e) => outcomeProfitable(e.outcome!) === 1);
    const lowConfOc = oc.filter((e) => (e.ml_score || 0) < 0.35);
    const lowConfWins = lowConfOc.filter((e) => outcomeProfitable(e.outcome!) === 1);

    const firstDate = g.entries[0]?.timestamp?.slice(0, 10) || "?";
    const lastDate = g.entries[g.entries.length - 1]?.timestamp?.slice(0, 10) || "?";

    return (
      <div key={g.symbol} className="bg-gray-800/30 rounded-lg p-4 border border-gray-700">
        <div className="flex items-center justify-between mb-3">
          <div>
            <span className="text-lg font-bold">{g.symbol}</span>
            <span className="text-xs text-gray-500 ml-2">{firstDate} — {lastDate}</span>
          </div>
          <div className="flex gap-2 text-xs">
            {g.longs.length > 0 && <span className="text-emerald-400">{g.longs.length} long</span>}
            {g.shorts.length > 0 && <span className="text-red-400">{g.shorts.length} short</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 text-xs">Signals</div>
            <div className="text-xl font-bold">{g.entries.length}</div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 text-xs">Avg ML Score</div>
            <div className="text-xl font-bold">
              {avgScore !== null ? <ScoreBadge score={avgScore} /> : "--"}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {boosted} boost / {blocked} block
            </div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 text-xs">Outcomes</div>
            {oc.length > 0 ? (
              <>
                <div className={`text-xl font-bold ${(wr || 0) >= 50 ? "text-emerald-400" : "text-red-400"}`}>
                  {wr?.toFixed(0)}% WR
                </div>
                <div className={`text-xs ${ocPnl >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  ${ocPnl.toFixed(2)} ({oc.length}t)
                </div>
              </>
            ) : (
              <div className="text-gray-500">no trades yet</div>
            )}
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="text-gray-500 text-xs">ML Edge</div>
            {highConfOc.length > 0 && lowConfOc.length > 0 ? (
              <>
                <div className="text-xs">
                  High: {highConfOc.length > 0 ? `${(highConfWins.length / highConfOc.length * 100).toFixed(0)}%` : "--"} ({highConfOc.length}t)
                </div>
                <div className="text-xs">
                  Low: {lowConfOc.length > 0 ? `${(lowConfWins.length / lowConfOc.length * 100).toFixed(0)}%` : "--"} ({lowConfOc.length}t)
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-xs">need more data</div>
            )}
          </div>
        </div>

        {/* Recent signals */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500">
                <th className="text-left py-1">Time</th>
                <th className="text-left">Dir</th>
                <th className="text-center">ML Score</th>
                <th className="text-right">PnL</th>
                <th className="text-left">Reason</th>
              </tr>
            </thead>
            <tbody>
              {g.entries.slice(-8).map((e, i) => {
                const pnl = e.outcome ? outcomePnlUsdc(e.outcome) : null;
                const isSynth = e.outcome?.synthetic === true;
                return (
                  <tr key={i} className="border-t border-gray-800/50">
                    <td className="py-1 text-gray-400">{e.timestamp?.slice(5, 16)}</td>
                    <td className={e.direction === "long" ? "text-emerald-400" : "text-red-400"}>
                      {e.direction}
                    </td>
                    <td className="text-center"><ScoreBadge score={e.ml_score} /></td>
                    <td className={`text-right ${
                      pnl === null ? "text-gray-600" : pnl >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {pnl === null ? "--" : `$${pnl.toFixed(2)}${isSynth ? "ˢ" : ""}`}
                    </td>
                    <td className="text-gray-500 max-w-[200px] truncate">{e.signal_reason?.slice(0, 50)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shadow Signals</h1>

      {/* ML Separation Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <Stat label="Total Shadow Entries" value={shadow.length} />
        </Card>
        <Card>
          <Stat label="Winner Avg Score" value={`${(winAvgScore * 100).toFixed(0)}%`}
                color="text-emerald-400"
                sub={`${winners.length} winning trades`} />
        </Card>
        <Card>
          <Stat label="Loser Avg Score" value={`${(loseAvgScore * 100).toFixed(0)}%`}
                color="text-red-400"
                sub={`${losers.length} losing trades`} />
        </Card>
        <Card>
          <Stat label="ML Separation" value={`${((winAvgScore - loseAvgScore) * 100).toFixed(0)}pp`}
                color={winAvgScore > loseAvgScore ? "text-emerald-400" : "text-red-400"}
                sub={winAvgScore > loseAvgScore ? "Model separating" : "Not separating"} />
        </Card>
      </div>

      {/* Trend Shadow Signals (new) */}
      {shadowGroups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-emerald-400">Trend Signals (shadow)</h2>
          <div className="space-y-4">
            {shadowGroups.map(renderGroup)}
          </div>
        </>
      )}

      {shadowGroups.length === 0 && (
        <Card>
          <div className="text-gray-500 text-center py-4">
            No trend shadow signals yet — deployed Apr 16, waiting for first fires
          </div>
        </Card>
      )}

      {/* Paused Token Signals */}
      {pausedGroups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-yellow-400">Paused Tokens (shadow logging)</h2>
          <div className="space-y-4">
            {pausedGroups.map(renderGroup)}
          </div>
        </>
      )}

      {/* Live Token Signals */}
      {liveGroups.length > 0 && (
        <>
          <h2 className="text-lg font-semibold">Live Signals (for reference)</h2>
          <div className="space-y-4">
            {liveGroups.map(renderGroup)}
          </div>
        </>
      )}

      <div className="text-xs text-gray-600 text-center">
        Shadow signals are logged but never traded. ML scores backfilled on all entries.
        Winner avg score vs loser avg score indicates model separation quality.
        <br />
        PnL values marked with ˢ are <b>synthetic</b> (projected from forward Yahoo prices × \$1,600 notional, not real trade fills).
        Scores use current gate buckets: &lt;35%=BLOCK · 35–55%=baseline · 55–70%=1.5× boost · ≥70%=1.75× boost.
      </div>
    </div>
  );
}
