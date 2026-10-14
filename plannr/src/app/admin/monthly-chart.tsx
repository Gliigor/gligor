"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/card";

export function MonthlyChart({
  title,
  data,
  dataKey,
}: {
  title: string;
  data: { label: string; newFirms: number; activeFirms: number }[];
  dataKey: "newFirms" | "activeFirms";
}) {
  return (
    <Card>
      <CardHeader title={title} description="Laatste 12 maanden" />
      <div className="px-2 py-3 sm:px-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="#e9edf3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#e9edf3" }} tick={{ fill: "#7a89a1", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "#7a89a1", fontSize: 11 }} />
            <Tooltip cursor={{ fill: "#f5f7fa" }} formatter={(v) => [String(v), title]} contentStyle={{ borderRadius: 8, borderColor: "#d3dae5", fontSize: 13 }} />
            <Bar dataKey={dataKey} fill="#2a78d6" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
