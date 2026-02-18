"use client";

import { useState, useCallback } from "react";

export function useOrgSelection(initialOrgIds: string[] = []) {
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(initialOrgIds);

  const toggleOrg = useCallback((orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  }, []);

  const resetSelection = useCallback(() => {
    setSelectedOrgIds([]);
  }, []);

  return { selectedOrgIds, setSelectedOrgIds, toggleOrg, resetSelection };
}
