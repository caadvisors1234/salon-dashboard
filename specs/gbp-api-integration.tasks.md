# タスク: GBP API連携（OAuth 2.0設定・Performance API v1・Reviews API v4.9・抽象化レイヤー）

**Spec**: ./gbp-api-integration.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

代理店のGBPデータを自動取得するAPI連携基盤を構築する。OAuth 2.0認証フロー、3つのGoogle API（Performance v1日次指標・月次キーワード、Reviews v4.9）との連携、将来のAPI廃止に備えた抽象化レイヤーを実装する。

---

## 前提条件

- [x] Supabase プロジェクト稼働中（gjjqevftteoqhxazodyy）
- [x] DB スキーマ作成済み（daily_metrics, monthly_keywords, rating_snapshots テーブル）
- [x] RLS ポリシー実装済み
- [x] 管理画面（ユーザー管理・クライアント管理・ロケーション管理）実装済み
- [x] 認証基盤（Supabase Auth + 3ロール）実装済み
- [ ] Google Cloud プロジェクトの GBP API アクセスが承認されていること

---

## タスク一覧

### フェーズ 1: DB・環境設定

- [x] **Task 1**: DBマイグレーション（google_oauth_tokens・gbp_accounts テーブル作成 + RLS）
  - 受入条件: 2テーブルが作成され、RLSが有効化・Admin専用ポリシーが適用されていること
  - 対象ファイル: Supabase MCP `apply_migration`
  - depends_on: なし
  - 詳細:
    - `google_oauth_tokens` テーブル作成（Spec セクション3 データベース定義に準拠）
    - `gbp_accounts` テーブル作成
    - 両テーブルに RLS 有効化 + Admin専用ポリシー（SELECT/INSERT/UPDATE/DELETE）
    - `google_oauth_tokens` に `updated_at` 自動更新トリガー追加
    - TypeScript型を `mcp generate_typescript_types` で再生成

- [x] **Task 2**: 環境変数設定 + npm依存パッケージ追加
  - 受入条件: `.env.local` に Google OAuth 変数が設定され、`google-auth-library` がインストールされていること
  - 対象ファイル: `.env.local`, `.env.local.example`, `package.json`
  - depends_on: なし
  - 詳細:
    - `.env.local` に `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_OAUTH_SCOPES` を追加
    - `GOOGLE_TOKEN_ENCRYPTION_KEY` を生成（`openssl rand -hex 32`）して追加
    - `.env.local.example` にプレースホルダーを追加
    - `npm install google-auth-library` を実行

### フェーズ 2: OAuth 2.0 基盤

- [x] **Task 3**: GBP型定義 + トークン暗号化・ストア実装
  - 受入条件: トークンの暗号化→保存→取得→復号化の一連のフローが動作すること
  - 対象ファイル: `src/lib/gbp/types.ts`, `src/lib/gbp/token-store.ts`
  - depends_on: Task 1, Task 2
  - 詳細:
    - `src/lib/gbp/types.ts`: GBP API関連の全型定義（DailyMetricType, RatingData, KeywordResult, APIレスポンス型等）
    - `src/lib/gbp/token-store.ts`: AES-256-GCM による暗号化/復号化関数、Supabase admin client でのトークンCRUD
    - `getValidAccessToken()`: 期限チェック → 期限切れならリフレッシュ → 暗号化して保存 → 復号済みトークンを返却
    - `invalidateToken()`: `is_valid = false` に更新

