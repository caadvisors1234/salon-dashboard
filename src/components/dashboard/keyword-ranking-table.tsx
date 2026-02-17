"use client";

import { useState, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendBadge } from "./trend-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { KeywordRankingResult } from "@/types/dashboard";

export function KeywordRankingTable({
  initialResult,
  locationId,
  yearMonth,
}: {
  initialResult: KeywordRankingResult;
  locationId: string;
  yearMonth: string;
}) {
  const [result, setResult] = useState(initialResult);
  const [loading, setLoading] = useState(false);

  const totalPages = Math.ceil(result.totalCount / result.pageSize);

  const fetchPage = useCallback(
    async (page: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          locationId,
          yearMonth,
          page: String(page),
          pageSize: String(result.pageSize),
        });
        const res = await fetch(`/api/dashboard/keywords?${params}`);
        if (res.ok) {
          setResult(await res.json());
        }
      } finally {
        setLoading(false);
      }
    },
    [locationId, yearMonth, result.pageSize]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          検索キーワード（{result.totalCount}件）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            キーワードデータがありません
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>キーワード</TableHead>
                  <TableHead className="text-right">指標値</TableHead>
                  <TableHead className="text-right">前月比</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.keyword}>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {row.rank <= 3 ? (
                        <span
                          className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            row.rank === 1
                              ? "bg-amber-100 text-amber-700"
                              : row.rank === 2
                                ? "bg-slate-100 text-slate-600"
                                : "bg-orange-100 text-orange-600"
                          }`}
                        >
                          {row.rank}
                        </span>
                      ) : (
                        row.rank
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.keyword}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.valueType === "THRESHOLD" ? (
                        <span className="inline-flex items-center gap-1">
                          <span>&lt;{row.insightsValue}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            LOW_VOLUME
                          </Badge>
                        </span>
                      ) : (
                        row.insightsValue.toLocaleString("ja-JP")
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <TrendBadge trend={row.trend} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* ページネーション */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {(result.currentPage - 1) * result.pageSize + 1}〜
                  {Math.min(result.currentPage * result.pageSize, result.totalCount)}件
                  / {result.totalCount}件
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={result.currentPage <= 1 || loading}
                    onClick={() => fetchPage(result.currentPage - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="px-2 text-sm tabular-nums">
                    {result.currentPage} / {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={result.currentPage >= totalPages || loading}
                    onClick={() => fetchPage(result.currentPage + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
