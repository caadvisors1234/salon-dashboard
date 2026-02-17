/**
 * レポート用データ取得関数。
 * Supabase admin クライアント経由でRLSをバイパスする。
 * 既存の queries.ts のロジックを再利用しつつ、admin クライアントに差し替え。
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  KeywordRankingRow,
  HpbKpiData,
  HpbMonthlyPoint,
  TrendData,
} from "@/types/dashboard";
import {
  IMPRESSION_TYPES,
  ACTION_TYPES,
  getPreviousMonth,
  monthStart,
  monthEnd,
  formatYearMonthLabel,
  normalizeYearMonth,
  generateMonthRange,
  buildTrend,
  pivotMonthlyMetrics,
} from "@/lib/dashboard/utils";

// --- 店舗情報 ---

export async function getReportLocationInfo(locationId: string): Promise<{
  locationName: string;
  orgId: string;
  orgName: string;
} | null> {
  const supabase = createAdminClient();

  const { data: location } = await supabase
    .from("locations")
    .select("name, org_id")
    .eq("id", locationId)
    .single();

  if (!location) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", location.org_id)
    .single();

  return {
    locationName: location.name,
    orgId: location.org_id,
    orgName: org?.name || "",
  };
}

// --- GBP KPI（レポート用: endMonth基準で前月比算出） ---

export async function getReportGbpKpiData(
  locationId: string,
  endMonth: string
): Promise<GbpKpiData> {
  const supabase = createAdminClient();
  const prevYM = getPreviousMonth(endMonth);
  const curStart = monthStart(endMonth);
  const curEnd = monthEnd(endMonth);
  const prevStart = monthStart(prevYM);
  const prevEnd = monthEnd(prevYM);

  const [curMetricsRes, prevMetricsRes, latestRatingRes, prevRatingRes] =
    await Promise.all([
      supabase
        .from("daily_metrics")
        .select("metric_type, value")
        .eq("location_id", locationId)
        .gte("date", curStart)
        .lte("date", curEnd),
      supabase
        .from("daily_metrics")
        .select("metric_type, value")
        .eq("location_id", locationId)
        .gte("date", prevStart)
        .lte("date", prevEnd),
      supabase
        .from("rating_snapshots")
        .select("rating, review_count, date")
        .eq("location_id", locationId)
        .lte("date", curEnd)
        .order("date", { ascending: false })
        .limit(1),
      supabase
        .from("rating_snapshots")
        .select("rating, review_count, date")
        .eq("location_id", locationId)
        .lte("date", prevEnd)
        .gte("date", prevStart)
        .order("date", { ascending: false })
        .limit(1),
    ]);

  const sumByTypes = (
    rows: { metric_type: string; value: number }[] | null,
    types: readonly string[]
  ) =>
    (rows || [])
      .filter((r) => types.includes(r.metric_type))
      .reduce((s, r) => s + r.value, 0);

  const curImpressions = sumByTypes(curMetricsRes.data, IMPRESSION_TYPES);
  const prevImpressions = sumByTypes(prevMetricsRes.data, IMPRESSION_TYPES);
  const curActions = sumByTypes(curMetricsRes.data, ACTION_TYPES);
  const prevActions = sumByTypes(prevMetricsRes.data, ACTION_TYPES);

  const rating = latestRatingRes.data?.[0]?.rating ?? null;
  const reviewCount = latestRatingRes.data?.[0]?.review_count ?? null;
  const prevRatingVal = prevRatingRes.data?.[0]?.rating ?? null;
  const prevReviewCount = prevRatingRes.data?.[0]?.review_count ?? null;

  return {
    rating: {
      label: "総合評価",
      value: rating ?? 0,
      format: "rating",
      trend: buildTrend(rating, prevRatingVal, "decimal1"),
    },
    reviewCount: {
      label: "レビュー数",
      value: reviewCount ?? 0,
      format: "integer",
      trend: buildTrend(reviewCount, prevReviewCount),
    },
    totalImpressions: {
      label: "合計閲覧数",
      value: curImpressions,
      format: "integer",
      trend: buildTrend(curImpressions, prevImpressions),
    },
    totalActions: {
      label: "合計アクション数",
      value: curActions,
      format: "integer",
      trend: buildTrend(curActions, prevActions),
    },
  };
}

// --- メトリクス時系列 ---

export async function getReportMetricsTimeSeries(
  locationId: string,
  startMonth: string,
  endMonth: string
): Promise<MonthlyMetricPoint[]> {
  const supabase = createAdminClient();
  const startDate = monthStart(startMonth);
  const endDate = monthEnd(endMonth);

  const { data } = await supabase.rpc("get_monthly_metrics", {
    p_location_id: locationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  const allMonths = generateMonthRange(startMonth, endMonth);
  return pivotMonthlyMetrics(data ?? [], allMonths);
}

// --- デバイス内訳 ---

export async function getReportDeviceBreakdown(
  locationId: string,
  yearMonth: string
): Promise<DeviceBreakdownItem[]> {
  const supabase = createAdminClient();
  const startDate = monthStart(yearMonth);
  const endDate = monthEnd(yearMonth);

  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("metric_type, value")
    .eq("location_id", locationId)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("metric_type", [...IMPRESSION_TYPES]);

  const sums: Record<string, number> = {};
  for (const m of metrics || []) {
    sums[m.metric_type] = (sums[m.metric_type] || 0) + m.value;
  }

  const total = Object.values(sums).reduce((s, v) => s + v, 0);
  const items: DeviceBreakdownItem[] = [
    { name: "Google検索 (PC)", value: sums["BUSINESS_IMPRESSIONS_DESKTOP_SEARCH"] || 0, percentage: 0 },
    { name: "Google検索 (モバイル)", value: sums["BUSINESS_IMPRESSIONS_MOBILE_SEARCH"] || 0, percentage: 0 },
    { name: "Googleマップ (PC)", value: sums["BUSINESS_IMPRESSIONS_DESKTOP_MAPS"] || 0, percentage: 0 },
    { name: "Googleマップ (モバイル)", value: sums["BUSINESS_IMPRESSIONS_MOBILE_MAPS"] || 0, percentage: 0 },
  ];

  if (total > 0) {
    for (const item of items) {
      item.percentage = Math.round((item.value / total) * 1000) / 10;
    }
  }

  return items;
}

// --- キーワードランキング（上位20件、ページネーションなし） ---

export async function getReportKeywordRanking(
  locationId: string,
  yearMonth: string
): Promise<KeywordRankingRow[]> {
  const supabase = createAdminClient();
  const normalized = normalizeYearMonth(yearMonth);
  const prevYM = getPreviousMonth(normalized);
  const ym = normalized.replace("-", "");
  const prevYm = prevYM.replace("-", "");

  const [currentRes, prevRes] = await Promise.all([
    supabase
      .from("monthly_keywords")
      .select("keyword, insights_value, insights_threshold, insights_value_type")
      .eq("location_id", locationId)
      .eq("year_month", ym)
      .order("insights_value", { ascending: false, nullsFirst: false })
      .limit(10),
    supabase
      .from("monthly_keywords")
      .select("keyword, insights_value, insights_threshold, insights_value_type")
      .eq("location_id", locationId)
      .eq("year_month", prevYm),
  ]);

  const prevMap = new Map(
    (prevRes.data || []).map((k) => [k.keyword, k])
  );

  return (currentRes.data || []).map((kw, i) => {
    const rank = i + 1;
    const prev = prevMap.get(kw.keyword);
    const isThreshold = kw.insights_value_type === "THRESHOLD";
    const displayValue = isThreshold
      ? (kw.insights_threshold ?? 0)
      : (kw.insights_value ?? 0);

    let trend: TrendData;

    if (!prev) {
      trend = { direction: "new", diff: null, label: "NEW" };
    } else if (isThreshold) {
      trend = { direction: "unavailable", diff: null, label: "算出不可" };
    } else if (prev.insights_value_type === "THRESHOLD") {
      trend = { direction: "unavailable", diff: null, label: "算出不可" };
    } else {
      trend = buildTrend(kw.insights_value ?? 0, prev.insights_value ?? 0);
    }

    return {
      rank,
      keyword: kw.keyword,
      insightsValue: displayValue,
      valueType: kw.insights_value_type as "VALUE" | "THRESHOLD",
      trend,
    };
  });
}

// --- HPB データ ---

export async function getReportHpbData(locationId: string): Promise<{
  kpi: HpbKpiData | null;
  timeSeries: HpbMonthlyPoint[];
  hasData: boolean;
}> {
  const supabase = createAdminClient();

  const { data: hpbMetrics } = await supabase
    .from("hpb_monthly_metrics")
    .select("*")
    .eq("location_id", locationId)
    .order("year_month", { ascending: true });

  if (!hpbMetrics || hpbMetrics.length === 0) {
    return { kpi: null, timeSeries: [], hasData: false };
  }

  const timeSeries: HpbMonthlyPoint[] = hpbMetrics.map((m) => ({
    yearMonth: normalizeYearMonth(m.year_month),
    label: formatYearMonthLabel(normalizeYearMonth(m.year_month)),
    salonPv: m.salon_pv,
    salonPvAreaAvg: m.salon_pv_area_avg,
    cvr: m.cvr,
    cvrAreaAvg: m.cvr_area_avg,
    acr: m.acr,
    acrAreaAvg: m.acr_area_avg,
  }));

  const latest = hpbMetrics[hpbMetrics.length - 1];
  const prev =
    hpbMetrics.length >= 2 ? hpbMetrics[hpbMetrics.length - 2] : null;

  const kpi: HpbKpiData = {
    salonPv: {
      label: "サロン情報PV数",
      value: latest.salon_pv ?? 0,
      format: "integer",
      trend: buildTrend(latest.salon_pv, prev?.salon_pv ?? null),
      areaAvg: latest.salon_pv_area_avg ?? 0,
    },
    cvr: {
      label: "CVR",
      value: latest.cvr ?? 0,
      format: "percent1",
      trend: buildTrend(latest.cvr, prev?.cvr ?? null, "percent1"),
      areaAvg: latest.cvr_area_avg ?? 0,
    },
    acr: {
      label: "ACR",
      value: latest.acr ?? 0,
      format: "percent1",
      trend: buildTrend(latest.acr, prev?.acr ?? null, "percent1"),
      areaAvg: latest.acr_area_avg ?? 0,
    },
  };

  return { kpi, timeSeries, hasData: true };
}

// --- クライアントの全店舗一覧取得 ---

export async function getOrgLocations(orgId: string): Promise<
  Array<{ id: string; name: string }>
> {
  const supabase = createAdminClient();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  return locations || [];
}

// --- クライアント名取得 ---

export async function getOrgName(orgId: string): Promise<string> {
  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  return org?.name || "";
}
