import { createClient } from "@/lib/supabase/server";
import type {
  ClientSummary,
  LocationSummary,
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  KeywordRankingResult,
  KeywordRankingRow,
  HpbData,
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
} from "./utils";

// --- ローカルヘルパー ---

/** 現在の年月を YYYY-MM で返す */
function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 当月の期間ラベルを生成（月途中なら短縮版+完全版、完了月なら undefined） */
function getCurrentPeriodLabel(): { short: string; full: string } | undefined {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const endOfMonth = new Date(year, now.getMonth() + 1, 0);
  if (day < endOfMonth.getDate()) {
    return {
      short: `${month}月1日〜${day}日`,
      full: `${year}年${month}月1日〜${day}日`,
    };
  }
  return undefined;
}

/** 今日の日付を YYYY-MM-DD で返す */
function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// --- クライアント一覧サマリー ---

export async function getClientSummaries(): Promise<{ clients: ClientSummary[]; targetMonth: string }> {
  const supabase = await createClient();
  const currentYM = getCurrentMonth();
  const prevYM = getPreviousMonth(currentYM);
  const prevStart = monthStart(prevYM);
  const prevEnd = monthEnd(prevYM);

  // RLS が自動的に Admin=全件 / Staff=担当のみ にフィルタリング
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name");

  if (!orgs || orgs.length === 0) return { clients: [], targetMonth: prevYM };

  const orgIds = orgs.map((o) => o.id);

  // 全店舗を一括取得
  const { data: locations } = await supabase
    .from("locations")
    .select("id, org_id, is_active")
    .in("org_id", orgIds);

  const activeLocations = (locations || []).filter((l) => l.is_active);
  const locationIds = activeLocations.map((l) => l.id);

  // 前月メトリクス・評価・HPBデータを並列取得
  const [{ data: metrics }, { data: ratings }, { data: hpbData }] =
    await Promise.all([
      supabase
        .from("daily_metrics")
        .select("location_id, metric_type, value")
        .in("location_id", locationIds)
        .gte("date", prevStart)
        .lte("date", prevEnd),
      supabase
        .from("rating_snapshots")
        .select("location_id, rating, review_count, date")
        .in("location_id", locationIds)
        .lte("date", prevEnd)
        .order("date", { ascending: false }),
      supabase
        .from("hpb_monthly_metrics")
        .select("location_id, year_month")
        .in("location_id", locationIds),
    ]);

  // org 別に集計
  const clients = orgs.map((org) => {
    const orgLocations = activeLocations.filter((l) => l.org_id === org.id);
    const orgLocationIds = new Set(orgLocations.map((l) => l.id));

    // メトリクス集計
    const orgMetrics = (metrics || []).filter((m) => orgLocationIds.has(m.location_id));
    const impressions = orgMetrics
      .filter((m) => (IMPRESSION_TYPES as readonly string[]).includes(m.metric_type))
      .reduce((sum, m) => sum + m.value, 0);
    const actions = orgMetrics
      .filter((m) => (ACTION_TYPES as readonly string[]).includes(m.metric_type))
      .reduce((sum, m) => sum + m.value, 0);

    // 評価（レビュー件数加重平均）
    const orgRatings = (ratings || []).filter((r) => orgLocationIds.has(r.location_id));
    // 各店舗の最新レコードだけ取る
    const latestByLocation = new Map<string, { rating: number | null; review_count: number | null }>();
    for (const r of orgRatings) {
      if (!latestByLocation.has(r.location_id)) {
        latestByLocation.set(r.location_id, r);
      }
    }
    let avgRating: number | null = null;
    let totalWeightedRating = 0;
    let totalReviews = 0;
    for (const r of latestByLocation.values()) {
      if (r.rating != null && r.review_count != null && r.review_count > 0) {
        totalWeightedRating += r.rating * r.review_count;
        totalReviews += r.review_count;
      }
    }
    if (totalReviews > 0) {
      avgRating = Math.round((totalWeightedRating / totalReviews) * 10) / 10;
    }

    // HPB アップロード率
    const latestHpbMonth = (hpbData || [])
      .filter((h) => orgLocationIds.has(h.location_id))
      .map((h) => normalizeYearMonth(h.year_month));
    // 直近対象月を特定
    const uniqueMonths = [...new Set(latestHpbMonth)].sort().reverse();
    const targetMonth = uniqueMonths[0];
    const hpbLocationCount = targetMonth
      ? new Set(
          (hpbData || [])
            .filter((h) => orgLocationIds.has(h.location_id) && normalizeYearMonth(h.year_month) === targetMonth)
            .map((h) => h.location_id)
        ).size
      : 0;
    const hpbUploadRate = orgLocations.length > 0
      ? Math.round((hpbLocationCount / orgLocations.length) * 100)
      : 0;

    return {
      orgId: org.id,
      orgName: org.name,
      locationCount: orgLocations.length,
      lastMonthImpressions: impressions,
      lastMonthActions: actions,
      lastMonthAvgRating: avgRating,
      hpbUploadRate,
    };
  });

  return { clients, targetMonth: prevYM };
}

