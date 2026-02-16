"use client";

import { KpiCard } from "./kpi-card";
import type { HpbKpiData } from "@/types/dashboard";

function formatAreaAvg(value: number, format: "integer" | "percent1"): string {
  if (format === "percent1") {
    return `エリア平均: ${value.toFixed(1)}%`;
  }
  return `エリア平均: ${value.toLocaleString("ja-JP")}`;
}

export function HpbKpiCards({ data }: { data: HpbKpiData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <KpiCard
        kpi={data.salonPv}
        areaAvgLabel={formatAreaAvg(data.salonPv.areaAvg, "integer")}
      />
      <KpiCard
        kpi={data.cvr}
        areaAvgLabel={formatAreaAvg(data.cvr.areaAvg, "percent1")}
      />
      <KpiCard
        kpi={data.acr}
        areaAvgLabel={formatAreaAvg(data.acr.areaAvg, "percent1")}
      />
    </div>
  );
}
