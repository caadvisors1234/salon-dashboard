// GBP API 関連の型定義

// ============================================
// DailyMetric 指標タイプ
// ============================================

export const DAILY_METRIC_TYPES = [
  "BUSINESS_IMPRESSIONS_DESKTOP_SEARCH",
  "BUSINESS_IMPRESSIONS_MOBILE_SEARCH",
  "BUSINESS_IMPRESSIONS_DESKTOP_MAPS",
  "BUSINESS_IMPRESSIONS_MOBILE_MAPS",
  "CALL_CLICKS",
  "BUSINESS_DIRECTION_REQUESTS",
  "WEBSITE_CLICKS",
] as const;

export type DailyMetricType = (typeof DAILY_METRIC_TYPES)[number];

// ============================================
// Google API Date 型
// ============================================

export interface GoogleDate {
  year: number;
  month: number;
  day: number;
}

// ============================================
// Performance API v1 レスポンス型
// ============================================

export interface DatedValue {
  date: GoogleDate;
  value?: string;
}

export interface TimeSeries {
  datedValues: DatedValue[];
}

export interface DailyMetricTimeSeries {
  dailyMetric: DailyMetricType;
  timeSeries: TimeSeries;
}

export interface MultiDailyMetricTimeSeriesItem {
  dailyMetricTimeSeries: DailyMetricTimeSeries[];
}

export interface FetchMultiDailyMetricsResponse {
  multiDailyMetricTimeSeries: MultiDailyMetricTimeSeriesItem[];
}

// ============================================
// Search Keywords API レスポンス型
// ============================================

export interface InsightsValue {
  value?: string;
  threshold?: string;
}

export interface SearchKeywordCount {
  searchKeyword: string;
  insightsValue: InsightsValue;
}

export interface SearchKeywordsResponse {
  searchKeywordsCounts?: SearchKeywordCount[];
  nextPageToken?: string;
}

// ============================================
// Reviews API v4.9 レスポンス型
// ============================================

export interface ReviewsListResponse {
  reviews?: unknown[];
  averageRating?: number;
  totalReviewCount?: number;
  nextPageToken?: string;
}

// ============================================
// Accounts / Locations API レスポンス型
// ============================================

export interface GbpAccount {
  name: string; // "accounts/xxx"
  accountName?: string;
  type?: string;
  role?: string;
}

export interface AccountsListResponse {
  accounts?: GbpAccount[];
  nextPageToken?: string;
}

export interface GbpLocation {
  name: string; // "locations/xxx"
  title?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
  };
  metadata?: {
    placeId?: string;
  };
}

export interface LocationsListResponse {
  locations?: GbpLocation[];
  nextPageToken?: string;
}

// ============================================
// 内部データ型（パース済み）
// ============================================

export interface DailyMetricResult {
  date: string; // YYYY-MM-DD
  metricType: DailyMetricType;
  value: number;
}

export interface KeywordResult {
  keyword: string;
  insightsValueType: "VALUE" | "THRESHOLD";
  insightsValue: number | null;
  insightsThreshold: number | null;
}

export interface RatingData {
  averageRating: number | null;
  totalReviewCount: number | null;
  fetchedAt: Date;
}

// ============================================
// OAuth トークン型
// ============================================

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiryDate: Date;
  scopes: string;
  googleEmail: string;
}

export interface StoredOAuthToken {
  id: string;
  userId: string;
  googleEmail: string;
  tokenExpiry: string;
  scopes: string;
  isValid: boolean;
}

// ============================================
// API エンドポイント定数
// ============================================

export const GBP_API = {
  PERFORMANCE_BASE: "https://businessprofileperformance.googleapis.com/v1",
  REVIEWS_BASE: "https://mybusiness.googleapis.com/v4",
  ACCOUNTS_BASE: "https://mybusinessaccountmanagement.googleapis.com/v1",
  BUSINESS_INFO_BASE:
    "https://mybusinessbusinessinformation.googleapis.com/v1",
  OAUTH_TOKEN_URL: "https://oauth2.googleapis.com/token",
  OAUTH_AUTH_URL: "https://accounts.google.com/o/oauth2/v2/auth",
  USERINFO_URL: "https://openidconnect.googleapis.com/v1/userinfo",
} as const;