// --- 店舗一覧サマリー ---

export async function getLocationSummaries(orgId: string): Promise<{
  orgName: string;
  locations: LocationSummary[];
  targetMonth: string;
}> {
  const supabase = await createClient();
  const currentYM = getCurrentMonth();
  const prevYM = getPreviousMonth(currentYM);
  const prevStart = monthStart(prevYM);
  const prevEnd = monthEnd(prevYM);

  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  const { data: locations } = await supabase
    .from("locations")
    .select("id, name, is_active")
    .eq("org_id", orgId)
    .eq("is_active", true)
    .order("name");

  if (!locations || locations.length === 0) {
    return { orgName: org?.name || "", locations: [], targetMonth: prevYM };
  }

  const locationIds = locations.map((l) => l.id);

  const { data: metrics } = await supabase
    .from("daily_metrics")
    .select("location_id, metric_type, value")
    .in("location_id", locationIds)
    .gte("date", prevStart)
    .lte("date", prevEnd);

  const { data: ratings } = await supabase
    .from("rating_snapshots")
    .select("location_id, rating, review_count, date")
    .in("location_id", locationIds)
    .order("date", { ascending: false });

  return {
    orgName: org?.name || "",
    locations: locations.map((loc) => {
      const locMetrics = (metrics || []).filter((m) => m.location_id === loc.id);
      const impressions = locMetrics
        .filter((m) => (IMPRESSION_TYPES as readonly string[]).includes(m.metric_type))
        .reduce((sum, m) => sum + m.value, 0);
      const actions = locMetrics
        .filter((m) => (ACTION_TYPES as readonly string[]).includes(m.metric_type))
        .reduce((sum, m) => sum + m.value, 0);

      const latestRating = (ratings || []).find((r) => r.location_id === loc.id);

      return {
        locationId: loc.id,
        locationName: loc.name,
        lastMonthImpressions: impressions,
        lastMonthActions: actions,
        latestRating: latestRating?.rating ?? null,
        latestReviewCount: latestRating?.review_count ?? null,
      };
    }),
    targetMonth: prevYM,
  };
}

// --- GBP KPI ---

