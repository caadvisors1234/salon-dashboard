"use client";

import { KpiCard } from "./kpi-card";
import type { GbpKpiData } from "@/types/dashboard";

export function GbpKpiCards({ data }: { data: GbpKpiData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard kpi={data.rating} />
      <KpiCard kpi={data.reviewCount} />
      <KpiCard kpi={data.totalImpressions} />
      <KpiCard kpi={data.totalActions} />
    </div>
  );
}
