type ReportHeaderProps = {
  orgName: string;
  locationName: string;
  periodLabel: string;
};

/**
 * レポートヘッダー。
 * ロゴ + クライアント名 + 店舗名 + 対象期間を横並びで表示。
 */
export function ReportHeader({
  orgName,
  locationName,
  periodLabel,
}: ReportHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-gray-200 pb-4 mb-6">
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element -- Puppeteer描画のためnext/imageではなくimgタグを使用 */}
        <img src="/logo-small.png" alt="Logo" width={40} height={40} className="h-10 w-10 shrink-0" />
        <div>
          <p className="text-sm text-muted-foreground">{orgName}</p>
          <h1 className="text-lg font-bold">{locationName}</h1>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-muted-foreground">対象期間</p>
        <p className="text-base font-semibold">{periodLabel}</p>
      </div>
    </header>
  );
}
