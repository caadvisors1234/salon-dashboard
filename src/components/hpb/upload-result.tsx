"use client";

import { AlertCircle, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import type { ParseMessage } from "@/lib/hpb/constants";

type UploadResultData = {
  recordCount: number;
  skippedRows: number;
  warnings: ParseMessage[];
  duplicateMonths: string[];
};

type UploadResultProps =
  | { type: "success"; data: UploadResultData }
  | { type: "error"; message: string; details?: ParseMessage[] };

export function UploadResult({ result }: { result: UploadResultProps }) {
  if (result.type === "error") {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="space-y-2">
            <p className="font-medium text-destructive">{result.message}</p>
            {result.details && result.details.length > 0 && (
              <ul className="space-y-1 text-sm text-destructive/80">
                {result.details.map((d, i) => (
                  <li key={i}>
                    {d.row && `行${d.row}: `}
                    {d.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-3">
      {/* 成功メッセージ */}
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
          <p className="font-medium text-green-700">
            取り込み完了: {data.recordCount}件
          </p>
        </div>
      </div>

      {/* スキップ行 */}
      {data.skippedRows > 0 && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 shrink-0 text-yellow-600" />
            <p className="text-sm text-yellow-700">
              {data.skippedRows}行がバリデーションエラーによりスキップされました
            </p>
          </div>
        </div>
      )}

      {/* 上書き年月 */}
      {data.duplicateMonths.length > 0 && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
          <div className="flex items-center gap-3">
            <Info className="h-4 w-4 shrink-0 text-blue-600" />
            <p className="text-sm text-blue-700">
              上書き年月: {data.duplicateMonths.join(", ")}
            </p>
          </div>
        </div>
      )}

      {/* ワーニング一覧 */}
      {data.warnings.length > 0 && (
        <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-yellow-700">
                ワーニング ({data.warnings.length}件)
              </p>
              <ul className="space-y-0.5 text-sm text-yellow-600">
                {data.warnings.map((w, i) => (
                  <li key={i}>
                    {w.row ? `行${w.row}` : ""}
                    {w.column ? ` [${w.column}]` : ""}
                    {w.row || w.column ? ": " : ""}
                    {w.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
