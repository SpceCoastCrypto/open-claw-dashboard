import { getMLReport, getDriftHistory, getFreshMetadata, getFeatureHalflife } from "@/lib/data";
import { Card, Stat } from "@/components/Card";
import { PnlBarChart } from "@/components/BarChart";

export const dynamic = "force-dynamic";

export default async function MLPage() {
  const [report, driftHistory, freshMeta, halflife] = await Promise.all([
    getMLReport(),
    getDriftHistory(),
    getFreshMetadata(),
    getFeatureHalflife(),
  ]);

  if (!report || report.status === "insufficient_data") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">ML Pipeline</h1>
        <Card>
          <div className="text-gray-400">
            <p>Waiting for sufficient data. Currently {report?.n_matched_trades || 0} matched trades.</p>
            <p className="mt-2">ML report runs every Sunday at 6am UTC.</p>
          </div>
        </Card>
      </div>
    );
  }

  const featureImportance = report.feature_importance || [];
  const featureCount = featureImportance.length;

  const featureData = featureImportance
    .slice(0, 15)
    .map((f: { feature: string; importance_mean: number }) => ({
      name: f.feature,
      pnl: Math.round(f.importance_mean * 10000) / 10000,
    }));

  const drift = report.drift;
  const experimental = report.experimental;
  const latestDrift = driftHistory.length > 0 ? driftHistory[driftHistory.length - 1] : null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ML Pipeline</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <Stat label="Matched Trades" value={report.n_matched_trades || 0} />
        </Card>
        <Card>
          <Stat label="LOO Accuracy" value={`${((report.loo_accuracy || 0) * 100).toFixed(0)}%`}
                color={(report.loo_accuracy || 0) > 0.52 ? "text-emerald-400" : "text-gray-400"}
                sub={report.model_useful ? "Model is learning" : "Not yet useful"} />
        </Card>
        <Card>
          <Stat label="Win Rate" value={`${((report.win_rate || 0) * 100).toFixed(0)}%`} />
        </Card>
        <Card>
          <Stat label="Features" value={featureCount || "—"}
                sub={featureCount ? "live in FEATURE_COLS" : "pending report"} />
        </Card>
      </div>

      {/* ── Ensemble (stable + fresh model) ────────────────────────────── */}
      <Card title="Ensemble Scoring — 60% stable + 40% fresh">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-800/40 rounded-lg p-3">
            <div className="text-gray-400 text-xs uppercase tracking-wide">Stable Model (quarterly)</div>
            <div className="mt-1 text-gray-200">Retrained 1 Jan/Apr/Jul/Oct at 06:00 UTC via <code className="text-emerald-400">retrain_model.yml</code></div>
            <div className="text-gray-500 text-xs mt-1">Weight: 60% of ensemble score</div>
          </div>
          <div className="bg-gray-800/40 rounded-lg p-3">
            <div className="text-gray-400 text-xs uppercase tracking-wide">Fresh Model (monthly)</div>
            {freshMeta?.status === "ok" ? (
              <>
                <div className="mt-1 text-emerald-400">Live — trained {freshMeta.n_matched} matched trades ({freshMeta.n_recent_90d} in last 90d)</div>
                <div className="text-gray-500 text-xs mt-1">
                  Generated {new Date(freshMeta.date).toLocaleDateString()} · train logloss {freshMeta.train_logloss} · val {freshMeta.val_logloss ?? "n/a"}
                </div>
              </>
            ) : (
              <>
                <div className="mt-1 text-gray-400">Not yet deployed — awaiting first monthly refresh (1st Saturday)</div>
                <div className="text-gray-500 text-xs mt-1">Scoring falls back to stable-only until first fire</div>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* ── Drift ─────────────────────────────────────────────────────── */}
      <Card title={`PSI Drift — recent 25% vs prior 75% of matched trades`}>
        {drift?.status === "ok" ? (
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                drift.retrain_recommended ? "bg-red-900/50 text-red-400" : "bg-emerald-900/40 text-emerald-400"
              }`}>
                {drift.retrain_recommended ? "🚨 RETRAIN RECOMMENDED" : "✓ Stable"}
              </div>
              <div className="text-sm text-gray-400">
                {drift.flagged_count} feature{drift.flagged_count === 1 ? "" : "s"} flagged · {drift.features_checked} checked
              </div>
            </div>
            <div className="space-y-1 text-sm">
              {(drift.top_drifted || []).slice(0, 5).map((d: { feature: string; psi: number; severity: string; ref_mean: number; new_mean: number }) => (
                <div key={d.feature} className="flex items-center justify-between bg-gray-800/30 rounded px-3 py-1.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      d.severity === "high" ? "bg-red-900/50 text-red-400" :
                      d.severity === "moderate" ? "bg-yellow-900/50 text-yellow-400" :
                      "bg-gray-700 text-gray-400"
                    }`}>{d.severity}</span>
                    <span className="font-mono">{d.feature}</span>
                  </div>
                  <div className="font-mono text-gray-400 text-xs">
                    PSI={d.psi.toFixed(3)} · μ {d.ref_mean.toFixed(2)} → {d.new_mean.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
            {driftHistory.length > 1 && (
              <div className="mt-3 text-xs text-gray-500">
                {driftHistory.length}-week history available · last snapshot {latestDrift && new Date(latestDrift.date).toLocaleDateString()}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400 text-sm">Insufficient data — drift check needs 40+ matched trades</div>
        )}
      </Card>

      {/* ── Experimental MPI features ─────────────────────────────────── */}
      {experimental?.features && experimental.features.length > 0 && (
        <Card title="Experimental Features — Market Pulse Intelligence (shadow only, not fed to model)">
          <div className="text-xs text-gray-500 mb-3">
            Promotion criteria: n ≥ 30 trades with |Spearman IC| ≥ 0.05 vs trade P&L
          </div>
          <div className="space-y-1 text-sm">
            {experimental.features.map((f: { feature: string; n: number; ic: number; verdict: string }) => (
              <div key={f.feature} className="flex items-center justify-between bg-gray-800/30 rounded px-3 py-1.5">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    f.verdict === "promote" ? "bg-emerald-900/50 text-emerald-400" :
                    f.verdict === "watch" ? "bg-yellow-900/50 text-yellow-400" :
                    f.verdict === "no_edge" ? "bg-gray-700 text-gray-400" :
                    "bg-gray-800 text-gray-500"
                  }`}>{f.verdict}</span>
                  <span className="font-mono">{f.feature.replace("mpi_", "")}</span>
                </div>
                <div className="font-mono text-xs text-gray-400">
                  n={f.n} · IC={f.ic >= 0 ? "+" : ""}{f.ic.toFixed(3)}
                </div>
              </div>
            ))}
          </div>
          {experimental.promote_candidates?.length > 0 && (
            <div className="mt-3 text-sm text-emerald-400">
              → Promote: {experimental.promote_candidates.join(", ")}
            </div>
          )}
        </Card>
      )}

      {/* ── Feature Half-Life ─────────────────────────────────────────── */}
      {halflife?.by_verdict && (
        <Card title="Feature Half-Life — quarterly alpha-decay analysis">
          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="bg-emerald-900/20 border border-emerald-900/40 rounded-lg p-3 text-center">
              <div className="text-emerald-400 text-sm">Robust</div>
              <div className="text-xl font-bold">{halflife.by_verdict.robust ?? 0}</div>
              <div className="text-xs text-gray-500">|IC| ≥ 0.04, decay ≥ 0.7</div>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/40 rounded-lg p-3 text-center">
              <div className="text-yellow-400 text-sm">Decaying</div>
              <div className="text-xl font-bold">{halflife.by_verdict.decaying ?? 0}</div>
              <div className="text-xs text-gray-500">decay 0.3–0.7</div>
            </div>
            <div className="bg-red-900/20 border border-red-900/40 rounded-lg p-3 text-center">
              <div className="text-red-400 text-sm">Dead</div>
              <div className="text-xl font-bold">{halflife.by_verdict.dead ?? 0}</div>
              <div className="text-xs text-gray-500">drop candidates</div>
            </div>
          </div>
          {halflife.drop_candidates?.length > 0 && (
            <div className="text-xs text-gray-500">
              Drop: <span className="text-red-400 font-mono">{halflife.drop_candidates.slice(0, 8).join(", ")}</span>
              {halflife.drop_candidates.length > 8 && ` +${halflife.drop_candidates.length - 8} more`}
            </div>
          )}
          <div className="text-xs text-gray-600 mt-2">
            Last run {halflife.date ? new Date(halflife.date).toLocaleDateString() : "pending (next: 1 Jul)"}
          </div>
        </Card>
      )}

      {/* ── Top features + regime ─────────────────────────────────────── */}
      {featureData.length > 0 && (
        <Card title="Top 15 Features (permutation importance)">
          <PnlBarChart data={featureData} />
        </Card>
      )}

      {report.top_5_features && (
        <Card title="Top 5 Predictive Features">
          <div className="flex flex-wrap gap-2">
            {report.top_5_features.map((f: string) => (
              <span key={f} className="bg-emerald-900/40 text-emerald-400 px-3 py-1 rounded-full text-sm">
                {f}
              </span>
            ))}
          </div>
        </Card>
      )}

      {report.drop_candidates && report.drop_candidates.length > 0 && (
        <Card title="Drop Candidates (low predictive power)">
          <div className="flex flex-wrap gap-2">
            {report.drop_candidates.slice(0, 10).map((f: string) => (
              <span key={f} className="bg-red-900/30 text-red-400 px-3 py-1 rounded-full text-sm">
                {f}
              </span>
            ))}
          </div>
        </Card>
      )}

      {Object.keys(report.regime_stats || {}).length > 0 && (
        <Card title="Win Rate by Regime">
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(report.regime_stats).map(([name, s]: [string, unknown]) => {
              const stats = s as { win_rate?: number; avg_pnl?: number; trades?: number };
              return (
                <div key={name} className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <div className="text-gray-400 text-sm capitalize">{name}</div>
                  <div className="text-xl font-bold">{((stats.win_rate || 0) * 100).toFixed(0)}%</div>
                  <div className="text-xs text-gray-500">{stats.trades} trades</div>
                  <div className={`text-sm ${(stats.avg_pnl || 0) >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                    ${(stats.avg_pnl || 0).toFixed(2)}/trade
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="text-xs text-gray-600 text-center">
        Report generated: {report.date ? new Date(report.date).toLocaleString() : "pending"} · Ensemble: stable (quarterly) + fresh (monthly)
      </div>
    </div>
  );
}