export async function getGbpKpiData(locationId: string): Promise<GbpKpiData> {
  const supabase = await createClient();
  const currentYM = getCurrentMonth();
  const prevYM = getPreviousMonth(currentYM);
  const curStart = monthStart(currentYM);
  const curEndDate = today();
  const prevStart = monthStart(prevYM);
  const prevEnd = monthEnd(prevYM);
  const periodLabel = getCurrentPeriodLabel();

  // 当月メトリクス
  const { data: curMetrics } = await supabase
    .from("daily_metrics")
    .select("metric_type, value")
    .eq("location_id", locationId)
    .gte("date", curStart)
    .lte("date", curEndDate);

  // 前月メトリクス
  const { data: prevMetrics } = await supabase
    .from("daily_metrics")
    .select("metric_type, value")
    .eq("location_id", locationId)
    .gte("date", prevStart)
    .lte("date", prevEnd);

  // 最新評価
  const { data: latestRating } = await supabase
    .from("rating_snapshots")
    .select("rating, review_count, date")
    .eq("location_id", locationId)
    .order("date", { ascending: false })
    .limit(1);

  // 前月末の評価
  const { data: prevRating } = await supabase
    .from("rating_snapshots")
    .select("rating, review_count, date")
    .eq("location_id", locationId)
    .lte("date", prevEnd)
    .gte("date", prevStart)
    .order("date", { ascending: false })
    .limit(1);

  const sumByTypes = (rows: { metric_type: string; value: number }[] | null, types: readonly string[]) =>
    (rows || [])
      .filter((r) => types.includes(r.metric_type))
      .reduce((s, r) => s + r.value, 0);

  const curImpressions = sumByTypes(curMetrics, IMPRESSION_TYPES);
  const prevImpressions = sumByTypes(prevMetrics, IMPRESSION_TYPES);
  const curActions = sumByTypes(curMetrics, ACTION_TYPES);
  const prevActions = sumByTypes(prevMetrics, ACTION_TYPES);

  const rating = latestRating?.[0]?.rating ?? null;
  const reviewCount = latestRating?.[0]?.review_count ?? null;
  const prevRatingVal = prevRating?.[0]?.rating ?? null;
  const prevReviewCount = prevRating?.[0]?.review_count ?? null;

  // 期間情報の組み立て
  const currentPeriodLabel = periodLabel?.full ?? formatYearMonthLabel(currentYM);
  const previousMonthLabel = formatYearMonthLabel(prevYM);

  return {
    rating: {
      label: "総合評価",
      value: rating ?? 0,
      format: "rating",
      trend: buildTrend(rating, prevRatingVal, "decimal1"),
      periodLabel: undefined,
    },
    reviewCount: {
      label: "レビュー数",
      value: reviewCount ?? 0,
      format: "integer",
      trend: buildTrend(reviewCount, prevReviewCount),
      periodLabel: undefined,
    },
    totalImpressions: {
      label: "合計閲覧数",
      value: curImpressions,
      format: "integer",
      trend: buildTrend(curImpressions, prevImpressions),
      periodLabel: periodLabel?.short,
    },
    totalActions: {
      label: "合計アクション数",
      value: curActions,
      format: "integer",
      trend: buildTrend(curActions, prevActions),
      periodLabel: periodLabel?.short,
    },
    periodInfo: {
      currentPeriodLabel,
      previousMonthLabel,
      description: `当月（${currentPeriodLabel}）と前月（${previousMonthLabel}）の比較`,
    },
  };
}

// --- メトリクス時系列（月次集計） ---

