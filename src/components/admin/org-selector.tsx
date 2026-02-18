"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type Org = { id: string; name: string };

type Props = {
  organizations: Org[];
  selectedOrgIds: string[];
  onToggle: (id: string) => void;
  label?: string;
};

export function OrgSelector({
  organizations,
  selectedOrgIds,
  onToggle,
  label = "担当組織",
}: Props) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="max-h-40 space-y-2 overflow-y-auto rounded-md border p-3">
        {organizations.map((org) => (
          <label
            key={org.id}
            className="flex items-center gap-2 text-sm"
          >
            <Checkbox
              checked={selectedOrgIds.includes(org.id)}
              onCheckedChange={() => onToggle(org.id)}
            />
            {org.name}
          </label>
        ))}
      </div>
    </div>
  );
}
