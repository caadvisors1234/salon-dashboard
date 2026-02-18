"use client";

import { useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { monthsAgo, getCurrentMonth } from "@/lib/utils";
import { useReportGeneration } from "@/hooks/use-report-generation";

type ReportDialogProps = {
  type: "store" | "client";
  locationId?: string;
  orgId?: string;
  triggerLabel?: string;
};

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
    options.push({ value, label });
  }
  return options;
}

export function ReportDialog({
  type,
  locationId,
  orgId,
  triggerLabel,
}: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startMonth, setStartMonth] = useState(monthsAgo(5));
  const [endMonth, setEndMonth] = useState(getCurrentMonth());
  const { generating, queueInfo, generate } = useReportGeneration();

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const label = triggerLabel ?? (type === "store" ? "レポート出力" : "一括レポート出力");
  const description =
    type === "store"
      ? "この店舗のパフォーマンスレポートをPDFで生成します。"
      : "全店舗のパフォーマンスレポートをZIPファイルで一括生成します。";

  const handleGenerate = async () => {
    const success = await generate({ type, locationId, orgId, startMonth, endMonth });
    if (success) setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileDown className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">開始年月</label>
            <Select value={startMonth} onValueChange={setStartMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">終了年月</label>
            <Select value={endMonth} onValueChange={setEndMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {queueInfo && (
            <p className="text-sm text-muted-foreground text-center">{queueInfo}</p>
          )}
        </div>

        <DialogFooter>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <FileDown className="mr-2 h-4 w-4" />
                PDFを生成
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