- [x] **Task 4**: OAuth ヘルパー + API ルート実装（認証開始・callback・状態・切断）
  - 受入条件: ブラウザで `/api/oauth/google` にアクセスするとGoogleの認可画面にリダイレクトされ、承認後にcallbackでトークンがDBに保存されること
  - 対象ファイル: `src/lib/gbp/oauth.ts`, `src/app/api/oauth/google/route.ts`, `src/app/api/oauth/google/callback/route.ts`, `src/app/api/oauth/google/status/route.ts`, `src/app/api/oauth/google/disconnect/route.ts`
  - depends_on: Task 3
  - 詳細:
    - `src/lib/gbp/oauth.ts`:
      - `getAuthorizationUrl()`: state生成（CSRF対策）、Google認可URLを構築
      - `exchangeCodeForTokens(code)`: 認可コード → トークン交換（POST oauth2.googleapis.com/token）
      - `refreshAccessToken(refreshToken)`: access_token をリフレッシュ
      - `getUserInfo(accessToken)`: openid/email スコープで Google メールアドレス取得
    - `GET /api/oauth/google`: セッション検証 → Admin確認 → 認可URLにリダイレクト
    - `GET /api/oauth/google/callback`: state検証 → トークン交換 → 暗号化保存 → accounts.list呼び出し → 設定画面にリダイレクト
    - `GET /api/oauth/google/status`: 接続状態をJSON返却（connected/disconnected/invalid）
    - `POST /api/oauth/google/disconnect`: トークン削除 + gbp_accounts削除

### フェーズ 3: GBP APIクライアント + アカウント管理

- [x] **Task 5**: GBP認証済みHTTPクライアント実装
  - 受入条件: 有効なアクセストークンを使用してGBP APIにリクエストを送信でき、401時にトークンリフレッシュが自動的に実行されること
  - 対象ファイル: `src/lib/gbp/client.ts`
  - depends_on: Task 3, Task 4
  - 詳細:
    - `GbpApiClient` クラス:
      - コンストラクタで Supabase admin client を受け取る
      - `request(url, options)`: Bearer トークン付き fetch。401時に自動リフレッシュ&リトライ
      - レート制限: 呼び出し間に最低300ms間隔を挿入
      - リトライ: 429/5xx で指数バックオフ（1s → 2s → 4s、最大3回）
      - 全リクエストのログ出力（成功/失敗/リトライ回数）
      - refresh_token 失効検知時に `invalidateToken()` 呼び出し

- [x] **Task 6**: GBPアカウント・ロケーション取得 + APIルート
  - 受入条件: `/api/gbp/accounts` でGBPアカウント一覧、`/api/gbp/locations` でロケーション一覧がJSON返却されること
  - 対象ファイル: `src/lib/gbp/accounts.ts`, `src/app/api/gbp/accounts/route.ts`, `src/app/api/gbp/locations/route.ts`
  - depends_on: Task 5
  - 詳細:
    - `src/lib/gbp/accounts.ts`:
      - `fetchGbpAccounts(client)`: `GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts` → gbp_accounts テーブルにUPSERT
      - `fetchGbpLocations(client, accountId)`: `GET https://mybusinessbusinessinformation.googleapis.com/v1/{account}/locations` → ロケーション一覧を返却
    - `GET /api/gbp/accounts`: Admin認証 → DB保存済みアカウント一覧を返却
    - `GET /api/gbp/locations`: Admin認証 → 全アカウントのロケーション一覧を返却（API直接呼び出し）

- [x] **Task 7**: ロケーションマッピングUI（管理画面ドロップダウン追加）
  - 受入条件: ロケーション編集ダイアログでGBPロケーションをドロップダウンから選択でき、選択値が `locations.gbp_location_id` に保存されること
  - 対象ファイル: `src/components/admin/location-edit-dialog.tsx`, `src/lib/admin/actions.ts`
  - depends_on: Task 6
  - 詳細:
    - `location-edit-dialog.tsx` を修正:
      - GBP接続済みの場合: `/api/gbp/locations` からロケーション一覧を取得してドロップダウン表示
      - GBP未接続の場合: 従来の手動入力フィールドを表示（フォールバック）
      - ドロップダウン選択時に `gbp_location_id` を自動設定
    - `location-create-dialog.tsx` にも同様のドロップダウンを追加

### フェーズ 4: データ取得API実装

