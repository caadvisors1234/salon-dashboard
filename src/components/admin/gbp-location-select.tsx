"use client";

import { useState, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GbpLocationOption = {
  accountId: string;
  accountName: string | null;
  locationId: string;
  locationName: string | null;
  placeId: string | null;
  address: string | null;
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

  const handleSelect = (selectedLocationId: string) => {
    if (selectedLocationId === "__none__") {
      onChange("", "");
      return;
    }

    const loc = locations.find((l) => l.locationId === selectedLocationId);
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
            {locations.map((loc) => (
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
          </p>
        )}
      </div>
    </>
  );
}
