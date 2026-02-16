import { getKeywordRanking } from "@/lib/dashboard/queries";
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
      <h2 className="text-lg font-semibold">検索キーワードランキング</h2>
      <KeywordRankingTable initialResult={result} locationId={locationId} yearMonth={yearMonth} />
    </section>
  );
}
