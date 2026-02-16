import Link from "next/link";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getHpbData } from "@/lib/dashboard/queries";
import { HpbDataFreshness } from "./hpb-data-freshness";
import { HpbKpiCards } from "./hpb-kpi-cards";
import { HpbTrendCharts } from "./hpb-trend-charts";

export async function HpbSection({ locationId }: { locationId: string }) {
  const hpbData = await getHpbData(locationId);

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">HPB パフォーマンス</h2>

      {!hpbData.hasData ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Upload className="h-10 w-10 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium">HPBデータが未登録です</p>
              <p className="mt-1 text-sm text-muted-foreground">
                サロンボードからCSVをダウンロードし、アップロードしてください。
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/hpb-upload">HPBデータをアップロード</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {hpbData.uploadInfo && <HpbDataFreshness info={hpbData.uploadInfo} />}
          {hpbData.kpi && <HpbKpiCards data={hpbData.kpi} />}
          <HpbTrendCharts data={hpbData.timeSeries} />
        </div>
      )}
    </section>
  );
}
