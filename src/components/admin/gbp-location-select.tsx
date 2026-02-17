"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LocationStatus } from "@/lib/gbp/types";

type GbpLocationOption = {
  accountId: string;
  accountName: string | null;
  locationId: string;
  locationName: string | null;
  placeId: string | null;
  address: string | null;
  status: LocationStatus;
  statusLabel: string;
};

type Props = {
  value: string;
  placeIdValue: string;
  onChange: (locationId: string, placeId: string) => void;
  idPrefix: string;
};

export function GbpLocationSelect({
  value,
  placeIdValue,
  onChange,
  idPrefix,
}: Props) {
  const [locations, setLocations] = useState<GbpLocationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const statusRes = await fetch("/api/oauth/google/status");
        const status = await statusRes.json();

        if (status.status !== "connected") {
          setConnected(false);
          setLoading(false);
          return;
        }

        setConnected(true);

        const locsRes = await fetch("/api/gbp/locations");
        const locsData = await locsRes.json();

        if (locsData.locations) {
          setLocations(locsData.locations);
        }
      } catch {
        setConnected(false);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const activeLocations = useMemo(
    () => locations.filter((loc) => loc.status === "verified"),
    [locations]
  );

  const excludedLocations = useMemo(
    () => locations.filter((loc) => loc.status !== "verified"),
    [locations]
  );

  const excludedSummary = useMemo(() => {
    if (excludedLocations.length === 0) return null;
    const counts: Record<string, number> = {};
    for (const loc of excludedLocations) {
      counts[loc.statusLabel] = (counts[loc.statusLabel] || 0) + 1;
    }
    const parts = Object.entries(counts).map(
      ([label, count]) => `${label}: ${count}`
    );
    return `※ ${excludedLocations.length}件のロケーションが非表示です（${parts.join(", ")}）`;
  }, [excludedLocations]);

  // GBP 未接続の場合は従来のテキスト入力を表示
  if (!loading && !connected) {
    return (
      <>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-gbp`}>GBP Location ID</Label>
          <Input
            id={`${idPrefix}-gbp`}
            value={value}
            onChange={(e) => onChange(e.target.value, placeIdValue)}
            placeholder="任意 - Google接続後にドロップダウンで選択可能"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-place`}>Place ID</Label>
          <Input
            id={`${idPrefix}-place`}
            value={placeIdValue}
            onChange={(e) => onChange(value, e.target.value)}
            placeholder="任意"
          />
        </div>
      </>
    );
  }

  const isOrphanValue =
    value !== "" && !activeLocations.some((l) => l.locationId === value);

  const handleSelect = (selectedLocationId: string) => {
    if (selectedLocationId === "__none__") {
      onChange("", "");
      return;
    }

    const loc = activeLocations.find((l) => l.locationId === selectedLocationId);
    if (loc) {
      onChange(loc.locationId, loc.placeId || "");
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-gbp-select`}>GBP ロケーション</Label>
        <Select
          value={value || "__none__"}
          onValueChange={handleSelect}
          disabled={loading}
        >
          <SelectTrigger id={`${idPrefix}-gbp-select`}>
            <SelectValue
              placeholder={loading ? "読み込み中..." : "GBP ロケーションを選択"}
            />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">未設定</SelectItem>
            {isOrphanValue && (
              <SelectItem value={value} disabled>
                {value}（無効なロケーション）
              </SelectItem>
            )}
            {activeLocations.map((loc) => (
              <SelectItem key={loc.locationId} value={loc.locationId}>
                {loc.locationName || loc.locationId}
                {loc.address ? ` (${loc.address})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {value && (
          <p className="text-xs text-muted-foreground">
            Location ID: {value}
            {placeIdValue ? ` / Place ID: ${placeIdValue}` : ""}
            {isOrphanValue && " — このロケーションは現在無効です。「未設定」を選択して解除できます"}
          </p>
        )}
        {excludedSummary && (
          <p className="text-xs text-muted-foreground">{excludedSummary}</p>
        )}
      </div>
    </>
  );
}
