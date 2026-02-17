"use client";

import { Star, MessageSquare, Eye, MousePointerClick } from "lucide-react";
import { KpiCard } from "./kpi-card";
import type { GbpKpiData } from "@/types/dashboard";

export function GbpKpiCards({ data }: { data: GbpKpiData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        kpi={data.rating}
        icon={<Star className="h-4 w-4" />}
        accentColor="#f59e0b"
      />
      <KpiCard
        kpi={data.reviewCount}
        icon={<MessageSquare className="h-4 w-4" />}
        accentColor="#3b82f6"
      />
      <KpiCard
        kpi={data.totalImpressions}
        icon={<Eye className="h-4 w-4" />}
        accentColor="#14b8a6"
      />
      <KpiCard
        kpi={data.totalActions}
        icon={<MousePointerClick className="h-4 w-4" />}
        accentColor="#8b5cf6"
      />
    </div>
  );
}
