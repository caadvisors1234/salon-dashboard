import iconv from "iconv-lite";
import { parse } from "csv-parse/sync";
import {
  REQUIRED_COLUMNS,
  KNOWN_DUPLICATE_COLUMNS,
  COLUMN_DEFINITIONS,
  type ParseResult,
  type ParseMessage,
  type HpbMetricRow,
} from "./constants";

/**
 * HPB CSV（Shift_JIS）をパースし、バリデーション済みの行データを返す。
 *
 * - Shift_JIS → UTF-8 変換
 * - ヘッダー検証（必須カラム・重複カラム検知）
 * - 行ごとバリデーション（型チェック・範囲チェック）
 */
export function parseHpbCsv(buffer: Buffer): ParseResult {
  const errors: ParseMessage[] = [];
  const warnings: ParseMessage[] = [];
  const duplicateColumns: string[] = [];
  let skippedRows = 0;

  // Step 1: Shift_JIS → UTF-8 変換
  const decoded = iconv.decode(buffer, "Shift_JIS");

  // BOM除去
  const content = decoded.charCodeAt(0) === 0xfeff ? decoded.slice(1) : decoded;

  // Step 2: CSV パース（行配列として取得）
  let records: string[][];
  try {
    records = parse(content, {
      columns: false,
      skip_empty_lines: true,
      relax_column_count: true,
    });
  } catch {
    errors.push({
      level: "error",
      message: "CSVの解析に失敗しました。ファイル形式を確認してください。",
    });
    return { rows: [], errors, warnings, skippedRows: 0, duplicateColumns };
  }

  if (records.length < 2) {
    errors.push({
      level: "error",
      message: "CSVにデータ行がありません。ヘッダー行とデータ行が必要です。",
    });
    return { rows: [], errors, warnings, skippedRows: 0, duplicateColumns };
  }

  // Step 3: ヘッダー行を取得し、カラム名の出現回数をカウント
  const headerRow = records[0].map((h) => h.trim());

  const columnCounts = new Map<string, number>();
  for (const col of headerRow) {
    columnCounts.set(col, (columnCounts.get(col) ?? 0) + 1);
  }

  // Step 4: 重複カラム検知
  for (const [col, count] of columnCounts) {
    if (count > 1) {
      duplicateColumns.push(col);
      warnings.push({
        level: "warning",
        column: col,
        message: `カラム「${col}」が${count}回出現しています。先頭列の値を採用します。`,
      });
    }
  }

  // Step 5: エンコーディング判定 — ヘッダーに「対象年月」が含まれるか
  if (!headerRow.includes("対象年月")) {
    errors.push({
      level: "error",
      message:
        "ヘッダー行に「対象年月」カラムが見つかりません。Shift_JIS エンコーディングのCSVファイルを使用してください。",
    });
    return { rows: [], errors, warnings, skippedRows, duplicateColumns };
  }

  // Step 6: 必須カラムの存在チェック
  const missingColumns: string[] = [];
  for (const required of REQUIRED_COLUMNS) {
    if (!headerRow.includes(required)) {
      missingColumns.push(required);
    }
  }

  if (missingColumns.length > 0) {
    errors.push({
      level: "error",
      message: `必須カラムが不足しています: ${missingColumns.join(", ")}`,
    });
    return { rows: [], errors, warnings, skippedRows, duplicateColumns };
  }

  // Step 7: カラム名 → 列インデックスのマッピング（先頭出現を採用）
  const columnIndexMap = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const col = headerRow[i];
    // 先頭出現のみ登録（重複カラムは後の出現を無視）
    if (!columnIndexMap.has(col)) {
      columnIndexMap.set(col, i);
    }
  }

  // 対象年月の列インデックス
  const yearMonthIndex = columnIndexMap.get("対象年月")!;

  // Step 8: データ行のバリデーション・変換
  const rows: HpbMetricRow[] = [];

  for (let rowIdx = 1; rowIdx < records.length; rowIdx++) {
    const record = records[rowIdx];
    const rowNum = rowIdx + 1; // 表示用行番号（1-based、ヘッダー込み）

    // 対象年月バリデーション
    const yearMonthRaw = record[yearMonthIndex]?.trim() ?? "";
    if (!isValidYearMonth(yearMonthRaw)) {
      warnings.push({
        level: "warning",
        row: rowNum,
        column: "対象年月",
        message: `対象年月の値が不正です: "${yearMonthRaw}"（YYYYMM形式の6桁数値が必要）`,
      });
      skippedRows++;
      continue;
    }

    const yearMonth = yearMonthRaw;

    // 各カラムのバリデーション・変換
    let rowSkipped = false;
    const rowData: Record<string, number | null> = {};

    for (const def of COLUMN_DEFINITIONS) {
      const colIndex = columnIndexMap.get(def.csvName);
      if (colIndex === undefined) continue;

      const rawValue = record[colIndex]?.trim() ?? "";

      // 空値はnullとして扱う
      if (rawValue === "") {
        rowData[def.dbName] = null;
        continue;
      }

      const validationResult = validateValue(
        rawValue,
        def.validation,
        def.min,
        def.max
      );

      if (validationResult.type === "skip") {
        warnings.push({
          level: "warning",
          row: rowNum,
          column: def.csvName,
          message: validationResult.message,
        });
        rowSkipped = true;
        break;
      }

      if (validationResult.type === "warning") {
        warnings.push({
          level: "warning",
          row: rowNum,
          column: def.csvName,
          message: validationResult.message,
        });
      }

      rowData[def.dbName] = validationResult.value;
    }

    if (rowSkipped) {
      skippedRows++;
      continue;
    }

    rows.push({
      year_month: yearMonth,
      salon_pv: rowData.salon_pv ?? null,
      salon_pv_area_avg: rowData.salon_pv_area_avg ?? null,
      cvr: rowData.cvr ?? null,
      cvr_area_avg: rowData.cvr_area_avg ?? null,
      acr: rowData.acr ?? null,
      acr_area_avg: rowData.acr_area_avg ?? null,
      booking_count: rowData.booking_count ?? null,
      booking_count_area_avg: rowData.booking_count_area_avg ?? null,
      booking_revenue: rowData.booking_revenue ?? null,
      booking_revenue_area_avg: rowData.booking_revenue_area_avg ?? null,
      total_pv: rowData.total_pv ?? null,
      total_pv_area_avg: rowData.total_pv_area_avg ?? null,
      blog_pv: rowData.blog_pv ?? null,
      blog_pv_area_avg: rowData.blog_pv_area_avg ?? null,
      coupon_menu_pv: rowData.coupon_menu_pv ?? null,
      coupon_menu_pv_area_avg: rowData.coupon_menu_pv_area_avg ?? null,
      style_pv: rowData.style_pv ?? null,
      style_pv_area_avg: rowData.style_pv_area_avg ?? null,
    });
  }

  return { rows, errors, warnings, skippedRows, duplicateColumns };
}

