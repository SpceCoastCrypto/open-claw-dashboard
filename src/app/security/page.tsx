import { readFileSync } from "fs";
import { join } from "path";
import { Card, Stat } from "@/components/Card";

export const dynamic = "force-dynamic";

const BOT_DIR = process.env.BOT_DIR
  ?? "/Users/cosmovendingco/actions-runner/_work/open-claw-bot/open-claw-bot";

function loadReport() {
  try {
    return JSON.parse(readFileSync(join(BOT_DIR, "security_audit_report.json"), "utf-8"));
  } catch {
    return null;
  }
}

export default async function SecurityPage() {
  const report = loadReport();

  if (!report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Security</h1>
        <Card>
          <div className="text-gray-400">
            No security audit report found. Runs every Sunday at 8am UTC.
          </div>
        </Card>
      </div>
    );
  }

  const statusColor = report.status === "PASS" ? "text-emerald-400" : "text-red-400";
  const statusEmoji = report.status === "PASS" ? "✅" : "🔴";
  const counts = report.counts || {};

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Security Audit</h1>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <Stat label="Status" value={`${statusEmoji} ${report.status}`} color={statusColor} />
        </Card>
        <Card>
          <Stat label="Critical" value={counts.CRITICAL || 0}
                color={counts.CRITICAL ? "text-red-400" : "text-emerald-400"} />
        </Card>
        <Card>
          <Stat label="High" value={counts.HIGH || 0}
                color={counts.HIGH ? "text-orange-400" : "text-emerald-400"} />
        </Card>
        <Card>
          <Stat label="Medium" value={counts.MEDIUM || 0}
                color={counts.MEDIUM ? "text-yellow-400" : "text-emerald-400"} />
        </Card>
        <Card>
          <Stat label="Total Issues" value={report.total_issues || 0} />
        </Card>
      </div>

      {report.issues && report.issues.length > 0 ? (
        <Card title="Issues">
          <div className="space-y-3">
            {report.issues.map((issue: { severity: string; file: string; description: string }, i: number) => {
              const sevColor = {
                CRITICAL: "bg-red-900/40 text-red-400",
                HIGH: "bg-orange-900/40 text-orange-400",
                MEDIUM: "bg-yellow-900/40 text-yellow-400",
                LOW: "bg-gray-800/40 text-gray-400",
              }[issue.severity] || "bg-gray-800/40 text-gray-400";

              return (
                <div key={i} className="border border-gray-800 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${sevColor}`}>
                      {issue.severity}
                    </span>
                    <span className="text-sm text-gray-400">{issue.file}</span>
                  </div>
                  <div className="text-sm">{issue.description}</div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card>
          <div className="text-emerald-400 text-center py-8 text-lg">
            All checks passed — no issues found
          </div>
        </Card>
      )}

      <Card title="Checks Performed">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
          {[
            "Secrets in code (regex scan of .py/.yml files)",
            "Git history (sensitive files ever committed)",
            "GitHub Actions pinned to SHA hashes",
            ".gitignore coverage (runner creds, .env, keys)",
            "Traceback leak to Telegram",
            "Private key content in error messages",
            "Requirements hash verification (supply-chain)",
          ].map((check) => (
            <div key={check} className="flex items-center gap-2 text-gray-400">
              <span className="text-emerald-400">✓</span> {check}
            </div>
          ))}
        </div>
      </Card>

      <div className="text-xs text-gray-600 text-center">
        Last audit: {report.generated_at ? new Date(report.generated_at).toLocaleString() : "never"}
        {" • "}Runs every Sunday 8am UTC
      </div>
    </div>
  );
}
