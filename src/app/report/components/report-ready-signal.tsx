"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    __REPORT_READY?: boolean;
  }
}

/**
 * Recharts の SVG レンダリング完了を検知して window.__REPORT_READY = true をセットする。
 * UI は描画しない（return null）。
 */
export function ReportReadySignal() {
  useEffect(() => {
    const setReady = () => {
      window.__REPORT_READY = true;
    };

    const hasCharts = () =>
      document.querySelectorAll(".recharts-surface").length > 0;

    if (hasCharts()) {
      let rafId = requestAnimationFrame(() => {
        rafId = requestAnimationFrame(setReady);
      });
      return () => cancelAnimationFrame(rafId);
    }

    const observer = new MutationObserver(() => {
      if (hasCharts()) {
        observer.disconnect();
        requestAnimationFrame(() => requestAnimationFrame(setReady));
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // フォールバックタイムアウト（5秒）
    const fallback = setTimeout(() => {
      observer.disconnect();
      setReady();
    }, 5000);

    return () => {
      observer.disconnect();
      clearTimeout(fallback);
    };
  }, []);

  return null;
}
