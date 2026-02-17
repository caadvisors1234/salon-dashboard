import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendBadge } from "./trend-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KeywordRankingResult } from "@/types/dashboard";

export function KeywordRankingTable({
  result,
}: {
  result: KeywordRankingResult;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          検索キーワードランキング（上位10件）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {result.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            キーワードデータがありません
          </p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
