#!/usr/bin/env node
/**
 * Generate test CSV fixtures for HPB (Hot Pepper Beauty) upload testing.
 *
 * Files produced:
 *   hpb-test.csv          - Shift_JIS encoded, 21-column "レポート - 基本情報" format
 *   hpb-test-utf8.csv     - Same content but UTF-8 (for encoding-error detection tests)
 *   hpb-test-bad-header.csv - Shift_JIS encoded, missing required headers
 */

const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const OUTDIR = __dirname; // test/fixtures/

// ---------------------------------------------------------------------------
// Column headers (21 columns)
// Columns [13] and [14] are intentional duplicates of [1] and [2].
// ---------------------------------------------------------------------------
const HEADERS = [
  '対象年月',                       // [0]
  'サロン情報PV数(自店)',            // [1]
  'サロン情報PV数(同P同A平均)',      // [2]
  'CVR(自店)',                      // [3]
  'CVR(同P同A平均)',                // [4]
  'ACR(自店)',                      // [5]
  'ACR(同P同A平均)',                // [6]
  '予約数(自店)',                    // [7]
  '予約数(同P同A平均)',              // [8]
  '予約売上高(自店)',                // [9]
  '予約売上高(同P同A平均)',          // [10]
  '総PV数(自店)',                    // [11]
  '総PV数(同P同A平均)',              // [12]
  'サロン情報PV数(自店)',            // [13] duplicate of [1]
  'サロン情報PV数(同P同A平均)',      // [14] duplicate of [2]
  'ブログPV数(自店)',                // [15]
  'ブログPV数(同P同A平均)',          // [16]
  'クーポンメニューPV数(自店)',      // [17]
  'クーポンメニューPV数(同P同A平均)',// [18]
  'スタイルPV数(自店)',              // [19]
  'スタイルPV数(同P同A平均)',        // [20]
];

// ---------------------------------------------------------------------------
// Helper - build one CSV row string from an array of values
// ---------------------------------------------------------------------------
function row(values) {
  return values.join(',');
}

// ---------------------------------------------------------------------------
// Data rows
// ---------------------------------------------------------------------------
// Row 2-4: normal data
const normalRows = [
  ['2025年01月', 1200, 1100, 3.5, 3.2, 45.0, 42.0, 42, 38, 560000, 510000, 5000, 4800, 1200, 1100, 800, 750, 1500, 1400, 1500, 1550],
  ['2025年02月', 1350, 1150, 3.8, 3.3, 46.5, 43.0, 51, 40, 620000, 530000, 5500, 5000, 1350, 1150, 850, 770, 1600, 1480, 1700, 1600],
  ['2025年03月', 1400, 1200, 4.1, 3.4, 48.0, 44.0, 57, 42, 700000, 550000, 5800, 5200, 1400, 1200, 900, 800, 1700, 1520, 1800, 1680],
];

// Row 5: CVR value out of range (105.2 - exceeds 100%)
const outOfRangeRow = [
  '2025年04月', 1500, 1250, 105.2, 3.5, 50.0, 45.0, 60, 44, 750000, 570000, 6000, 5400, 1500, 1250, 950, 830, 1800, 1560, 1900, 1750,
];

// Row 6: invalid 対象年月 (abc123)
const invalidDateRow = [
  'abc123', 1600, 1300, 4.5, 3.6, 51.0, 46.0, 65, 46, 800000, 590000, 6200, 5600, 1600, 1300, 1000, 860, 1900, 1600, 2000, 1820,
];

// ---------------------------------------------------------------------------
// 1. hpb-test.csv  (Shift_JIS)
// ---------------------------------------------------------------------------
const mainCsvLines = [
  row(HEADERS),
  ...normalRows.map(row),
  row(outOfRangeRow),
  row(invalidDateRow),
];

const mainCsvContent = mainCsvLines.join('\r\n') + '\r\n';
const mainCsvBuf = iconv.encode(mainCsvContent, 'Shift_JIS');
fs.writeFileSync(path.join(OUTDIR, 'hpb-test.csv'), mainCsvBuf);
console.log('Created: hpb-test.csv  (%d bytes, Shift_JIS)', mainCsvBuf.length);

// ---------------------------------------------------------------------------
// 2. hpb-test-utf8.csv  (UTF-8 - same content, for encoding error detection)
// ---------------------------------------------------------------------------
const utf8Buf = Buffer.from(mainCsvContent, 'utf8');
fs.writeFileSync(path.join(OUTDIR, 'hpb-test-utf8.csv'), utf8Buf);
console.log('Created: hpb-test-utf8.csv  (%d bytes, UTF-8)', utf8Buf.length);

// ---------------------------------------------------------------------------
// 3. hpb-test-bad-header.csv  (Shift_JIS, missing required headers)
//    We deliberately drop several required columns:
//      - CVR(自店)
//      - 予約数(自店)
//      - 予約売上高(自店)
// ---------------------------------------------------------------------------
const badHeaders = [
  '対象年月',
  'サロン情報PV数(自店)',
  'サロン情報PV数(同P同A平均)',
  // CVR(自店) is MISSING
  'CVR(同P同A平均)',
  'ACR(自店)',
  'ACR(同P同A平均)',
  // 予約数(自店) is MISSING
  '予約数(同P同A平均)',
  // 予約売上高(自店) is MISSING
  '予約売上高(同P同A平均)',
  '総PV数(自店)',
  '総PV数(同P同A平均)',
  'サロン情報PV数(自店)',
  'サロン情報PV数(同P同A平均)',
  'ブログPV数(自店)',
  'ブログPV数(同P同A平均)',
  'クーポンメニューPV数(自店)',
  'クーポンメニューPV数(同P同A平均)',
  'スタイルPV数(自店)',
  'スタイルPV数(同P同A平均)',
];

// One data row (values trimmed to match reduced column count - 18 columns)
const badDataRow = [
  '2025年01月', 1200, 1100, 3.2, 45.0, 42.0, 38, 510000, 5000, 4800, 1200, 1100, 800, 750, 1500, 1400, 1500, 1550,
];

const badCsvContent = [row(badHeaders), row(badDataRow)].join('\r\n') + '\r\n';
const badCsvBuf = iconv.encode(badCsvContent, 'Shift_JIS');
fs.writeFileSync(path.join(OUTDIR, 'hpb-test-bad-header.csv'), badCsvBuf);
console.log('Created: hpb-test-bad-header.csv  (%d bytes, Shift_JIS)', badCsvBuf.length);

console.log('\nAll test fixtures generated successfully.');
