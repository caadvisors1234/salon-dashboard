import fs from "fs";
import { parseHpbCsv } from "../src/lib/hpb/csv-parser";

let allPassed = true;
function assert(label: string, condition: boolean, detail?: string) {
  if (condition) {
    console.log(`  PASS: ${label}`);
  } else {
    console.log(`  FAIL: ${label}${detail ? ` (${detail})` : ""}`);
    allPassed = false;
  }
}

// --- テスト1: 正常Shift_JIS CSV ---
console.log("=== テスト1: 正常Shift_JIS CSV ===");
const buf1 = fs.readFileSync("./test/fixtures/hpb-test.csv");
const r1 = parseHpbCsv(buf1);

assert("エラーなし", r1.errors.length === 0);
assert("4行取り込み", r1.rows.length === 4, `actual: ${r1.rows.length}`);
assert("1行スキップ", r1.skippedRows === 1, `actual: ${r1.skippedRows}`);
assert("重複カラム2件検知", r1.duplicateColumns.length === 2);

// CVR範囲外ワーニング
const cvrWarning = r1.warnings.find(
  (w) => w.column === "CVR(自店)" && w.message.includes("105.2")
);
assert("CVR範囲外ワーニング", cvrWarning !== undefined);

// 対象年月不正行スキップ
const ymWarning = r1.warnings.find(
  (w) => w.column === "対象年月" && w.message.includes("abc123")
);
assert("対象年月不正行スキップ", ymWarning !== undefined);

// 202504行（CVR範囲外）がデータに含まれている
const row4 = r1.rows.find((r) => r.year_month === "202504");
assert("CVR範囲外行が取り込まれる", row4 !== undefined);
assert("CVR値が保持される", row4?.cvr === 105.2, `actual: ${row4?.cvr}`);

// データ値検証（1行目）
const row1 = r1.rows[0];
assert("year_month = 202501", row1.year_month === "202501");
assert("salon_pv = 1200", row1.salon_pv === 1200);
assert("cvr = 61.2", row1.cvr === 61.2);
assert("acr = 10.4", row1.acr === 10.4);
assert("booking_count = 154", row1.booking_count === 154);
assert("booking_revenue = 1250000", row1.booking_revenue === 1250000);
assert("total_pv = 3500", row1.total_pv === 3500);
assert("blog_pv = 450", row1.blog_pv === 450);

console.log("");

// --- テスト2: UTF-8 CSV → エンコーディングエラー ---
console.log("=== テスト2: UTF-8 CSV（エンコーディングエラー検知） ===");
const buf2 = fs.readFileSync("./test/fixtures/hpb-test-utf8.csv");
const r2 = parseHpbCsv(buf2);

assert("エラー1件", r2.errors.length === 1);
assert(
  "エンコーディングエラーメッセージ",
  r2.errors[0]?.message.includes("対象年月")
);
assert("データ行なし", r2.rows.length === 0);

console.log("");

// --- テスト3: ヘッダー不正CSV ---
console.log("=== テスト3: ヘッダー不正CSV ===");
const buf3 = fs.readFileSync("./test/fixtures/hpb-test-bad-header.csv");
const r3 = parseHpbCsv(buf3);

assert("エラー1件", r3.errors.length === 1);
assert("不足カラム名を含む", r3.errors[0]?.message.includes("CVR(自店)"));
assert("データ行なし", r3.rows.length === 0);

console.log("");

// --- テスト4: 空ファイル ---
console.log("=== テスト4: 空バッファ ===");
const r4 = parseHpbCsv(Buffer.from(""));
assert("エラーあり", r4.errors.length > 0);

console.log("");

// --- 結果 ---
if (allPassed) {
  console.log("ALL TESTS PASSED");
} else {
  console.log("SOME TESTS FAILED");
  process.exit(1);
}