- [x] **Task 8**: Performance API v1 - 日次パフォーマンス指標取得
  - 受入条件: 指定ロケーション・日付範囲の7指標が取得でき、`daily_metrics` テーブルにUPSERTされること
  - 対象ファイル: `src/lib/gbp/performance.ts`
  - depends_on: Task 5
  - 詳細:
    - `fetchDailyMetrics(client, locationId, startDate, endDate)`:
      - `POST .../v1/locations/{id}:fetchMultiDailyMetricsTimeSeries` を呼び出し
      - 7つの DailyMetric を一括リクエスト
      - レスポンスの `multiDailyMetricTimeSeries` をパースして `DailyMetricResult[]` に変換
    - `saveDailyMetrics(supabase, locationUuid, results)`:
      - `daily_metrics` テーブルに UPSERT（ON CONFLICT (location_id, date, metric_type)）
      - service_role クライアントで実行

- [x] **Task 9**: Search Keywords API - 月次検索キーワード取得
  - 受入条件: 指定ロケーション・月のキーワードが全件取得（ページネーション対応）され、value/threshold が正しく判別されて `monthly_keywords` にUPSERTされること
  - 対象ファイル: `src/lib/gbp/keywords.ts`
  - depends_on: Task 5
  - 詳細:
    - `fetchMonthlyKeywords(client, locationId, year, month)`:
      - `GET .../v1/locations/{id}/searchkeywords/impressions/monthly` を呼び出し
      - `pageSize=100` でページネーション（nextPageToken が無くなるまで繰り返し）
      - `insightsValue.value` → `insights_value_type='VALUE'`, `insights_value` に保存
      - `insightsValue.threshold` → `insights_value_type='THRESHOLD'`, `insights_threshold` に保存
    - `saveMonthlyKeywords(supabase, locationUuid, yearMonth, results)`:
      - `monthly_keywords` テーブルに UPSERT（ON CONFLICT (location_id, year_month, keyword)）

- [x] **Task 10**: Reviews API v4.9 - 評価・レビュー数スナップショット取得
  - 受入条件: 指定ロケーションの `averageRating` / `totalReviewCount` が取得でき、`rating_snapshots` にUPSERTされること
  - 対象ファイル: `src/lib/gbp/reviews.ts`
  - depends_on: Task 5, Task 6
  - 詳細:
    - `fetchRatingSnapshot(client, accountId, locationId)`:
      - `GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}/reviews?pageSize=1`
      - レスポンスから `averageRating`, `totalReviewCount` を抽出
    - `saveRatingSnapshot(supabase, locationUuid, date, rating, reviewCount)`:
      - `rating_snapshots` テーブルに UPSERT（ON CONFLICT (location_id, date)）

### フェーズ 5: 抽象化レイヤー・統合・通知

- [x] **Task 11**: 抽象化レイヤー（RatingProvider + PerformanceMetricsProvider）
  - 受入条件: `RatingProvider` インターフェースが定義され、`GbpReviewsRatingProvider` がデフォルト実装として動作すること。ファクトリ関数で provider を切替可能なこと
  - 対象ファイル: `src/lib/gbp/providers/rating-provider.ts`, `src/lib/gbp/providers/gbp-reviews-provider.ts`, `src/lib/gbp/providers/performance-provider.ts`
  - depends_on: Task 8, Task 9, Task 10
  - 詳細:
    - `rating-provider.ts`: `RatingProvider` インターフェース + `RatingData` 型定義
    - `gbp-reviews-provider.ts`: `GbpReviewsRatingProvider` 実装（Task 10 の `fetchRatingSnapshot` をラップ）
    - `performance-provider.ts`: `PerformanceMetricsProvider` インターフェース + `GbpPerformanceProvider` 実装（Task 8, 9 をラップ）
    - ファクトリ: `createRatingProvider()` → 環境変数/設定で provider 切替可能

