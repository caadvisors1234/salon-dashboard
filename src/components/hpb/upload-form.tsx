"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, FileText, X, Loader2 } from "lucide-react";
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
import { UploadResult } from "./upload-result";
import type { ParseMessage } from "@/lib/hpb/constants";

type LocationOption = {
  id: string;
  name: string;
  orgId: string;
  orgName: string;
};

type UploadResultData = {
  recordCount: number;
  skippedRows: number;
  warnings: ParseMessage[];
  duplicateMonths: string[];
};

type ResultState =
  | { type: "success"; data: UploadResultData }
  | { type: "error"; message: string; details?: ParseMessage[] }
  | null;

export function UploadForm({ locations }: { locations: LocationOption[] }) {
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ResultState>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    duplicateMonths: string[];
    warnings: ParseMessage[];
    skippedRows: number;
    validRowCount: number;
  }>({
    open: false,
    duplicateMonths: [],
    warnings: [],
    skippedRows: 0,
    validRowCount: 0,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 組織ごとにグルーピング
  const orgGroups = new Map<string, { orgName: string; locations: LocationOption[] }>();
  for (const loc of locations) {
    const group = orgGroups.get(loc.orgId) ?? { orgName: loc.orgName, locations: [] };
    group.locations.push(loc);
    orgGroups.set(loc.orgId, group);
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    setFile(selectedFile);
    setResult(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  async function doUpload(overwrite: boolean) {
    if (!file || !selectedLocationId) return;

    setIsUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("locationId", selectedLocationId);
      if (overwrite) formData.append("overwrite", "true");

      const res = await fetch("/api/hpb/upload", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (json.success) {
        setResult({ type: "success", data: json.data });
        clearFile();
      } else if (json.needsConfirmation) {
        setConfirmDialog({
          open: true,
          duplicateMonths: json.duplicateMonths,
          warnings: json.warnings ?? [],
          skippedRows: json.skippedRows ?? 0,
          validRowCount: json.validRowCount ?? 0,
        });
      } else {
        setResult({
          type: "error",
          message: json.error,
          details: json.details,
        });
      }
    } catch {
      setResult({
        type: "error",
        message: "アップロード中にエラーが発生しました",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleConfirmOverwrite() {
    setConfirmDialog((prev) => ({ ...prev, open: false }));
    await doUpload(true);
  }

  const canUpload = !!file && !!selectedLocationId && !isUploading;

  return (
    <div className="space-y-6">
      {/* 店舗セレクト */}
      <div className="space-y-2">
        <label className="text-sm font-medium">対象店舗</label>
        <Select value={selectedLocationId} onValueChange={setSelectedLocationId}>
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

      {/* ファイルドロップゾーン */}
      <div className="space-y-2">
        <label className="text-sm font-medium">CSVファイル</label>
        {file ? (
          <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-4">
            <FileText className="h-8 w-8 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(1)} KB
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={clearFile}
              disabled={isUploading}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div
            className={`flex cursor-pointer flex-col items-center gap-3 rounded-md border-2 border-dashed p-8 transition-colors ${
              isDragging
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-muted-foreground/50"
            }`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium">
                CSVファイルをドラッグ&ドロップ
              </p>
              <p className="text-xs text-muted-foreground">
                またはクリックして選択（Shift_JIS CSV, 最大 5MB）
              </p>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileSelect(f);
          }}
        />
      </div>

      {/* アップロードボタン */}
      <Button
        onClick={() => doUpload(false)}
        disabled={!canUpload}
        className="w-full max-w-md"
      >
        {isUploading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            アップロード中...
          </>
        ) : (
          <>
            <Upload className="mr-2 h-4 w-4" />
            アップロード
          </>
        )}
      </Button>

      {/* 結果表示 */}
      {result && <UploadResult result={result} />}

      {/* 重複確認ダイアログ */}
      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          setConfirmDialog((prev) => ({ ...prev, open }))
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>既存データの上書き確認</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  以下の年月のデータが既に登録されています。上書きしますか？
                </p>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium">
                    対象年月: {confirmDialog.duplicateMonths.join(", ")}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    取り込み予定: {confirmDialog.validRowCount}件
                    {confirmDialog.skippedRows > 0 &&
                      ` (${confirmDialog.skippedRows}行スキップ)`}
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>キャンセル</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmOverwrite}>
              上書きする
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
