// ダッシュボードUI用型定義

// --- 前月比・トレンド ---

export type TrendDirection = "up" | "down" | "flat" | "unavailable" | "new";

export type TrendData = {
  direction: TrendDirection;
  /** 差分値（算出不可の場合は null） */
  diff: number | null;
  /** 差分の表示テキスト（例: "+120", "-3.2%", "算出不可", "NEW"） */
  label: string;
};

// --- KPI ---

export type KpiValue = {
  label: string;
  value: number | string;
  /** 表示フォーマット（例: "integer", "decimal1", "percent1", "rating"） */
  format: "integer" | "decimal1" | "percent1" | "rating";
  trend: TrendData;
  /** 月途中の期間ラベル（例: "2月1日〜16日"） */
  periodLabel?: string;
};

// --- クライアント一覧 ---

export type ClientSummary = {
  orgId: string;
  orgName: string;
  locationCount: number;
  lastMonthImpressions: number;
  lastMonthActions: number;
  lastMonthAvgRating: number | null;
  hpbUploadRate: number;
};

// --- 店舗一覧 ---

export type LocationSummary = {
  locationId: string;
  locationName: string;
  lastMonthImpressions: number;
  lastMonthActions: number;
  latestRating: number | null;
  latestReviewCount: number | null;
};

// --- GBP KPI ---

export type GbpKpiData = {
  rating: KpiValue;
  reviewCount: KpiValue;
  totalImpressions: KpiValue;
  totalActions: KpiValue;
};

// --- メトリクス時系列 ---

export type MonthlyMetricPoint = {
  yearMonth: string;
  /** 表示用ラベル（例: "2026年1月"） */
  label: string;
  impressionsDesktopSearch: number;
  impressionsMobileSearch: number;
  impressionsDesktopMaps: number;
  impressionsMobileMaps: number;
  callClicks: number;
  directionRequests: number;
  websiteClicks: number;
};

// --- デバイス内訳 ---

export type DeviceBreakdownItem = {
  name: string;
  value: number;
  /** 割合（%） */
  percentage: number;
};

// --- キーワードランキング ---

export type KeywordValueType = "VALUE" | "THRESHOLD";

export type KeywordRankingRow = {
  rank: number;
  keyword: string;
  /** 指標値（value の場合は実数、threshold の場合は閾値） */
  insightsValue: number;
  valueType: KeywordValueType;
  /** 前月比の表示情報 */
  trend: TrendData;
};

export type KeywordRankingResult = {
  rows: KeywordRankingRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  yearMonth: string;
};

// --- HPB ---

export type HpbKpiData = {
  salonPv: KpiValue & { areaAvg: number };
  cvr: KpiValue & { areaAvg: number };
  acr: KpiValue & { areaAvg: number };
};

export type HpbMonthlyPoint = {
  yearMonth: string;
  label: string;
  salonPv: number | null;
  salonPvAreaAvg: number | null;
  cvr: number | null;
  cvrAreaAvg: number | null;
  acr: number | null;
  acrAreaAvg: number | null;
};

export type HpbUploadInfo = {
  lastUploadedAt: string;
  uploadedBy: string;
  dataRangeStart: string;
  dataRangeEnd: string;
};

export type HpbData = {
  kpi: HpbKpiData | null;
  timeSeries: HpbMonthlyPoint[];
  uploadInfo: HpbUploadInfo | null;
  hasData: boolean;
};

// --- 期間選択 ---

export type PeriodPreset = "3m" | "6m" | "12m" | "custom";

export type PeriodRange = {
  preset: PeriodPreset;
  startMonth: string;
  endMonth: string;
};
