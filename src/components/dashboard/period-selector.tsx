"use client";

import { useCallback } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PeriodPreset, PeriodRange } from "@/types/dashboard";
import { monthsAgo, getCurrentMonth } from "@/lib/utils";

const PRESETS: { value: PeriodPreset; label: string }[] = [
  { value: "3m", label: "過去3ヶ月" },
  { value: "6m", label: "過去6ヶ月" },
  { value: "12m", label: "過去12ヶ月" },
];

function getPresetRange(preset: PeriodPreset): PeriodRange {
  const end = getCurrentMonth();
  switch (preset) {
    case "3m":
      return { preset, startMonth: monthsAgo(2), endMonth: end };
    case "6m":
      return { preset, startMonth: monthsAgo(5), endMonth: end };
    case "12m":
      return { preset, startMonth: monthsAgo(11), endMonth: end };
  }
}

export function PeriodSelector({
  value,
  onChange,
}: {
  value: PeriodRange;
  onChange: (range: PeriodRange) => void;
}) {
  const handlePresetChange = useCallback(
    (preset: string) => {
      onChange(getPresetRange(preset as PeriodPreset));
    },
    [onChange]
  );

  return (
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
  );
}

/** 初期値を取得するヘルパー */
export function getDefaultPeriodRange(): PeriodRange {
  return getPresetRange("6m");
}
