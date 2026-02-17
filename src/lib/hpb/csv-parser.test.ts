import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { parseHpbCsv } from "./csv-parser";

const fixturesDir = path.resolve(__dirname, "../../../test/fixtures");

describe("parseHpbCsv", () => {
  describe("正常Shift_JIS CSV", () => {
    const result = parseHpbCsv(
      fs.readFileSync(path.join(fixturesDir, "hpb-test.csv"))
    );

    it("エラーなし", () => {
      expect(result.errors).toHaveLength(0);
    });

    it("4行取り込み", () => {
      expect(result.rows).toHaveLength(4);
    });

    it("1行スキップ", () => {
      expect(result.skippedRows).toBe(1);
    });

    it("重複カラム2件検知", () => {
      expect(result.duplicateColumns).toHaveLength(2);
    });

    it("CVR範囲外ワーニング", () => {
      const warning = result.warnings.find(
        (w) => w.column === "CVR(自店)" && w.message.includes("105.2")
      );
      expect(warning).toBeDefined();
    });

    it("対象年月不正行スキップ", () => {
      const warning = result.warnings.find(
        (w) => w.column === "対象年月" && w.message.includes("abc123")
      );
      expect(warning).toBeDefined();
    });

    it("CVR範囲外行がデータに含まれる", () => {
      const row = result.rows.find((r) => r.year_month === "202504");
      expect(row).toBeDefined();
      expect(row?.cvr).toBe(105.2);
    });

    it("1行目のデータ値検証", () => {
      const row = result.rows[0];
      expect(row.year_month).toBe("202501");
      expect(row.salon_pv).toBe(1200);
      expect(row.cvr).toBe(61.2);
      expect(row.acr).toBe(10.4);
      expect(row.booking_count).toBe(154);
      expect(row.booking_revenue).toBe(1250000);
      expect(row.total_pv).toBe(3500);
      expect(row.blog_pv).toBe(450);
    });
  });

  describe("UTF-8 CSV（エンコーディングエラー検知）", () => {
    const result = parseHpbCsv(
      fs.readFileSync(path.join(fixturesDir, "hpb-test-utf8.csv"))
    );

    it("エラー1件", () => {
      expect(result.errors).toHaveLength(1);
    });

    it("エンコーディングエラーメッセージに「対象年月」を含む", () => {
      expect(result.errors[0]?.message).toContain("対象年月");
    });

    it("データ行なし", () => {
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("ヘッダー不正CSV", () => {
    const result = parseHpbCsv(
      fs.readFileSync(path.join(fixturesDir, "hpb-test-bad-header.csv"))
    );

    it("エラー1件", () => {
      expect(result.errors).toHaveLength(1);
    });

    it("不足カラム名を含む", () => {
      expect(result.errors[0]?.message).toContain("CVR(自店)");
    });

    it("データ行なし", () => {
      expect(result.rows).toHaveLength(0);
    });
  });

  describe("空バッファ", () => {
    const result = parseHpbCsv(Buffer.from(""));

    it("エラーあり", () => {
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("データ行なし", () => {
      expect(result.rows).toHaveLength(0);
    });
  });
});
