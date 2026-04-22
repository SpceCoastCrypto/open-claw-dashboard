"use client";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export function PnlBarChart({ data }: { data: { name: string; pnl: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <ReBarChart data={data}>
        <XAxis dataKey="name" tick={{ fill: "#e5e7eb", fontSize: 11 }} angle={-45} textAnchor="end" height={60} />
        <YAxis tick={{ fill: "#e5e7eb", fontSize: 11 }} />
        <Tooltip
          contentStyle={{ background: "#1f2937", border: "1px solid #374151", borderRadius: 8, color: "#f3f4f6" }}
          labelStyle={{ color: "#f3f4f6" }}
          itemStyle={{ color: "#f3f4f6" }}
        />
        <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.pnl >= 0 ? "#10b981" : "#ef4444"} />
          ))}
        </Bar>
      </ReBarChart>
    </ResponsiveContainer>
  );
}
