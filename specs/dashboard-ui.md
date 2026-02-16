# Spec: ダッシュボードUI

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 4（画面設計）、セクション 8 Phase 3

---

## 1. 目的

代理店/コンサルタントおよびクライアントが、GBP・HPBのパフォーマンスデータを直感的に把握するためのダッシュボードUIを構築する。

要件定義書セクション4の画面設計に基づき、以下の3画面を実装する:
- **No.2 クライアント一覧**: クライアント単位のサマリー一覧（Admin/Staff）
- **No.3 クライアント詳細（店舗一覧）**: 店舗単位のサマリー一覧（Admin/Staff/Client）
- **No.4 店舗詳細ダッシュボード**: GBP KPI・グラフ・キーワードテーブル + HPBセクション（Admin/Staff/Client）

現在の `/dashboard` は簡素なウェルカムページだが、これをロール別に適切な一覧画面に置き換える。

---

## 2. 要件

### 機能要件

#### No.2 クライアント一覧（Admin/Staff）

- [ ] FR1: Admin はアクセス可能な全クライアントの一覧を表示する
- [ ] FR2: Staff は `user_org_assignments` で紐付けされた担当クライアントのみ表示する
- [ ] FR3: 各クライアント行に以下のサマリー指標を表示する:
  - 店舗数（`locations` の `is_active = true` 件数）
  - 前月合計閲覧数（4インプレッション指標合算・全店舗）
  - 前月合計アクション数（通話+ルート+Webクリック合算・全店舗）
  - 前月平均評価（`averageRating` をレビュー件数加重平均、★小数1位）
  - HPBアップロード率（直近対象月にHPBデータがある店舗 / 全店舗、%）
- [ ] FR4: クライアント名クリックで No.3 クライアント詳細画面に遷移する
- [ ] FR5: 「データ未取得」「HPB未アップロード」バッジは一覧画面に表示しない（要件定義書方針）

#### No.3 クライアント詳細・店舗一覧（Admin/Staff/Client）

- [ ] FR6: Client ロールは自分の `org_id` の店舗一覧のみ閲覧可能
- [ ] FR7: 各店舗行にサマリー指標（前月閲覧数合計、前月アクション数合計、最新評価、最新レビュー数）を表示する
- [ ] FR8: 店舗名クリックで No.4 店舗詳細ダッシュボードに遷移する

#### No.4 店舗詳細ダッシュボード（Admin/Staff/Client）

**GBPセクション**

- [ ] FR9: **KPIサマリーカード（A）** 4枚を表示する:
  - 総合評価: 現在の星評価（○.○）+ 前月比
  - レビュー数: 現在の総レビュー件数 + 前月比増減
  - 合計閲覧数: 当月合計インプレッション + 前月比 + 期間ラベル（例: "2月1日〜16日"）
  - 合計アクション数: 通話+ルート+Webクリック合計 + 前月比 + 期間ラベル
  - **当月が月途中の場合**: 累計値を表示し、期間ラベル（"○月1日〜○日"）を付与する
- [ ] FR10: **閲覧数推移グラフ（B）** - Google検索（PC/mobile）+ Google Maps（PC/mobile）の4系列折れ線、月次集計
- [ ] FR11: **アクション指標推移グラフ（C）** - 通話クリック、ルート検索、Webサイトクリックの3系列折れ線
- [ ] FR12: **期間選択** - 過去3ヶ月 / 6ヶ月 / 12ヶ月 / カスタム（年月選択MonthPicker）。グラフB/Cで共有
- [ ] FR13: **デバイス内訳円グラフ（D）** - 選択月のインプレッションを4セグメント表示
- [ ] FR14: **検索キーワードランキングテーブル（E）**:
  - 当月キーワードを降順表示
  - カラム: 順位 / キーワード / 指標値 / 前月比
  - 20件/ページのページネーション
  - threshold 対応（後述の前月比表示ルール参照）

**HPBセクション**

- [ ] FR15: HPBデータ未登録店舗ではプレースホルダーを表示し、HPBアップロード画面（`/dashboard/hpb-upload`）へ誘導する
- [ ] FR16: **データ鮮度表示（F）**: 最終アップロード日時、データ対象期間、アップロード者
- [ ] FR17: **HPB KPIサマリーカード（G）** 3枚:
  - サロン情報PV数: 当月PV + 前月比 / エリア平均PV（整数）
  - CVR: 当月CVR + 前月比 / エリア平均CVR（%小数1位）
  - ACR: 当月ACR + 前月比 / エリア平均ACR（%小数1位）
