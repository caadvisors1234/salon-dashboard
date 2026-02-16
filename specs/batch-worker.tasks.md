# タスク: バッチワーカー（日次/月次cron・リトライ・30日バックフィル・メール通知）

**Spec**: ./batch-worker.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

GBP APIの既存モジュール（`src/lib/gbp/` — performance.ts, reviews.ts, keywords.ts, client.ts）をオーケストレーションするバッチワーカープロセスを構築する。日次/月次のcronスケジュール、店舗単位リトライ、起動時30日バックフィル、Resendによるメール通知、Dockerコンテナ化を実装する。

---

## 前提条件

- [x] GBP API連携モジュール実装済み（`specs/gbp-api-integration.md` COMPLETED）
- [x] DBスキーマ実装済み（`daily_metrics`, `rating_snapshots`, `monthly_keywords`, `batch_logs`）
- [x] `src/lib/supabase/admin.ts` — service_role クライアント実装済み
- [x] Docker構成（app + nginx）構築済み

---

## タスク一覧

### フェーズ 1: プロジェクト基盤・共通ユーティリティ

- [x] **Task 1**: batch/ プロジェクトの初期セットアップ
  - `batch/package.json` を作成し `node-cron`, `resend`, `tsx`, `@supabase/supabase-js`, `google-auth-library` を依存関係に追加
  - `batch/tsconfig.json` を作成（`@/*` パスエイリアスで `src/` を参照）
  - `batch/src/lib/config.ts` を作成（環境変数の読み込み・バリデーション）
  - `npm install` で依存関係をインストール
  - 受入条件: `npx tsx batch/src/lib/config.ts` がエラーなく実行可能。パスエイリアス `@/lib/supabase/admin` が解決できる
  - 対象ファイル: `batch/package.json`, `batch/tsconfig.json`, `batch/src/lib/config.ts`
  - depends_on: なし

- [x] **Task 2**: batch_logs ヘルパーとジョブロック機構の実装
  - `batch/src/lib/logger.ts` を作成 — `logJobStart()`, `logJobComplete()`, `logJobError()` ヘルパー関数。`batch_logs` テーブルへの書き込みを抽象化
  - `batch/src/lib/lock.ts` を作成 — インメモリジョブロック（`acquireLock`, `releaseLock`, `isLocked`）。同一ジョブタイプの並行実行を防止
  - 受入条件: logger が `batch_logs` にレコードを挿入でき、lock が排他制御を正しく行う
  - 対象ファイル: `batch/src/lib/logger.ts`, `batch/src/lib/lock.ts`
  - depends_on: Task 1

### フェーズ 2: ジョブ実装

- [x] **Task 3**: 日次バッチジョブの実装
  - `batch/src/jobs/daily.ts` を作成
  - `locations` テーブルから `gbp_location_id IS NOT NULL AND is_active = true` の店舗を取得
  - `gbp_accounts` テーブルから GBP アカウント ID を取得
  - 各店舗に対して順次処理:
    - `fetchDailyMetrics()` → `saveDailyMetrics()`（前日分）
    - `fetchRatingSnapshot()` → `saveRatingSnapshot()`（当日分）
  - 店舗単位のリトライ: 最大3回、指数バックオフ（1s → 2s → 4s）
  - エラー分離: 1店舗の失敗で他店舗の処理が止まらない
  - 結果集計（成功数/失敗数/エラー詳細）を返却
  - 受入条件: 対象店舗の `daily_metrics` と `rating_snapshots` が更新される。1店舗失敗時に他店舗の処理が継続する。リトライが3回まで実行される
  - 対象ファイル: `batch/src/jobs/daily.ts`
  - depends_on: Task 2
  - 対応FR: FR5, FR6, FR7, FR8, FR12, FR13

- [x] **Task 4**: 月次バッチジョブの実装
  - `batch/src/jobs/monthly.ts` を作成
  - 対象年月を算出（前月: 例えば2月実行なら1月分）
  - 各店舗に対して `fetchMonthlyKeywords()` → `saveMonthlyKeywords()`
  - 店舗単位のリトライ（日次と同じパターン）
  - 結果集計を返却
  - 受入条件: 前月分の `monthly_keywords` が全対象店舗について更新される
  - 対象ファイル: `batch/src/jobs/monthly.ts`
  - depends_on: Task 2
  - 対応FR: FR9, FR10, FR11, FR12, FR13

- [x] **Task 5**: 30日バックフィルジョブの実装
  - `batch/src/jobs/backfill.ts` を作成
  - 各店舗について `daily_metrics` と `rating_snapshots` の直近30日を検索し、欠損日を特定
  - `daily_metrics` の欠損検出: 各日付 × 7指標タイプの存在チェック
  - `rating_snapshots` の欠損検出: 各日付のレコード存在チェック
  - 欠損日に対して `fetchDailyMetrics` + `saveDailyMetrics`、`fetchRatingSnapshot` + `saveRatingSnapshot` を実行
  - 30日超の欠損検出: 最終取得日が30日以上前の店舗をリストアップ
  - 結果（補完件数、30日超欠損リスト）を返却
  - 受入条件: 欠損日が正しく検出され、データが補完される。30日超欠損が検出された場合にアラート情報が返却される
  - 対象ファイル: `batch/src/jobs/backfill.ts`
  - depends_on: Task 2
  - 対応FR: FR14, FR15, FR16, FR17, FR18

### フェーズ 3: 通知・インフラ