// --- ヘルパー関数 ---

/** YYYYMM 6桁数値かチェック */
function isValidYearMonth(value: string): boolean {
  if (!/^\d{6}$/.test(value)) return false;
  const year = parseInt(value.slice(0, 4), 10);
  const month = parseInt(value.slice(4, 6), 10);
  return year >= 2000 && year <= 2100 && month >= 1 && month <= 12;
}

type ValidationOk = { type: "ok"; value: number };
type ValidationWarning = { type: "warning"; value: number; message: string };
type ValidationSkip = { type: "skip"; value: null; message: string };
type ValidationResult = ValidationOk | ValidationWarning | ValidationSkip;

/** 値のバリデーション */
function validateValue(
  raw: string,
  validation: "integer" | "decimal" | "decimal_range",
  min?: number,
  max?: number
): ValidationResult {
  if (validation === "integer") {
    // 小数点を含む整数（例: "154.0"）にも対応
    const num = Number(raw);
    if (isNaN(num)) {
      return {
        type: "skip",
        value: null,
        message: `整数値が必要ですが "${raw}" が指定されています`,
      };
    }
    return { type: "ok", value: Math.round(num) };
  }

  if (validation === "decimal") {
    const num = parseFloat(raw);
    if (isNaN(num)) {
      return {
        type: "skip",
        value: null,
        message: `数値が必要ですが "${raw}" が指定されています`,
      };
    }
    return { type: "ok", value: num };
  }

  if (validation === "decimal_range") {
    const num = parseFloat(raw);
    if (isNaN(num)) {
      return {
        type: "skip",
        value: null,
        message: `数値が必要ですが "${raw}" が指定されています`,
      };
    }
    if (min !== undefined && max !== undefined && (num < min || num > max)) {
      return {
        type: "warning",
        value: num,
        message: `値 ${num} が範囲外です（${min}〜${max}）`,
      };
    }
    return { type: "ok", value: num };
  }

  return { type: "ok", value: Number(raw) };
}
