"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

export function EquityCurve({ equity }: { equity: number[] }) {
  const data = equity.map((v, i) => ({ trade: i + 1, pnl: Math.round(v * 100) / 100 }));
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <XAxis dataKey="trade" tick={{ fill: "#e5e7eb", fontSize: 11 }} />
        <YAxis tick={{ fill: "#e5e7eb", fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#f3f4f6" }}
          labelStyle={{ color: "#f3f4f6" }}
          itemStyle={{ color: "#f3f4f6" }}
        />
        <ReferenceLine y={0} stroke="#374151" />
        <Line type="monotone" dataKey="pnl" stroke="#10b981" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
