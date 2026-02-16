"use client";

import { useCallback, useMemo, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
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

function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function ReportDialog({
  type,
  locationId,
  orgId,
  triggerLabel,
}: ReportDialogProps) {
  const [open, setOpen] = useState(false);
  const [startMonth, setStartMonth] = useState(monthsAgo(5));
  const [endMonth, setEndMonth] = useState(currentMonth());
  const [generating, setGenerating] = useState(false);
  const [queueInfo, setQueueInfo] = useState<string | null>(null);

  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const label = triggerLabel ?? (type === "store" ? "レポート出力" : "一括レポート出力");
  const description =
    type === "store"
      ? "この店舗のパフォーマンスレポートをPDFで生成します。"
      : "全店舗のパフォーマンスレポートをZIPファイルで一括生成します。";

  const handleGenerate = useCallback(async () => {
    if (startMonth > endMonth) {
      toast.error("開始年月は終了年月以前を指定してください");
      return;
    }

    setGenerating(true);
    setQueueInfo(null);

    // キュー状態ポーリング
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/reports/queue-status");
        if (res.ok) {
          const status = await res.json();
          if (status.waiting > 0) {
            setQueueInfo(`待機中（${status.waiting}番目）`);
          } else {
            setQueueInfo(null);
          }
        }
      } catch {
        // ポーリングエラーは無視
      }
    }, 3000);

    try {
      const body: Record<string, string> = {
        type,
        startMonth,
        endMonth,
      };
      if (type === "store" && locationId) {
        body.locationId = locationId;
      }
      if (type === "client" && orgId) {
        body.orgId = orgId;
      }

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "レポート生成に失敗しました" }));
        throw new Error(err.error || "レポート生成に失敗しました");
      }

      // Blob としてダウンロード
      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let fileName = type === "store" ? "report.pdf" : "report.zip";

      if (contentDisposition) {
        const match = contentDisposition.match(/filename\*=UTF-8''(.+)/);
        if (match) {
          fileName = decodeURIComponent(match[1]);
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("レポートを生成しました");
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "レポート生成に失敗しました";
      toast.error(message);
    } finally {
      clearInterval(pollInterval);
      setGenerating(false);
      setQueueInfo(null);
    }
  }, [type, locationId, orgId, startMonth, endMonth]);

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
