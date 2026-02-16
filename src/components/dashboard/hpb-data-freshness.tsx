import { Clock, Calendar, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { HpbUploadInfo } from "@/types/dashboard";

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function HpbDataFreshness({ info }: { info: HpbUploadInfo }) {
  return (
    <Card className="gap-2 py-3">
      <CardContent>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            最終アップロード: {formatDateTime(info.lastUploadedAt)}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            対象期間: {info.dataRangeStart} 〜 {info.dataRangeEnd}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />
            アップロード者: {info.uploadedBy}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
