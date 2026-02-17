import { BarChart3 } from "lucide-react";

export function ChartEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
      <BarChart3 className="mb-3 h-12 w-12 opacity-30" />
      <p className="text-sm font-medium">データがありません</p>
      <p className="mt-1 text-xs">対象期間のデータが収集されると表示されます</p>
    </div>
  );
}
