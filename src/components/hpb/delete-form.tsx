"use client";

import { useState, useCallback } from "react";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type LocationOption = {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
};

type DeleteResult =
  | { type: "success"; deletedCount: number }
  | { type: "error"; message: string }
  | null;

export function DeleteForm({ locations }: { locations: LocationOption[] }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [yearMonths, setYearMonths] = useState<string[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<Set<string>>(new Set());
  const [isLoadingMonths, setIsLoadingMonths] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [result, setResult] = useState<DeleteResult>(null);
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // 組織ごとにグルーピング
  const orgGroups = new Map<
    string,
    { orgName: string; locations: LocationOption[] }
  >();
  for (const loc of locations) {
    const group = orgGroups.get(loc.orgId) ?? {
      orgName: loc.orgName,
      locations: [],
    };
    group.locations.push(loc);
    orgGroups.set(loc.orgId, group);
  }

  const selectedLocation = locations.find((l) => l.id === selectedLocationId);

  const fetchMonths = useCallback(async (locationId: string) => {
    setIsLoadingMonths(true);
    setYearMonths([]);
    setSelectedMonths(new Set());
    setResult(null);

    try {
      const res = await fetch(
        `/api/hpb/data?locationId=${encodeURIComponent(locationId)}`
      );
      const json = await res.json();

      if (json.success) {
        setYearMonths(json.data.yearMonths);
      } else {
        setResult({ type: "error", message: json.error });
      }
    } catch {
      setResult({
        type: "error",
        message: "データの取得中にエラーが発生しました",
      });
    } finally {
      setIsLoadingMonths(false);
    }
  }, []);

  function handleLocationChange(locationId: string) {
    setSelectedLocationId(locationId);
    setResult(null);
    if (locationId) {
      fetchMonths(locationId);
    } else {
      setYearMonths([]);
      setSelectedMonths(new Set());
    }
  }

  function toggleMonth(ym: string) {
    setSelectedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(ym)) {
        next.delete(ym);
      } else {
        next.add(ym);
      }
      return next;
    });
  }

  function toggleAll() {
    if (selectedMonths.size === yearMonths.length) {
      setSelectedMonths(new Set());
    } else {
      setSelectedMonths(new Set(yearMonths));
    }
  }

  async function handleDelete() {
    setConfirmOpen(false);
    setIsDeleting(true);
    setResult(null);

    try {
      const res = await fetch("/api/hpb/data", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: selectedLocationId,
          yearMonths: Array.from(selectedMonths),
          reason: reason || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        setResult({ type: "success", deletedCount: json.data.deletedCount });
        // 月リストを再取得
        setSelectedMonths(new Set());
        setReason("");
        await fetchMonths(selectedLocationId);
      } else {
        setResult({ type: "error", message: json.error });
      }
    } catch {
      setResult({
        type: "error",
        message: "削除中にエラーが発生しました",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function formatYearMonth(ym: string): string {
    return `${ym.slice(0, 4)}年${ym.slice(4)}月`;
  }

  const canDelete = selectedMonths.size > 0 && !isDeleting && !isLoadingMonths;

  return (
    <div className="space-y-6">
      {/* 店舗セレクト */}
      <div className="space-y-2">
        <label className="text-sm font-medium">対象店舗</label>
        <Select value={selectedLocationId} onValueChange={handleLocationChange}>
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="店舗を選択" />
          </SelectTrigger>
          <SelectContent>
            {Array.from(orgGroups.entries()).map(([orgId, group]) => (
              <SelectGroup key={orgId}>
                <SelectLabel>{group.orgName}</SelectLabel>
                {group.locations.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 月リスト表示 */}
      {selectedLocationId && (
        <div className="space-y-3">
          {isLoadingMonths ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              データを取得中...
            </div>
          ) : yearMonths.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              HPBデータが登録されていません
            </p>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectedMonths.size === yearMonths.length}
                  onCheckedChange={toggleAll}
                />
                <label
                  htmlFor="select-all"
                  className="text-sm font-medium cursor-pointer"
                >
                  すべて選択（{yearMonths.length}件）
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {yearMonths.map((ym) => (
                  <label
                    key={ym}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border p-2 transition-colors ${
                      selectedMonths.has(ym)
                        ? "border-destructive bg-destructive/5"
                        : "hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedMonths.has(ym)}
                      onCheckedChange={() => toggleMonth(ym)}
                    />
                    <span className="text-sm">{formatYearMonth(ym)}</span>
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* 削除ボタン */}
      {yearMonths.length > 0 && (
        <Button
          variant="destructive"
          onClick={() => setConfirmOpen(true)}
          disabled={!canDelete}
          className="w-full max-w-md"
        >
          {isDeleting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              削除中...
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              選択した{selectedMonths.size}件のデータを削除
            </>
          )}
        </Button>
      )}

      {/* 結果表示 */}
      {result?.type === "success" && (
        <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            <p className="font-medium text-green-700">
              {result.deletedCount}件のデータを削除しました
            </p>
          </div>
        </div>
      )}
      {result?.type === "error" && (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 shrink-0 text-destructive" />
            <p className="font-medium text-destructive">{result.message}</p>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>HPBデータの削除確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>以下のデータを削除します。この操作は取り消せません。</p>
                <div className="rounded-md bg-muted p-3 space-y-1">
                  <p className="text-sm font-medium">
                    店舗: {selectedLocation?.name}
                  </p>
                  <p className="text-sm">
                    対象年月:{" "}
                    {Array.from(selectedMonths)
                      .sort()
                      .map(formatYearMonth)
                      .join(", ")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {selectedMonths.size}件のレコードが削除されます
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-foreground">
                    削除理由（任意）
                  </label>
                  <Input
                    placeholder="例: 誤った店舗にアップロードしたため"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              削除する
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