- [ ] FR18: **HPB指標推移グラフ（H）**:
  - サロン情報PV数推移: 自店（実線）/ エリア平均（破線）
  - CVR推移: 自店（実線）/ エリア平均（破線）
  - ACR推移: 自店（実線）/ エリア平均（破線）
  - PVフル幅、CVR/ACRは2カラム（モバイル時縦積み）

#### ドリルダウン導線

- [ ] FR19: `/dashboard` → クライアント一覧 → クライアント詳細（店舗一覧）→ 店舗詳細ダッシュボード の導線を実装する
- [ ] FR20: Client ロールは直接自分のクライアント詳細画面（店舗一覧）にリダイレクトする

#### キーワード前月比表示ルール（v1.7確定）

- [ ] FR21: 当月・前月ともに `value` → 実数、差分（+N / -N）
- [ ] FR22: 当月が `threshold` → `<threshold` + `LOW_VOLUME`、前月比 `算出不可`
- [ ] FR23: 当月 `value` / 前月 `threshold` → 実数、前月比 `算出不可`
- [ ] FR24: 当月新規（前月なし）→ 実数 or `<threshold`、前月比 `NEW`
- [ ] FR25: 前月のみ存在（当月なし）→ 当月テーブルに表示しない

### 非機能要件

- [ ] NFR1: パフォーマンス - 初期表示3秒以内（キャッシュヒット）、5秒以内（ミス時）
- [ ] NFR2: レスポンシブ - PC + スマホ対応（モバイルブレークポイント以下で適切なレイアウト変更）
- [ ] NFR3: セキュリティ - RLSによるデータ分離。Client は自社データのみ閲覧可能
- [ ] NFR4: アクセシビリティ - グラフに基本的なaria-label、色だけでない情報伝達

### スコープ外

- PDFレポート出力（Phase 4で実装）
- レビュー一覧・返信UI（v1.0スコープ外）
- HPBの将来追加候補指標のUI表示（DBには格納済み。UIは段階拡張）
- ダークモード対応（将来拡張）

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| クライアント一覧閲覧 | ✅（全件） | ✅（担当のみ） | ❌ |
| クライアント詳細（店舗一覧）閲覧 | ✅ | ✅（担当のみ） | ✅（自社のみ） |
| 店舗詳細ダッシュボード閲覧 | ✅ | ✅（担当のみ） | ✅（自社のみ） |

---

## 3. 技術設計

### 使用技術

- **フロントエンド**: Next.js App Router（Server Components + Client Components）
- **チャートライブラリ**: Recharts（要インストール）
- **UI**: shadcn/ui + Tailwind CSS v4
- **DB**: Supabase PostgreSQL（RLS経由）
- **認証**: Supabase Auth + `requireAuth` / `requireRole`

### ページルーティング

| パス | 画面 | ファイル |
|------|------|---------|
| `/dashboard` | ロール別リダイレクト or クライアント一覧 | `src/app/(dashboard)/dashboard/page.tsx` |
| `/dashboard/clients/[orgId]` | クライアント詳細（店舗一覧） | `src/app/(dashboard)/dashboard/clients/[orgId]/page.tsx` |
| `/dashboard/clients/[orgId]/locations/[locationId]` | 店舗詳細ダッシュボード | `src/app/(dashboard)/dashboard/clients/[orgId]/locations/[locationId]/page.tsx` |

> **注記**: 既存の `/dashboard/admin/clients` は管理画面（CRUD操作）用。閲覧用ダッシュボードは `/dashboard/clients/` に配置して分離する。

### データベース参照テーブル

| テーブル | 用途 | 主要クエリ |
|---------|------|-----------|
| `organizations` | クライアント一覧 | Admin: 全件、Staff: `user_org_assignments` 経由 |
| `locations` | 店舗一覧 | `org_id` + `is_active = true` |
| `daily_metrics` | GBPパフォーマンス指標 | `location_id` + `date` 範囲 + `metric_type` |
| `rating_snapshots` | 評価・レビュー数 | `location_id` + 最新 `date` |
| `monthly_keywords` | 検索キーワード | `location_id` + `year_month` |
| `hpb_monthly_metrics` | HPB月次指標 | `location_id` + `year_month` |
| `hpb_upload_logs` | HPBデータ鮮度 | `location_id` + 最新 `uploaded_at` |
| `user_org_assignments` | Staff のアクセス制御 | `user_id` |

### RLSポリシー