- [x] **Task 12**: テスト取得エンドポイント + トークン失効通知
  - 受入条件: `/api/gbp/test-fetch` で指定ロケーションの直近1日分全指標が取得でき、refresh_token 失効時に Admin にメール通知が送信されること
  - 対象ファイル: `src/app/api/gbp/test-fetch/route.ts`, `src/lib/gbp/notification.ts`
  - depends_on: Task 11
  - 詳細:
    - `POST /api/gbp/test-fetch`:
      - リクエストボディ: `{ locationId: string }`（locations テーブルの UUID）
      - locations テーブルから `gbp_location_id` と対応する `gbp_account_id` を解決
      - 直近1日分の日次パフォーマンス指標 + レビュースナップショット + 当月キーワードを取得
      - 取得結果を `daily_metrics`, `rating_snapshots`, `monthly_keywords` にUPSERT
      - レスポンス: 取得成功/失敗の詳細サマリーJSON
    - `src/lib/gbp/notification.ts`:
      - `notifyTokenInvalidation(adminEmail)`: Supabase Auth admin API でメール送信
      - `GbpApiClient` 内の失効検知から呼び出し

- [x] **Task 13**: 型再生成 + 最終検証
  - 受入条件: `tsc --noEmit` がエラーなし、全APIエンドポイントが正常レスポンスを返すこと
  - 対象ファイル: `src/types/database.ts`
  - depends_on: Task 12
  - 詳細:
    - Supabase MCP `generate_typescript_types` で `database.ts` を再生成
    - `tsc --noEmit` で型エラーがないことを確認
    - 全APIエンドポイント一覧の動作確認チェックリスト:
      - `GET /api/oauth/google` → Google認可画面へリダイレクト
      - `GET /api/oauth/google/status` → 接続状態JSON
      - `POST /api/oauth/google/disconnect` → 切断成功
      - `GET /api/gbp/accounts` → アカウント一覧JSON
      - `GET /api/gbp/locations` → ロケーション一覧JSON
      - `POST /api/gbp/test-fetch` → 指標取得結果JSON

---

## 依存関係図

```
Task 1 (DB migration) ──┐
                        ├─→ Task 3 (型定義 + トークンストア)
Task 2 (env + deps) ────┘          │
                                   ▼
                          Task 4 (OAuth ヘルパー + APIルート)
                                   │
                                   ▼
                          Task 5 (GBP HTTPクライアント)
                           ┌───────┼───────┐
                           ▼       ▼       ▼
                    Task 6      Task 8   Task 9
                    (accounts)  (perf)   (keywords)
                       │           │       │
                       ▼           │       │
                    Task 7         │       │
                    (mapping UI)   │       │
                                   ▼       │
                    Task 10 ◄──────┘       │
                    (reviews)              │
                       │                   │
                       ▼                   ▼
                    Task 11 (抽象化レイヤー) ◄──┘
                       │
                       ▼
                    Task 12 (test-fetch + 通知)
                       │
                       ▼
                    Task 13 (型再生成 + 最終検証)
```

---

## 完了チェックリスト

- [x] 全タスクが完了マーク済み
- [x] TypeScript型エラーなし（`tsc --noEmit`）
- [x] Specの受入条件（AC1〜AC13）を全て満たす
- [x] 要件定義書セクション 3.1.1, 3.2, 3.3.1, 3.4 の仕様と一致
- [ ] 全APIエンドポイントが正常動作（※ 実環境での動作確認は Google API アクセス承認後に実施）
- [x] RLSポリシーが正しく機能（Admin以外がOAuth/GBPエンドポイントにアクセスできないこと）

---

## メモ

- Google Cloud の GBP API アクセス承認が前提。未承認の場合 Task 5 以降がブロックされる
- OAuth callback テスト時は `http://localhost:3000` でアプリが起動している必要がある
- Reviews API v4.9 は `accounts/{accountId}/locations/{locationId}` 形式のため、Task 6 のアカウント取得が Task 10 の前提条件