export async function getMetricsTimeSeries(
  locationId: string,
  startMonth: string,
  endMonth: string
): Promise<MonthlyMetricPoint[]> {
  const supabase = await createClient();
  const startDate = monthStart(startMonth);
  const endDate = endMonth === getCurrentMonth() ? today() : monthEnd(endMonth);

  const { data } = await supabase.rpc("get_monthly_metrics", {
    p_location_id: locationId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  const allMonths = generateMonthRange(startMonth, endMonth);
  return pivotMonthlyMetrics(data ?? [], allMonths);
}

// --- デバイス内訳 ---

export async function getDeviceBreakdown(
  locationId: string,
  yearMonth: string
): Promise<DeviceBreakdownItem[]> {
  const supabase = await createClient();
  const startDate = monthStart(yearMonth);
  const endDate = yearMonth === getCurrentMonth() ? today() : monthEnd(yearMonth);

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

// --- キーワードランキング ---

export async function getKeywordRanking(
  locationId: string,
  yearMonth: string
): Promise<KeywordRankingResult> {
  const supabase = await createClient();
  const normalized = normalizeYearMonth(yearMonth);
  const prevYM = getPreviousMonth(normalized);
  const ym = normalized.replace("-", "");
  const prevYm = prevYM.replace("-", "");

  // 当月キーワード（上位10件）
  const { data: currentKw } = await supabase
    .from("monthly_keywords")
    .select("keyword, insights_value, insights_threshold, insights_value_type")
    .eq("location_id", locationId)
    .eq("year_month", ym)
    .order("insights_value", { ascending: false, nullsFirst: false })
    .limit(10);

  // 前月キーワード（前月比計算用）
  const { data: prevKw } = await supabase
    .from("monthly_keywords")
    .select("keyword, insights_value, insights_threshold, insights_value_type")
    .eq("location_id", locationId)
    .eq("year_month", prevYm);

  const prevMap = new Map(
    (prevKw || []).map((k) => [k.keyword, k])
  );

  const rows: KeywordRankingRow[] = (currentKw || []).map((kw, i) => {
    const rank = i + 1;
    const prev = prevMap.get(kw.keyword);
    const isThreshold = kw.insights_value_type === "THRESHOLD";
    const displayValue = isThreshold ? (kw.insights_threshold ?? 0) : (kw.insights_value ?? 0);

    let trend: TrendData;

    if (!prev) {
      // FR24: 当月新規
      trend = { direction: "new", diff: null, label: "NEW" };
    } else if (isThreshold) {
      // FR22: 当月が threshold
      trend = { direction: "unavailable", diff: null, label: "算出不可" };
    } else if (prev.insights_value_type === "THRESHOLD") {
      // FR23: 前月が threshold
      trend = { direction: "unavailable", diff: null, label: "算出不可" };
    } else {
      // FR21: 当月・前月ともに value
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

  return {
    rows,
    yearMonth,
  };
}

// --- HPB データ ---

export async function getHpbData(locationId: string): Promise<HpbData> {
  const supabase = await createClient();

  // HPB 月次指標（全月分）
  const { data: hpbMetrics } = await supabase
    .from("hpb_monthly_metrics")
    .select("*")
    .eq("location_id", locationId)
    .order("year_month", { ascending: true });

  // 最新アップロードログ
  const { data: uploadLog } = await supabase
    .from("hpb_upload_logs")
    .select("uploaded_at, uploaded_by, file_name")
    .eq("location_id", locationId)
    .eq("status", "success")
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (!hpbMetrics || hpbMetrics.length === 0) {
    return { kpi: null, timeSeries: [], uploadInfo: null, hasData: false };
  }

  // 時系列
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

  // KPI（最新月 + 前月比）
  const latest = hpbMetrics[hpbMetrics.length - 1];
  const prev = hpbMetrics.length >= 2 ? hpbMetrics[hpbMetrics.length - 2] : null;

  const kpi = {
    salonPv: {
      label: "サロン情報PV数",
      value: latest.salon_pv ?? 0,
      format: "integer" as const,
      trend: buildTrend(latest.salon_pv, prev?.salon_pv ?? null),
      areaAvg: latest.salon_pv_area_avg ?? 0,
    },
    cvr: {
      label: "CVR",
      value: latest.cvr ?? 0,
      format: "percent1" as const,
      trend: buildTrend(latest.cvr, prev?.cvr ?? null, "percent1"),
      areaAvg: latest.cvr_area_avg ?? 0,
    },
    acr: {
      label: "ACR",
      value: latest.acr ?? 0,
      format: "percent1" as const,
      trend: buildTrend(latest.acr, prev?.acr ?? null, "percent1"),
      areaAvg: latest.acr_area_avg ?? 0,
    },
  };

  // アップロード情報
  const uploadInfo = uploadLog?.[0]
    ? {
        lastUploadedAt: uploadLog[0].uploaded_at,
        uploadedBy: uploadLog[0].uploaded_by,
        dataRangeStart: formatYearMonthLabel(normalizeYearMonth(hpbMetrics[0].year_month)),
        dataRangeEnd: formatYearMonthLabel(normalizeYearMonth(latest.year_month)),
      }
    : null;

  const latestMonthLabel = formatYearMonthLabel(normalizeYearMonth(latest.year_month));

  return { kpi, timeSeries, uploadInfo, hasData: true, latestMonthLabel };
}

// --- 店舗情報取得 ---

export async function getLocationInfo(locationId: string): Promise<{
  locationName: string;
  orgId: string;
  orgName: string;
} | null> {
  const supabase = await createClient();

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