既存RLSポリシーがデータアクセスを制御する:
- Admin: `get_user_role() = 'admin'` で全件
- Staff: `get_accessible_org_ids()` に含まれる org_id のデータ
- Client: `users.org_id` が一致するデータ

> 追加のRLSポリシー変更は不要。既存ポリシーで画面要件を満たす。

### 主要コンポーネント

#### 共通

1. **`KpiCard`** (`src/components/dashboard/kpi-card.tsx`) - KPI値 + 前月比表示カード
2. **`PeriodSelector`** (`src/components/dashboard/period-selector.tsx`) - 期間選択UI（3m/6m/12m/カスタム）
3. **`TrendBadge`** (`src/components/dashboard/trend-badge.tsx`) - 前月比の上下矢印 + 色分け

#### No.2 クライアント一覧

4. **`ClientListTable`** (`src/components/dashboard/client-list-table.tsx`) - クライアントサマリーテーブル

#### No.3 クライアント詳細

5. **`LocationListTable`** (`src/components/dashboard/location-list-table.tsx`) - 店舗サマリーテーブル

#### No.4 店舗詳細 - GBPセクション

6. **`GbpKpiCards`** (`src/components/dashboard/gbp-kpi-cards.tsx`) - GBP KPIカード4枚
7. **`ImpressionsChart`** (`src/components/dashboard/impressions-chart.tsx`) - 閲覧数推移折れ線グラフ
8. **`ActionsChart`** (`src/components/dashboard/actions-chart.tsx`) - アクション推移折れ線グラフ
9. **`DeviceBreakdownChart`** (`src/components/dashboard/device-breakdown-chart.tsx`) - デバイス内訳円グラフ
10. **`KeywordRankingTable`** (`src/components/dashboard/keyword-ranking-table.tsx`) - キーワードランキング（threshold対応 + ページネーション）

#### No.4 店舗詳細 - HPBセクション

11. **`HpbDataFreshness`** (`src/components/dashboard/hpb-data-freshness.tsx`) - データ鮮度表示
12. **`HpbKpiCards`** (`src/components/dashboard/hpb-kpi-cards.tsx`) - HPB KPIカード3枚（自店+エリア平均）
13. **`HpbTrendCharts`** (`src/components/dashboard/hpb-trend-charts.tsx`) - HPB推移グラフ3本

#### データ取得

14. **`src/lib/dashboard/queries.ts`** - Supabaseクエリ関数群（サーバーサイド）:
  - `getClientSummaries(userId)` - クライアント一覧サマリー集計
  - `getLocationSummaries(orgId)` - 店舗一覧サマリー集計
  - `getGbpKpiData(locationId)` - GBP KPI（最新評価 + 当月/前月指標）
  - `getMetricsTimeSeries(locationId, startDate, endDate)` - 日次メトリクス時系列
  - `getKeywordRanking(locationId, yearMonth)` - キーワードランキング
  - `getHpbData(locationId)` - HPB指標 + アップロードログ

### 集計ロジック

#### クライアント一覧サマリー

| 指標 | 算出SQL概要 |
|------|------------|
| 店舗数 | `SELECT COUNT(*) FROM locations WHERE org_id = ? AND is_active = true` |
| 前月合計閲覧数 | `SUM(value) FROM daily_metrics WHERE metric_type IN ('BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 'BUSINESS_IMPRESSIONS_MOBILE_MAPS') AND date BETWEEN 前月1日 AND 前月末日 AND location_id IN (org配下locations)` |
| 前月合計アクション数 | 同上、`metric_type IN ('CALL_CLICKS', 'BUSINESS_DIRECTION_REQUESTS', 'WEBSITE_CLICKS')` |
| 前月平均評価 | `SUM(rating * review_count) / SUM(review_count) FROM rating_snapshots WHERE date = 前月末日(or最新) AND location_id IN (org配下)` |
| HPBアップロード率 | HPBデータが直近対象月に存在する店舗数 / 全店舗数 |

> **パフォーマンス考慮**: クライアント一覧のサマリー集計は複数テーブルJOINが必要。RPC関数（`get_client_summaries`）をDBに作成してN+1を回避する。

#### 月次集計（グラフ用）

