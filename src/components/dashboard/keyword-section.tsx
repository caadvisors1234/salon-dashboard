import { Search } from "lucide-react";
import { getKeywordRanking } from "@/lib/dashboard/queries";
import { SectionHeader } from "./section-header";
import { KeywordRankingTable } from "./keyword-ranking-table";

export async function KeywordSection({
  locationId,
  yearMonth,
}: {
  locationId: string;
  yearMonth: string;
}) {
  const result = await getKeywordRanking(locationId, yearMonth);

  return (
    <section className="space-y-4">
      <SectionHeader
        title="検索キーワードランキング"
        description="Google 検索で表示されたキーワード"
        icon={<Search className="h-5 w-5" />}
      />
      <KeywordRankingTable result={result} />
    </section>
  );
}
