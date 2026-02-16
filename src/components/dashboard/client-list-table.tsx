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
import type { ClientSummary } from "@/types/dashboard";

export function ClientListTable({ clients }: { clients: ClientSummary[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          クライアント一覧（{clients.length}件）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {clients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <p>クライアントが登録されていません。</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>クライアント名</TableHead>
                <TableHead className="text-right">店舗数</TableHead>
                <TableHead className="text-right">前月閲覧数</TableHead>
                <TableHead className="text-right">前月アクション数</TableHead>
                <TableHead className="text-right">前月平均評価</TableHead>
                <TableHead className="text-right">HPBアップロード率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((client) => (
                <TableRow key={client.orgId}>
                  <TableCell>
                    <Link
                      href={`/dashboard/clients/${client.orgId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {client.orgName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.locationCount}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.lastMonthImpressions.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.lastMonthActions.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.lastMonthAvgRating !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                        {client.lastMonthAvgRating.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {client.hpbUploadRate}%
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
