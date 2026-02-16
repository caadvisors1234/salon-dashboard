"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodPreset, PeriodRange } from "@/types/dashboard";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "3m", label: "過去3ヶ月" },
  { value: "6m", label: "過去6ヶ月" },
  { value: "12m", label: "過去12ヶ月" },
  { value: "custom", label: "カスタム" },
];

/** YYYY-MM 形式で N ヶ月前を返す */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 現在の年月を返す */
function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 年月文字列から選択肢を生成（過去24ヶ月） */
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

function getPresetRange(preset: PeriodPreset): PeriodRange {
  const end = currentMonth();
  switch (preset) {
    case "3m":
      return { preset, startMonth: monthsAgo(2), endMonth: end };
    case "6m":
      return { preset, startMonth: monthsAgo(5), endMonth: end };
    case "12m":
      return { preset, startMonth: monthsAgo(11), endMonth: end };
    case "custom":
      return { preset, startMonth: monthsAgo(5), endMonth: end };
  }
}

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
}) {
  const [showCustom, setShowCustom] = useState(value.preset === "custom");
  const monthOptions = useMemo(() => generateMonthOptions(), []);

  const handlePresetChange = useCallback(
    (preset: string) => {
      const p = preset as PeriodPreset;
      if (p === "custom") {
        setShowCustom(true);
        onChange({ ...value, preset: "custom" });
      } else {
        setShowCustom(false);
        onChange(getPresetRange(p));
      }
    },
    [onChange, value]
  );

  const handleStartChange = useCallback(
    (start: string) => {
      onChange({ preset: "custom", startMonth: start, endMonth: value.endMonth });
    },
    [onChange, value.endMonth]
  );

  const handleEndChange = useCallback(
    (end: string) => {
      onChange({ preset: "custom", startMonth: value.startMonth, endMonth: end });
    },
    [onChange, value.startMonth]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={value.preset} onValueChange={handlePresetChange}>
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESETS.map((p) => (
            <SelectItem key={p.value} value={p.value}>
              {p.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCustom && (
        <div className="flex items-center gap-1">
          <Select value={value.startMonth} onValueChange={handleStartChange}>
            <SelectTrigger size="sm" className="w-[130px]">
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
          <span className="text-sm text-muted-foreground">〜</span>
          <Select value={value.endMonth} onValueChange={handleEndChange}>
            <SelectTrigger size="sm" className="w-[130px]">
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
      )}
    </div>
  );
}

/** 初期値を取得するヘルパー */
export function getDefaultPeriodRange(): PeriodRange {
  return getPresetRange("6m");
}
