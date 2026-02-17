/**
 * テストデータファクトリ
 */

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${String(++idCounter).padStart(3, "0")}`;
}

/** ファクトリカウンターをリセット */
export function resetFixtureIds(): void {
  idCounter = 0;
}

export function createOrg(overrides?: Record<string, unknown>) {
  return {
    id: nextId("org"),
    name: "テストサロングループ",
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createLocation(overrides?: Record<string, unknown>) {
  return {
    id: nextId("loc"),
    org_id: "org-001",
    name: "テスト店舗",
    gbp_location_id: null,
    created_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

export function createDailyMetric(overrides?: Record<string, unknown>) {
  return {
    id: nextId("metric"),
    location_id: "loc-001",
    date: "2025-01-15",
    metric_type: "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
    value: 100,
    ...overrides,
  };
}

export function createHpbMetricRow(overrides?: Record<string, unknown>) {
  return {
    year_month: "202501",
    salon_pv: 1200,
    salon_pv_area_avg: 800,
    cvr: 61.2,
    cvr_area_avg: 55.0,
    acr: 10.4,
    acr_area_avg: 8.2,
    booking_count: 154,
    booking_count_area_avg: 120,
    booking_revenue: 1250000,
    booking_revenue_area_avg: 980000,
    total_pv: 3500,
    total_pv_area_avg: 2800,
    blog_pv: 450,
    blog_pv_area_avg: 300,
    coupon_menu_pv: 200,
    coupon_menu_pv_area_avg: 150,
    style_pv: 180,
    style_pv_area_avg: 130,
    ...overrides,
  };
}
