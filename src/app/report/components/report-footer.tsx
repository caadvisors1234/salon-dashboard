/**
 * レポートフッター。
 * 生成日を右寄せで表示。
 */
export function ReportFooter() {
  const now = new Date();
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;

  return (
    <footer className="mt-8 border-t border-gray-200 pt-3 text-right">
      <p className="text-xs text-muted-foreground">生成日: {dateStr}</p>
    </footer>
  );
}