- [x] **Task 6**: Resend メール通知サービスの実装
  - `batch/src/services/notifier.ts` を作成
  - Resend SDK でメール送信: `sendBatchResultNotification()`, `sendBackfillAlert()`, `sendWorkerLifecycleNotification()`
  - 通知先: `users` テーブル `role = 'admin'` の全ユーザーのメールアドレス
  - メール送信失敗時はコンソールログに記録し、例外をスローしない
  - 既存 `src/lib/gbp/notification.ts` の `notifyTokenInvalidation()` を Resend 対応に更新
  - メールテンプレート: Spec セクション3「メール通知テンプレート」に準拠
  - 受入条件: Resend API が呼び出され、Admin 宛にメールが送信される。送信失敗時にバッチ処理が止まらない
  - 対象ファイル: `batch/src/services/notifier.ts`, `src/lib/gbp/notification.ts`
  - depends_on: Task 1
  - 対応FR: FR19, FR20, FR21, FR22, FR23

- [x] **Task 7**: ヘルスチェックHTTPサーバーの実装
  - `batch/src/services/health.ts` を作成
  - Node.js `http` モジュールで軽量HTTPサーバーを起動（ポート: `BATCH_HEALTH_PORT` デフォルト 3001）
  - `GET /health` → `200 OK` + JSON（`{ status: "ok", uptime, lastDailyRun, lastMonthlyRun }`）
  - グレースフルシャットダウン用のサーバー停止関数をエクスポート
  - 受入条件: `curl http://localhost:3001/health` が `200 OK` を返す
  - 対象ファイル: `batch/src/services/health.ts`
  - depends_on: Task 1
  - 対応FR: FR27

### フェーズ 4: エントリポイント・スケジューラ・Docker

- [x] **Task 8**: スケジューラとエントリポイントの実装
  - `batch/src/scheduler.ts` を作成 — `node-cron` で日次/月次ジョブを登録
  - `batch/src/index.ts` を作成 — エントリポイント:
    1. 環境変数バリデーション
    2. ヘルスチェックサーバー起動
    3. 起動通知（メール）
    4. バックフィル実行（起動時、cron登録前）
    5. cronスケジュール登録（日次 + 月次）
    6. SIGTERM/SIGINT ハンドラ（グレースフルシャットダウン: 実行中ジョブの完了待機 → cron停止 → ヘルスサーバー停止 → 停止通知）
  - ジョブ実行時のフロー: ロック取得 → ジョブ実行 → ログ記録 → 通知 → ロック解放
  - 受入条件: `npx tsx batch/src/index.ts` でワーカーが起動し、ヘルスチェックが応答し、cronが登録される。SIGTERM で正常終了する
  - 対象ファイル: `batch/src/scheduler.ts`, `batch/src/index.ts`
  - depends_on: Task 3, Task 4, Task 5, Task 6, Task 7
  - 対応FR: FR1, FR2, FR3, FR4, FR15, FR28

- [x] **Task 9**: Docker構成とコンテナ化
  - `batch/Dockerfile` を作成（Node 20 alpine、`src/` と `batch/` をコピー、`tsx` で実行）
  - `docker-compose.yml` に `batch` サービスを追加（環境変数、restart: unless-stopped、healthcheck）
  - `.env.local.example` にバッチ関連の環境変数を追加
  - 受入条件: `docker-compose up batch` でコンテナが起動し、ヘルスチェックがパスする
  - 対象ファイル: `batch/Dockerfile`, `docker-compose.yml`, `.env.local.example`
  - depends_on: Task 8
  - 対応FR: FR24, FR25, FR26

### フェーズ 5: 手動実行API

- [x] **Task 10**: バッチ手動実行 API エンドポイントの実装
  - `src/app/api/batch/trigger/route.ts` を作成
  - `POST /api/batch/trigger` — Admin 専用
  - リクエスト: `{ jobType: "daily" | "monthly" | "backfill", targetDate?: string }`
  - 日次/月次/バックフィルの各ジョブロジックを `batch/src/jobs/` から import して実行
  - インメモリロック（API プロセス内）で重複防止
  - `batch_logs` にログ記録 + 結果レスポンス
  - 受入条件: Admin が POST リクエストでバッチを即時実行できる。非Admin は 403。実行中の重複リクエストは 409
  - 対象ファイル: `src/app/api/batch/trigger/route.ts`
  - depends_on: Task 3, Task 4, Task 5
  - 対応FR: FR29, FR30, FR31

---

## 完了チェックリスト

- [ ] 全タスクが完了マーク済み
- [ ] TypeScript strict mode でエラーなし（`npx tsc --noEmit`）
- [ ] Specの受入条件（AC1〜AC12）を全て満たす
- [ ] 要件定義書セクション 3.3.1, 5.2, 7 の仕様と一致
- [ ] `docker-compose up` で app + batch + nginx が正常起動

---

## メモ

- 既存 `src/lib/gbp/` モジュールの関数シグネチャ:
  - `fetchDailyMetrics(client, gbpLocationId, startDate, endDate)` → `DailyMetricResult[]`
  - `saveDailyMetrics(locationUuid, results)` → `number`
  - `fetchRatingSnapshot(client, gbpAccountId, gbpLocationId)` → `RatingData`
  - `saveRatingSnapshot(locationUuid, date, data)` → `void`
  - `fetchMonthlyKeywords(client, gbpLocationId, year, month)` → `KeywordResult[]`
  - `saveMonthlyKeywords(locationUuid, yearMonth, results)` → `number`
  - `createGbpClient()` → `GbpApiClient`（スロットリング300ms + リトライ3回 built-in）
