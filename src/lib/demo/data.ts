import type {
  GbpKpiData,
  MonthlyMetricPoint,
  DeviceBreakdownItem,
  KeywordRankingResult,
  HpbData,
} from "@/types/dashboard";
import { formatYearMonthLabel } from "@/lib/dashboard/utils";

// --- 店舗情報 ---
export const DEMO_LOCATION_NAME = "Hair Salon BLOOM 渋谷店";
export const DEMO_ORG_NAME = "株式会社BLOOM";

// --- GBP KPI ---
export const DEMO_GBP_KPI: GbpKpiData = {
  rating: {
    label: "総合評価",
    value: 4.6,
    format: "rating",
    trend: { direction: "up", diff: 0.1, label: "+0.1" },
  },
  reviewCount: {
    label: "レビュー数",
    value: 187,
    format: "integer",
    trend: { direction: "up", diff: 12, label: "+12" },
  },
  totalImpressions: {
    label: "合計閲覧数",
    value: 12845,
    format: "integer",
    trend: { direction: "up", diff: 983, label: "+983" },
  },
  totalActions: {
    label: "合計アクション数",
    value: 1523,
    format: "integer",
    trend: { direction: "up", diff: 82, label: "+82" },
  },
  periodInfo: {
    currentPeriodLabel: "2026年2月",
    previousMonthLabel: "2026年1月",
    description: "2026年2月のGBPパフォーマンス（前月比）",
  },
};

// --- 時系列データ（13ヶ月分：過去12ヶ月+当月） ---
function generateTimeSeries(): MonthlyMetricPoint[] {
  const baseData = [
    { ym: "2025-03", dsSearch: 1200, msSearch: 2800, dsMaps: 800, msMaps: 3200, calls: 85, dirs: 120, web: 95 },
    { ym: "2025-04", dsSearch: 1350, msSearch: 3050, dsMaps: 850, msMaps: 3450, calls: 92, dirs: 135, web: 105 },
    { ym: "2025-05", dsSearch: 1280, msSearch: 2950, dsMaps: 820, msMaps: 3350, calls: 88, dirs: 128, web: 98 },
    { ym: "2025-06", dsSearch: 1420, msSearch: 3200, dsMaps: 900, msMaps: 3600, calls: 98, dirs: 142, web: 112 },
    { ym: "2025-07", dsSearch: 1500, msSearch: 3400, dsMaps: 950, msMaps: 3800, calls: 105, dirs: 155, web: 120 },
    { ym: "2025-08", dsSearch: 1380, msSearch: 3150, dsMaps: 880, msMaps: 3550, calls: 95, dirs: 140, web: 108 },
    { ym: "2025-09", dsSearch: 1450, msSearch: 3300, dsMaps: 920, msMaps: 3700, calls: 100, dirs: 148, web: 115 },
    { ym: "2025-10", dsSearch: 1520, msSearch: 3500, dsMaps: 960, msMaps: 3900, calls: 108, dirs: 158, web: 125 },
    { ym: "2025-11", dsSearch: 1600, msSearch: 3650, dsMaps: 1000, msMaps: 4100, calls: 115, dirs: 168, web: 132 },
    { ym: "2025-12", dsSearch: 1700, msSearch: 3800, dsMaps: 1050, msMaps: 4300, calls: 125, dirs: 180, web: 140 },
    { ym: "2026-01", dsSearch: 1550, msSearch: 3550, dsMaps: 980, msMaps: 3980, calls: 110, dirs: 160, web: 128 },
    { ym: "2026-02", dsSearch: 1650, msSearch: 3700, dsMaps: 1020, msMaps: 4175, calls: 118, dirs: 172, web: 135 },
    { ym: "2026-03", dsSearch: 1580, msSearch: 3620, dsMaps: 1000, msMaps: 4080, calls: 112, dirs: 165, web: 130 },
  ];

  return baseData.map((d) => ({
    yearMonth: d.ym,
    label: formatYearMonthLabel(d.ym),
    impressionsDesktopSearch: d.dsSearch,
    impressionsMobileSearch: d.msSearch,
    impressionsDesktopMaps: d.dsMaps,
    impressionsMobileMaps: d.msMaps,
    callClicks: d.calls,
    directionRequests: d.dirs,
    websiteClicks: d.web,
  }));
}

export const DEMO_TIME_SERIES: MonthlyMetricPoint[] = generateTimeSeries();

// --- デバイス内訳（最新月） ---
// name は DeviceBreakdownChart の NAME_TO_KEY と一致させる
export const DEMO_DEVICE_BREAKDOWN: DeviceBreakdownItem[] = [
  { name: "Google検索 (モバイル)", value: 3700, percentage: 35.1 },
  { name: "Googleマップ (モバイル)", value: 4175, percentage: 39.6 },
  { name: "Google検索 (PC)", value: 1650, percentage: 15.7 },
  { name: "Googleマップ (PC)", value: 1020, percentage: 9.7 },
];

