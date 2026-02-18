"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";

interface GenerateParams {
  type: "store" | "client";
  locationId?: string;
  orgId?: string;
  startMonth: string;
  endMonth: string;
}

const POLL_INTERVAL_MS = 3000;

export function useReportGeneration() {
  const [generating, setGenerating] = useState(false);
  const [queueInfo, setQueueInfo] = useState<string | null>(null);
  const pollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const generatingRef = useRef(false);

  // ポーリングのクリーンアップ
  useEffect(() => {
    if (!generating) {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
      setQueueInfo(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      if (cancelled) return;
      try {
        const res = await fetch("/api/reports/queue-status");
        if (res.ok && !cancelled) {
          const json = await res.json();
          const status = json.data;
          if (status.waiting > 0) {
            setQueueInfo(`待機中（${status.waiting}番目）`);
          } else {
            setQueueInfo(null);
          }
        }
      } catch {
        // ポーリングエラーは無視
      }
      if (!cancelled) {
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    }

    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
        pollTimeoutRef.current = null;
      }
    };
  }, [generating]);

  // アンマウント時のアボート
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const generate = useCallback(async (params: GenerateParams): Promise<boolean> => {
    if (generatingRef.current) return false;
    generatingRef.current = true;

    const { type, locationId, orgId, startMonth, endMonth } = params;

    if (startMonth > endMonth) {
      generatingRef.current = false;
      toast.error("開始年月は終了年月以前を指定してください");
      return false;
    }

    setGenerating(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: Record<string, string> = { type, startMonth, endMonth };
      if (type === "store" && locationId) body.locationId = locationId;
      if (type === "client" && orgId) body.orgId = orgId;

      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "レポート生成に失敗しました" }));
        throw new Error(err.error || "レポート生成に失敗しました");
      }

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
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return false;
      const message = err instanceof Error ? err.message : "レポート生成に失敗しました";
      toast.error(message);
      return false;
    } finally {
      generatingRef.current = false;
      setGenerating(false);
      abortRef.current = null;
    }
  }, []);

  return { generating, queueInfo, generate };
}
