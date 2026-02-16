import type { DailyMetricResult, DailyMetricType, KeywordResult } from "../types";
import { createGbpClient } from "../client";
import { fetchDailyMetrics } from "../performance";
import { fetchMonthlyKeywords } from "../keywords";

/**
 * パフォーマンス指標取得の抽象化インターフェース。
 */
export interface PerformanceMetricsProvider {
  getDailyMetrics(
    gbpLocationId: string,
    startDate: string,
    endDate: string,
    metrics?: DailyMetricType[]
  ): Promise<DailyMetricResult[]>;

  getMonthlyKeywords(
    gbpLocationId: string,
    year: number,
    month: number
  ): Promise<KeywordResult[]>;
}

/**
 * GBP Performance API v1 を使用した PerformanceMetricsProvider 実装。
 */
export class GbpPerformanceProvider implements PerformanceMetricsProvider {
  async getDailyMetrics(
    gbpLocationId: string,
    startDate: string,
    endDate: string
  ): Promise<DailyMetricResult[]> {
    const client = createGbpClient();
    return fetchDailyMetrics(client, gbpLocationId, startDate, endDate);
  }

  async getMonthlyKeywords(
    gbpLocationId: string,
    year: number,
    month: number
  ): Promise<KeywordResult[]> {
    const client = createGbpClient();
    return fetchMonthlyKeywords(client, gbpLocationId, year, month);
  }
}

export function createPerformanceProvider(): PerformanceMetricsProvider {
  return new GbpPerformanceProvider();
}
