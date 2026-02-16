// HPB CSV パース用定数・型定義

// --- ファイル制約 ---

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// --- CSVカラム定義 ---

/** 必須カラム名（重複分は1回のみ記載） */
export const REQUIRED_COLUMNS = [
  "対象年月",
  "サロン情報PV数(自店)",
  "サロン情報PV数(同P同A平均)",
  "CVR(自店)",
  "CVR(同P同A平均)",
  "ACR(自店)",
  "ACR(同P同A平均)",
  "予約数(自店)",
  "予約数(同P同A平均)",
  "予約売上高(自店)",
  "予約売上高(同P同A平均)",
  "総PV数(自店)",
  "総PV数(同P同A平均)",
  "ブログPV数(自店)",
  "ブログPV数(同P同A平均)",
  "クーポンメニューPV数(自店)",
  "クーポンメニューPV数(同P同A平均)",
  "スタイルPV数(自店)",
  "スタイルPV数(同P同A平均)",
] as const;

/** CSVで2回出現する既知の重複カラム名 */
export const KNOWN_DUPLICATE_COLUMNS = [
  "サロン情報PV数(自店)",
  "サロン情報PV数(同P同A平均)",
] as const;

// --- カラム型定義 ---

export type ColumnValidationType = "integer" | "decimal" | "decimal_range";

type ColumnDefinition = {
  csvName: string;
  dbName: string;
  validation: ColumnValidationType;
  /** decimal_range の場合の下限 */
  min?: number;
  /** decimal_range の場合の上限 */
  max?: number;
};

/** CSVカラム名 → DBカラム名 マッピング + バリデーション設定 */
export const COLUMN_DEFINITIONS: ColumnDefinition[] = [
  // PV系（整数）
  { csvName: "サロン情報PV数(自店)", dbName: "salon_pv", validation: "integer" },
  { csvName: "サロン情報PV数(同P同A平均)", dbName: "salon_pv_area_avg", validation: "integer" },
  { csvName: "総PV数(自店)", dbName: "total_pv", validation: "integer" },
  { csvName: "総PV数(同P同A平均)", dbName: "total_pv_area_avg", validation: "integer" },
  { csvName: "ブログPV数(自店)", dbName: "blog_pv", validation: "integer" },
  { csvName: "ブログPV数(同P同A平均)", dbName: "blog_pv_area_avg", validation: "integer" },
  { csvName: "クーポンメニューPV数(自店)", dbName: "coupon_menu_pv", validation: "integer" },
  { csvName: "クーポンメニューPV数(同P同A平均)", dbName: "coupon_menu_pv_area_avg", validation: "integer" },
  { csvName: "スタイルPV数(自店)", dbName: "style_pv", validation: "integer" },
  { csvName: "スタイルPV数(同P同A平均)", dbName: "style_pv_area_avg", validation: "integer" },
  // CVR/ACR（小数、0〜100）
  { csvName: "CVR(自店)", dbName: "cvr", validation: "decimal_range", min: 0, max: 100 },
  { csvName: "CVR(同P同A平均)", dbName: "cvr_area_avg", validation: "decimal_range", min: 0, max: 100 },
  { csvName: "ACR(自店)", dbName: "acr", validation: "decimal_range", min: 0, max: 100 },
  { csvName: "ACR(同P同A平均)", dbName: "acr_area_avg", validation: "decimal_range", min: 0, max: 100 },
  // 予約数（小数）
  { csvName: "予約数(自店)", dbName: "booking_count", validation: "decimal" },
  { csvName: "予約数(同P同A平均)", dbName: "booking_count_area_avg", validation: "decimal" },
  // 予約売上高（整数）
  { csvName: "予約売上高(自店)", dbName: "booking_revenue", validation: "integer" },
  { csvName: "予約売上高(同P同A平均)", dbName: "booking_revenue_area_avg", validation: "integer" },
];

/** CSVカラム名 → DBカラム名 の簡易マップ（lookup用） */
export const CSV_TO_DB_MAP = new Map(
  COLUMN_DEFINITIONS.map((def) => [def.csvName, def.dbName])
);

// --- パース結果型 ---

export type ParseMessageLevel = "error" | "warning" | "info";

export type ParseMessage = {
  level: ParseMessageLevel;
  row?: number;
  column?: string;
  message: string;
};

export type HpbMetricRow = {
  year_month: string;
  salon_pv: number | null;
  salon_pv_area_avg: number | null;
  cvr: number | null;
  cvr_area_avg: number | null;
  acr: number | null;
  acr_area_avg: number | null;
  booking_count: number | null;
  booking_count_area_avg: number | null;
  booking_revenue: number | null;
  booking_revenue_area_avg: number | null;
  total_pv: number | null;
  total_pv_area_avg: number | null;
  blog_pv: number | null;
  blog_pv_area_avg: number | null;
  coupon_menu_pv: number | null;
  coupon_menu_pv_area_avg: number | null;
  style_pv: number | null;
  style_pv_area_avg: number | null;
};

export type ParseResult = {
  rows: HpbMetricRow[];
  errors: ParseMessage[];
  warnings: ParseMessage[];
  skippedRows: number;
  duplicateColumns: string[];
};
