# タスク: ダッシュボードUI

**Spec**: ./dashboard-ui.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

GBP・HPBのパフォーマンスデータを表示するダッシュボードUIを構築する。クライアント一覧（No.2）→ クライアント詳細/店舗一覧（No.3）→ 店舗詳細ダッシュボード（No.4）のドリルダウン構成。Recharts によるグラフ描画、threshold 対応のキーワードテーブル、レスポンシブ対応を含む。

---

## 前提条件

- [x] DBスキーマ構築済み（`daily_metrics`, `rating_snapshots`, `monthly_keywords`, `hpb_monthly_metrics`, `hpb_upload_logs`）
- [x] 認証・RLS実装済み（`requireAuth`, `requireRole`, `getSession`）
- [x] 管理画面（Admin CRUD）実装済み
- [x] HPBアップロード機能実装済み
- [x] GBP API連携・バッチワーカー実装済み

---

## タスク一覧

### フェーズ 1: 基盤セットアップ

- [x] **Task 1**: Recharts インストール + 共通UIコンポーネント作成
  - 受入条件:
    - `recharts` がインストール済みで `import` できる
    - `KpiCard` コンポーネントが値・前月比・期間ラベルを表示できる
    - `TrendBadge` コンポーネントが上昇（緑）/下降（赤）/変化なし/算出不可を色分け表示する
    - `PeriodSelector` コンポーネントが 3m/6m/12m/カスタム（年月）を選択できる
    - ダッシュボード用の型定義（`src/types/dashboard.ts`）が作成されている
  - 対象ファイル:
    - `package.json`（recharts 追加）
    - `src/components/dashboard/kpi-card.tsx`
    - `src/components/dashboard/trend-badge.tsx`
    - `src/components/dashboard/period-selector.tsx`
    - `src/types/dashboard.ts`
  - depends_on: なし

### フェーズ 2: データ層

- [x] **Task 2**: データ取得クエリ関数の実装
  - 受入条件:
    - `src/lib/dashboard/queries.ts` に以下の関数が実装されている:
      - `getClientSummaries()` - クライアント一覧用サマリー（店舗数、前月閲覧数、前月アクション数、前月平均評価、HPBアップロード率）
      - `getLocationSummaries(orgId)` - 店舗一覧用サマリー
      - `getGbpKpiData(locationId)` - GBP KPI（最新評価/レビュー + 当月/前月インプレッション/アクション）
      - `getMetricsTimeSeries(locationId, startMonth, endMonth)` - 月次集計メトリクス時系列
      - `getDeviceBreakdown(locationId, yearMonth)` - デバイス内訳（4セグメント）
      - `getKeywordRanking(locationId, yearMonth, page, pageSize)` - キーワードランキング（当月+前月データ付き）
      - `getHpbData(locationId)` - HPB全月次指標 + 最新アップロードログ
    - 全関数がサーバーサイド Supabase クライアントを使用し、RLS経由でアクセス制御される
    - 当月の期間ラベル算出ロジック（"○月1日〜○日"）が含まれる
    - クライアントサマリーはN+1を避ける効率的なクエリ設計
  - 対象ファイル:
    - `src/lib/dashboard/queries.ts`
  - depends_on: なし

### フェーズ 3: ページ実装

- [x] **Task 3**: クライアント一覧ページ（No.2）の実装
  - 受入条件:
    - `/dashboard` でAdmin/Staffにクライアントサマリー一覧テーブルが表示される
    - テーブルに5指標（店舗数、前月閲覧数、前月アクション数、前月平均評価、HPBアップロード率）が表示される
    - クライアント名クリックで `/dashboard/clients/[orgId]` に遷移する
    - Client ロールは `/dashboard/clients/[自社orgId]` に自動リダイレクトされる
    - 「データ未取得」バッジは表示しない（要件定義書方針）
  - 対象ファイル:
    - `src/app/(dashboard)/dashboard/page.tsx`（書き換え）
    - `src/components/dashboard/client-list-table.tsx`
  - depends_on: Task 1, Task 2

- [x] **Task 4**: クライアント詳細・店舗一覧ページ（No.3）の実装
  - 受入条件:
    - `/dashboard/clients/[orgId]` で店舗一覧テーブルが表示される
    - 各店舗行にサマリー指標（前月閲覧数、前月アクション数、最新評価、最新レビュー数）が表示される
    - 店舗名クリックで `/dashboard/clients/[orgId]/locations/[locationId]` に遷移する
    - パンくずナビ「ダッシュボード > クライアント名」が表示される
    - Admin/Staff/Client（自社のみ）がアクセス可能
  - 対象ファイル:
    - `src/app/(dashboard)/dashboard/clients/[orgId]/page.tsx`
    - `src/components/dashboard/location-list-table.tsx`
    - `src/components/dashboard/breadcrumb.tsx`
  - depends_on: Task 1, Task 2

