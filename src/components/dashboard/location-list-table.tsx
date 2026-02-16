"use client";

import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";
import type { LocationSummary } from "@/types/dashboard";

export function LocationListTable({
  locations,
  orgId,
}: {
  locations: LocationSummary[];
  orgId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          店舗一覧（{locations.length}件）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>有効な店舗が登録されていません。</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>店舗名</TableHead>
                <TableHead className="text-right">前月閲覧数</TableHead>
                <TableHead className="text-right">前月アクション数</TableHead>
                <TableHead className="text-right">評価</TableHead>
                <TableHead className="text-right">レビュー数</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {locations.map((loc) => (
                <TableRow key={loc.locationId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${orgId}/locations/${loc.locationId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {loc.locationName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {loc.lastMonthImpressions.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {loc.lastMonthActions.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {loc.latestRating !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {loc.latestRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {loc.latestReviewCount !== null
                      ? loc.latestReviewCount.toLocaleString("ja-JP")
                      : "-"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
