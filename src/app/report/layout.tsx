import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "レポート - GBP Performance Dashboard",
  robots: "noindex, nofollow",
};

/**
 * レポート専用レイアウト。
 * ダッシュボードのサイドバー等を使用しない独立レイアウト。
 * A4横（297mm x 210mm）向け印刷用CSS。
 */
export default function ReportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
        @media screen {
          .report-page {
            width: 297mm;
            min-height: 210mm;
            margin: 0 auto;
            background: white;
          }
        }
      `}</style>
      <div className="bg-white text-foreground">
        {children}
      </div>
    </>
  );
}