- [x] **Task 5**: 店舗詳細ダッシュボード - GBPセクションの実装
  - 受入条件:
    - `/dashboard/clients/[orgId]/locations/[locationId]` でGBPセクションが表示される
    - KPIカード4枚（総合評価、レビュー数、合計閲覧数、合計アクション数）が前月比付きで表示される
    - 当月が月途中の場合、閲覧数/アクション数カードに期間ラベル（"○月1日〜○日"）が表示される
    - 閲覧数推移折れ線グラフ（4系列: 検索PC/mobile、Maps PC/mobile）が月次集計で表示される
    - アクション推移折れ線グラフ（3系列: 通話、ルート、Webクリック）が表示される
    - デバイス内訳円グラフ（4セグメント）が表示される
    - 期間選択（3m/6m/12m/カスタム年月）でグラフB/Cが更新される
    - パンくずナビ「ダッシュボード > クライアント名 > 店舗名」が表示される
  - 対象ファイル:
    - `src/app/(dashboard)/dashboard/clients/[orgId]/locations/[locationId]/page.tsx`
    - `src/components/dashboard/gbp-kpi-cards.tsx`
    - `src/components/dashboard/impressions-chart.tsx`
    - `src/components/dashboard/actions-chart.tsx`
    - `src/components/dashboard/device-breakdown-chart.tsx`
  - depends_on: Task 1, Task 2

- [x] **Task 6**: 店舗詳細ダッシュボード - キーワードテーブル + HPBセクションの実装
  - 受入条件:
    - 検索キーワードランキングテーブルが当月キーワードを降順表示する
    - テーブルカラム: 順位 / キーワード / 指標値 / 前月比
    - threshold 対応ルール5パターン（FR21-FR25）が正しく適用される:
      - 当月・前月ともに value → 実数 + 差分
      - 当月 threshold → `<N` + `LOW_VOLUME` + `算出不可`
      - 当月 value / 前月 threshold → 実数 + `算出不可`
      - 新規 → 実数 or `<N` + `NEW`
      - 前月のみ → 非表示
    - 20件/ページのページネーションが動作する
    - HPBデータ登録済み店舗: データ鮮度（最終アップロード日時、対象期間、アップロード者）が表示される
    - HPBデータ登録済み店舗: KPIカード3枚（PV数、CVR、ACR）が自店値+エリア平均+前月比で表示される
    - HPBデータ登録済み店舗: 推移グラフ3本（PV/CVR/ACR）が自店=実線/エリア平均=破線で表示される
    - PVグラフはフル幅、CVR/ACRグラフは2カラム
    - HPBデータ未登録店舗: プレースホルダー + HPBアップロード画面へのリンクが表示される
  - 対象ファイル:
    - `src/components/dashboard/keyword-ranking-table.tsx`
    - `src/components/dashboard/hpb-data-freshness.tsx`
    - `src/components/dashboard/hpb-kpi-cards.tsx`
    - `src/components/dashboard/hpb-trend-charts.tsx`
    - `src/app/(dashboard)/dashboard/clients/[orgId]/locations/[locationId]/page.tsx`（HPBセクション追加）
  - depends_on: Task 1, Task 2, Task 5

### フェーズ 4: レスポンシブ + 仕上げ

- [x] **Task 7**: レスポンシブ対応 + モバイルサイドバーの実装
  - 受入条件:
    - モバイル（<768px）でサイドバーが非表示になり、ハンバーガーメニューボタンが表示される
    - ハンバーガーメニュータップで shadcn Sheet ドロワーが開きナビゲーションが表示される
    - KPIカードがブレークポイントに応じてグリッド変更（lg:4列、md:2列、sm:1列）
    - グラフが全ブレークポイントでフル幅表示（lg時のCVR/ACR 2カラムを除く）
    - テーブルがモバイルで横スクロール可能
    - サイドバーナビにダッシュボード関連リンクが正しく反映される
  - 対象ファイル:
    - `src/components/layout/sidebar.tsx`（モバイルドロワー化）
    - `src/app/(dashboard)/layout.tsx`（モバイルヘッダー追加）
    - 各ダッシュボードコンポーネント（レスポンシブ調整）
  - depends_on: Task 3, Task 4, Task 5, Task 6

---

## 完了チェックリスト

- [ ] 全タスクが完了マーク済み
- [ ] TypeScript型エラーなし（`npx tsc --noEmit`）
- [ ] Specの受入条件（AC1-AC21）を全て満たす
- [ ] 要件定義書セクション4の仕様と一致
- [ ] 3ロール（Admin/Staff/Client）でのアクセス制御が正しい
- [ ] モバイル表示が適切

---

## メモ

- Recharts は `"use client"` コンポーネントとして使用する（SSR非対応）
- データ取得はサーバーコンポーネント（Server Component）で行い、props経由でクライアントコンポーネントに渡す
- 集計パフォーマンスはまず都度集計で実装し、問題が出たらマテリアライズドビューに移行する
- 既存の `/dashboard/admin/clients/` は管理画面用。閲覧ダッシュボードの `/dashboard/clients/` とは別導線