- `daily_metrics` を月単位で `SUM` して月次集計とする
- 月途中のデータは「当月」として表示（前月比は前月全体比）

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| グラフライブラリ | Recharts | 要件定義書指定。React親和性・レスポンシブ対応 |
| サマリー集計 | DB RPC関数（都度集計、問題時にマテリアライズドビューへ移行） | N+1回避、サーバーサイドで完結。まずシンプルに実装 |
| クライアント一覧のルート | `/dashboard` 直下 | Admin/Staffのメインページとして自然 |
| 管理画面との分離 | `/dashboard/clients/` vs `/dashboard/admin/clients/` | 閲覧（ダッシュボード）とCRUD（管理）を分離 |
| Client ロールのルーティング | `/dashboard` → 自社クライアント詳細にリダイレクト | Client は他社を見れないため一覧不要 |
| サーバーコンポーネント vs クライアントコンポーネント | データ取得はServer、グラフ描画はClient | SSR高速化 + チャートはインタラクティブ |
| 期間選択のカスタム範囲 | 年月選択（MonthPicker） | 月次集計表示のため年月単位で十分 |

### レスポンシブ設計

| ブレークポイント | レイアウト変更 |
|----------------|--------------|
| `lg` (1024px+) | KPIカード4列、グラフ横並び（PV全幅 + CVR/ACR 2列） |
| `md` (768px-1023px) | KPIカード2列、グラフ全幅 |
| `sm` (<768px) | KPIカード1列、グラフ全幅、サイドバー→shadcn Sheet ドロワー（ハンバーガーメニュー） |

---

## 4. 受入条件

### No.2 クライアント一覧

- [ ] AC1: Admin ログイン後、`/dashboard` で全クライアントのサマリー一覧が表示される
- [ ] AC2: Staff ログイン後、担当クライアントのみ表示される
- [ ] AC3: Client ログイン後、自社クライアント詳細に自動リダイレクトされる
- [ ] AC4: 5つのサマリー指標（店舗数、前月閲覧数、前月アクション数、前月平均評価、HPBアップロード率）が正しく集計・表示される

### No.3 クライアント詳細

- [ ] AC5: クライアント名クリックで店舗一覧画面に遷移する
- [ ] AC6: 各店舗行にサマリー指標が表示される
- [ ] AC7: パンくずナビで「ダッシュボード > クライアント名」が表示される

### No.4 店舗詳細ダッシュボード

- [ ] AC8: GBP KPIカード4枚が前月比付きで表示される
- [ ] AC9: 閲覧数推移グラフが4系列で表示される
- [ ] AC10: アクション推移グラフが3系列で表示される
- [ ] AC11: デバイス内訳円グラフが表示される
- [ ] AC12: 期間選択（3m/6m/12m/カスタム）でグラフが更新される
- [ ] AC13: キーワードテーブルが threshold 対応ルールに基づき正しく表示される
- [ ] AC14: キーワードテーブルの20件ページネーションが動作する
- [ ] AC15: HPBデータ未登録時にプレースホルダー + アップロードリンクが表示される
- [ ] AC16: HPBセクションのKPIカード・推移グラフが正しく表示される
- [ ] AC17: データ鮮度表示（最終アップロード日時、対象期間、アップロード者）が表示される

### レスポンシブ

- [ ] AC18: モバイル表示でKPIカードが縦積みになる
- [ ] AC19: モバイル表示でグラフがフル幅になる
- [ ] AC20: モバイル表示でテーブルが横スクロール可能になる

### パフォーマンス

- [ ] AC21: 初期表示がキャッシュヒット時3秒以内で完了する

---

## 5. 未解決の質問

なし（全質問解決済み）

### 解決済みの質問

| # | 質問 | 回答 |
|---|------|------|
| Q1 | 期間選択「カスタム」のUI | 年月選択（MonthPicker）で十分 |
| Q2 | サマリー集計パフォーマンス | (C) まずRPC都度集計で実装し、問題時にマテリアライズドビューへ移行 |
| Q3 | サイドバーのモバイル対応 | shadcn Sheet ドロワー方式で問題なし |
| Q4 | Recharts インストール | recharts パッケージ追加OK |
| Q5 | 当月データの表示方法 | 累計値 + 期間ラベル表示（例: "2月1日〜16日"） |

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 4.1, 4.2, 8 Phase 3
- 既存ダッシュボードページ: `src/app/(dashboard)/dashboard/page.tsx`（現在はウェルカムページのみ）
- 既存レイアウト: `src/app/(dashboard)/layout.tsx`
- DB型定義: `src/types/database.ts`
- 認証ガード: `src/lib/auth/guards.ts`
- サイドバー: `src/components/layout/sidebar.tsx`
- 管理画面（既存）: `src/app/(dashboard)/dashboard/admin/clients/`
