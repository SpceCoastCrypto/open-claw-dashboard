import { readFileSync } from "fs";
import { join } from "path";

// Self-hosted GitHub Actions runner writes state here — this is the
// authoritative copy that gets committed + pushed each tick. The repo
// clone at ~/open-claw-bot/ is NOT updated automatically and will be
// stale (no git pull runs there).
const BOT_DIR = process.env.BOT_DIR
  ?? "/Users/cosmovendingco/actions-runner/_work/open-claw-bot/open-claw-bot";

function readLocal(file: string) {
  try {
    const content = readFileSync(join(BOT_DIR, file), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export interface Trade {
  symbol: string;
  direction: string;
  entry: number;
  exit_price?: number;
  pnl_usdc?: number;
  exit_reason?: string;
  hours_held?: number;
  collateral_usdc?: number;
  leverage?: number;
  protocol?: string;
  opened_at?: string;
  closed_at?: string;
  status?: string;
  "pnl_%"?: number;
  "mfe_%"?: number;
  "mae_%"?: number;
}

export interface Position {
  symbol: string;
  direction: string;
  entry: number;
  sl: number;
  tp: number;
  leverage: number;
  collateral_usdc: number;
  opened_at: string;
  hours_held: number;
  max_hold_hours: number;
  protocol: string;
  price_high?: number;
  price_low?: number;
  price_checks?: { t: string; p: number }[];
}

export async function getTradeLog(): Promise<Trade[]> {
  const data = readLocal("trade_log.json");
  if (!data || !Array.isArray(data)) return [];
  return data.filter((t: Record<string, unknown>) => t.exit_reason && t.pnl_usdc != null) as Trade[];
}

export async function getState(): Promise<{
  positions: Record<string, Position>;
  trade_history: Trade[];
}> {
  return readLocal("state.json") || { positions: {}, trade_history: [] };
}

export async function getMLReport() {
  return readLocal("ml_weekly_report.json");
}

export async function getWalkForwardReport() {
  return readLocal("walkforward_report.json");
}

export async function getDriftHistory(): Promise<Array<{
  date: string;
  n_trades: number;
  loo_accuracy: number;
  drift_summary: {
    flagged_count: number;
    retrain_recommended: boolean;
    top_3: Array<{ feature: string; psi: number; severity: string; ref_mean: number; new_mean: number }>;
  };
}>> {
  const data = readLocal("ml_drift_history.json");
  return Array.isArray(data) ? data : [];
}

export async function getFreshMetadata() {
  return readLocal("ml_fresh_metadata.json");
}

export async function getFeatureHalflife() {
  return readLocal("ml_feature_halflife.json");
}

export interface ShadowEntry {
  timestamp: string;
  symbol: string;
  direction: string;
  ml_score: number | null;
  ml_score_raw?: number | null;       // 2026-04-23+: raw ensemble before polarity bonus
  polarity_bonus?: number | null;     // 2026-04-23+: hybrid rule adjustment
  polarity_breakdown?: Record<string, number>;  // 2026-04-23+
  signal_reason: string;
  features?: Record<string, number | null>;
  outcome?: {
    // Real-trade outcome fields (from backfill_ml_outcomes.py matching)
    pnl_usdc?: number;
    pnl_pct?: number;
    profitable?: number;
    exit_reason?: string;
    hours_held?: number;
    // Synthetic-outcome fields (from backfill_shadow_outcomes.py forward-price fill)
    synthetic?: boolean;
    forward_return_pct?: number;
    forward_price?: number;
    entry_price?: number;
    hold_hours?: number;
    backfilled_at?: string;
  } | null;
}

export async function getShadowLog(): Promise<ShadowEntry[]> {
  const data = readLocal("ml_shadow_log.json");
  if (!data || !Array.isArray(data)) return [];
  return data as ShadowEntry[];
}

export function matchTradeToShadow(
  trade: Trade,
  shadowLog: ShadowEntry[],
): ShadowEntry | null {
  if (!trade.opened_at || !trade.symbol || !trade.direction) return null;
  const tradeTime = new Date(trade.opened_at).getTime();

  let best: ShadowEntry | null = null;
  let bestDelta = Infinity;

  for (const entry of shadowLog) {
    if (entry.symbol !== trade.symbol || entry.direction !== trade.direction) continue;
    const entryTime = new Date(entry.timestamp).getTime();
    const delta = Math.abs(entryTime - tradeTime);
    if (delta < 1800000 && delta < bestDelta) { // 30 min window
      best = entry;
      bestDelta = delta;
    }
  }
  return best;
}