export const DEMO_DEVICE_MONTH_LABEL = "2026年2月";

// --- キーワードランキング ---
export const DEMO_KEYWORD_RANKING: KeywordRankingResult = {
  yearMonth: "2026-01",
  rows: [
    { rank: 1, keyword: "渋谷 美容室", insightsValue: 1850, valueType: "VALUE", trend: { direction: "up", diff: 120, label: "+120" } },
    { rank: 2, keyword: "渋谷 ヘアサロン", insightsValue: 1420, valueType: "VALUE", trend: { direction: "up", diff: 85, label: "+85" } },
    { rank: 3, keyword: "ヘアカラー 渋谷", insightsValue: 980, valueType: "VALUE", trend: { direction: "up", diff: 45, label: "+45" } },
    { rank: 4, keyword: "渋谷 カット 安い", insightsValue: 750, valueType: "VALUE", trend: { direction: "down", diff: -30, label: "-30" } },
    { rank: 5, keyword: "渋谷 縮毛矯正", insightsValue: 620, valueType: "VALUE", trend: { direction: "up", diff: 55, label: "+55" } },
    { rank: 6, keyword: "渋谷 トリートメント", insightsValue: 480, valueType: "VALUE", trend: { direction: "flat", diff: 0, label: "±0" } },
    { rank: 7, keyword: "渋谷 ヘッドスパ", insightsValue: 350, valueType: "VALUE", trend: { direction: "up", diff: 28, label: "+28" } },
    { rank: 8, keyword: "hair salon bloom", insightsValue: 280, valueType: "VALUE", trend: { direction: "up", diff: 95, label: "+95" } },
    { rank: 9, keyword: "渋谷 美容室 メンズ", insightsValue: 220, valueType: "VALUE", trend: { direction: "up", diff: 18, label: "+18" } },
    { rank: 10, keyword: "渋谷 白髪染め", insightsValue: 150, valueType: "VALUE", trend: { direction: "down", diff: -12, label: "-12" } },
  ],
};

// --- HPBデータ ---
export const DEMO_HPB_DATA: HpbData = {
  hasData: true,
  latestMonthLabel: "2026年2月",
  uploadInfo: {
    lastUploadedAt: "2026-03-01T10:30:00+09:00",
    uploadedBy: "田中 花子",
    dataRangeStart: "2025年9月",
    dataRangeEnd: "2026年2月",
  },
  kpi: {
    salonPv: {
      label: "サロン情報PV",
      value: 3280,
      format: "integer",
      trend: { direction: "up", diff: 245, label: "+245" },
      areaAvg: 2450,
    },
    cvr: {
      label: "CVR",
      value: 12.4,
      format: "percent1",
      trend: { direction: "up", diff: 0.8, label: "+0.8%" },
      areaAvg: 9.2,
    },
    acr: {
      label: "ACR",
      value: 8.7,
      format: "percent1",
      trend: { direction: "up", diff: 0.3, label: "+0.3%" },
      areaAvg: 7.1,
    },
  },
  timeSeries: [
    { yearMonth: "2025-09", label: "2025年9月", salonPv: 2680, salonPvAreaAvg: 2350, cvr: 10.2, cvrAreaAvg: 9.0, acr: 7.5, acrAreaAvg: 7.0 },
    { yearMonth: "2025-10", label: "2025年10月", salonPv: 2850, salonPvAreaAvg: 2380, cvr: 10.8, cvrAreaAvg: 9.1, acr: 7.8, acrAreaAvg: 7.0 },
    { yearMonth: "2025-11", label: "2025年11月", salonPv: 2950, salonPvAreaAvg: 2400, cvr: 11.2, cvrAreaAvg: 9.1, acr: 8.0, acrAreaAvg: 7.1 },
    { yearMonth: "2025-12", label: "2025年12月", salonPv: 3150, salonPvAreaAvg: 2420, cvr: 11.8, cvrAreaAvg: 9.2, acr: 8.3, acrAreaAvg: 7.1 },
    { yearMonth: "2026-01", label: "2026年1月", salonPv: 3035, salonPvAreaAvg: 2430, cvr: 11.6, cvrAreaAvg: 9.2, acr: 8.4, acrAreaAvg: 7.1 },
    { yearMonth: "2026-02", label: "2026年2月", salonPv: 3280, salonPvAreaAvg: 2450, cvr: 12.4, cvrAreaAvg: 9.2, acr: 8.7, acrAreaAvg: 7.1 },
  ],
};
