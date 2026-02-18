# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

美容サロン向けGBP（Google Business Profile）パフォーマンスダッシュボード。組織（クライアント企業）配下の店舗ごとにGBP/HPBの各種指標を収集・可視化し、PDFレポートを生成するマルチテナントSaaS。

**技術スタック**: Next.js 16 / React 19 / TypeScript / Supabase / Tailwind CSS v4 (OKLCH) / shadcn/ui (new-york) / Recharts / pino

## 開発コマンド

```bash
npm run dev              # 開発サーバー起動
npm run build            # プロダクションビルド
npm run lint             # ESLint実行
npm run test             # Vitestユニットテスト（単発）
npm run test:watch       # Vitestウォッチモード
npm run test:coverage    # カバレッジ付きテスト
npm run test:e2e         # Playwright E2Eテスト
npm run test:e2e:ui      # Playwright UIモード
```

単一テストファイルの実行:
```bash
npx vitest run src/lib/hpb/csv-parser.test.ts
npx playwright test e2e/auth.spec.ts
```

## アーキテクチャ

### App Router構造

- `src/app/(auth)/` — 認証ページ（login, auth/confirm, auth/reset-password, auth/set-password）
- `src/app/(dashboard)/` — サイドバー付きダッシュボード（ロール別ルーティング）
- `src/app/api/` — APIルート（GBP, HPB, OAuth, バッチトリガー, PDF）
- `src/app/report/` — PDF生成用レンダリングページ（Puppeteerで取得）

### ダッシュボードルーティング

- `/dashboard` — Admin/Staffはクライアント一覧、Clientロールは即座に `/dashboard/clients/${orgId}` へリダイレクト
- `/dashboard/clients/[orgId]/` — 組織詳細
- `/dashboard/clients/[orgId]/locations/[locationId]/` — 店舗詳細
- `/dashboard/admin/users/`, `/dashboard/admin/clients/`, `/dashboard/admin/settings/` — 管理画面
- ダッシュボードlayoutレベルで `requireAuth()` — 全子ページが認証継承

### ミドルウェアと認証フロー

`src/middleware.ts` → `src/lib/supabase/middleware.ts` の `updateSession()` に委譲。パス定数は `src/lib/auth/constants.ts`:
- `PUBLIC_PATHS`: `/login`, `/auth/confirm`, `/auth/reset-password`, `/auth/set-password`, `/report`
- 未認証で保護パスアクセス → `/login` にリダイレクト
- 認証済みで `/login` アクセス → `/dashboard` にリダイレクト
- `/report` パスはPDF生成用（report_token cookieで独自JWT認証）

### マルチテナンシーとロール

3ロール: **admin**（全データ）/ **staff**（割り当て組織のみ）/ **client**（自組織のみ）

- **認証ガード**: `src/lib/auth/guards.ts` — `getSession()` → `requireAuth()` → `requireRole()` の階層構造
- **アクセス制御**: `src/lib/auth/access.ts` — `checkOrgAccess()`, `checkLocationAccess()`。staffは `user_org_assignments` テーブルで組織割り当て
- **RLS**: 全テーブルでRow Level Security有効。DB関数 `get_user_role()`, `get_accessible_org_ids()` でポリシー制御

### Supabaseクライアント

| 用途 | ファイル | 説明 |
|------|----------|------|
| ブラウザ | `src/lib/supabase/client.ts` | クライアントコンポーネント用（ANON_KEY） |
| サーバー | `src/lib/supabase/server.ts` | Server Components / API Routes用（ANON_KEY + cookies） |
| Admin | `src/lib/supabase/admin.ts` | バッチ処理用（SERVICE_ROLE_KEY、RLSバイパス） |
| Middleware | `src/lib/supabase/middleware.ts` | セッション更新 + パスベース認証制御 |

### 主要機能モジュール

- `src/lib/gbp/` — Google Business Profile API連携（OAuth, パフォーマンス, レビュー, キーワード）
- `src/lib/hpb/` — Hot Pepper Beauty CSVアップロード（Shift_JIS対応, 21指標パース, 最大5MB）
- `src/lib/batch/` — バッチジョブ制御（ハイブリッドロック, リトライ, サーキットブレーカー, batch_logsテーブル記録）
- `src/lib/pdf/` — PDFレポート生成（Puppeteer, JWTトークン, セマフォキュー, レートリミット）
- `src/lib/dashboard/` — ダッシュボードクエリとユーティリティ
- `src/lib/api/response.ts` — API標準レスポンスヘルパー（`apiSuccess()`, `apiError()`）
- `src/lib/audit/logger.ts` — 監査ログ（fire-and-forget、`audit_logs` テーブル）
- `src/lib/env/validation.ts` — 環境変数のZodバリデーション（`batchEnvSchema`, `webEnvSchema`）
- `src/lib/logger.ts` — 構造化ロギング（pino, `createLogger(name)` で名前付きchild logger生成）
- `batch/` — スタンドアロンNode.jsバッチワーカー（node-cron, Docker, tsx直接実行, ヘルスチェック:3001）

### 共通パターン

**APIレスポンス**: `src/lib/api/response.ts` の `apiSuccess<T>(data)` / `apiError(message, status)` を使用。型は `src/types/api.ts` の `ApiResponse<T>`。

**Server Actions（Admin）**: `src/lib/admin/actions.ts` — 戻り値は `ActionResult<T>` = `{ success: true; data: T } | { success: false; error: string }`。先頭で `requireRole(["admin"])` を呼ぶ。変更後に `revalidatePath()` 実行。

**監査ログ**: `logAudit({ userId, action, resourceType, resourceId?, metadata? })` — fire-and-forget。AdminClient経由で `audit_logs` テーブルに書き込み。OAuth callback, バッチトリガー, PDF生成で使用。

**構造化ロギング**: `createLogger("ModuleName")` でpinoのchild loggerを生成。本番はJSON出力、開発はpino-prettyでカラー表示。`LOG_LEVEL` 環境変数で制御（デフォルト: 本番info、開発debug）。

### データフロー

**GBPデータ収集**: Google API → `batch/` (日次cron 18:00 JST) → `daily_metrics` / `rating_snapshots` テーブル → ダッシュボード表示

**PDF生成パイプライン**: APIリクエスト → レートリミット（5リクエスト/時/ユーザー） → セマフォキュー（`PDF_MAX_CONCURRENT` デフォルト2, 5分タイムアウト） → Puppeteerシングルトンブラウザ（60秒アイドルタイムアウト） → `/report/store/[locationId]` レンダリング（ビューポート1122×793px） → `window.__REPORT_READY === true` ポーリング → pdf-libでA4横PDF組立 → PDF/ZIP返却。APIルートに `maxDuration = 300`（5分）設定。

**GBPクライアント**: レートリミット300ms間隔（200 QPM目標）、3回リトライ（指数バックオフ1s/2s/4s）、401時自動トークンリフレッシュ。トークンはAES-256-GCM暗号化（`${iv}:${authTag}:${ciphertext}` base64形式）。**シングルトンOAuthトークン**設計（`singleton_key = "default"`）。

### バッチワーカー詳細

**起動シーケンス** (`batch/src/index.ts`): 環境変数Zodバリデーション → ヘルスチェックHTTPサーバー起動 → ライフサイクル通知メール → 起動時バックフィル → cronスケジュール登録（daily + monthly）→ SIGTERM/SIGINTハンドラ登録

**Graceful shutdown**: cronスケジューラ停止 → 実行中ジョブ完了待ち（最大60秒、`getLockedJobs()` を1秒間隔ポーリング）→ ヘルスサーバー停止 → 停止通知メール → `process.exit(0)`

**ジョブ種別**: `daily`（前日メトリクス）, `monthly`（月次集計）, `backfill`（ギャップ埋め）, `initial-backfill`（店舗初回ロード）

**ハイブリッドジョブロック** (`src/lib/batch/lock.ts`): インメモリ `Set<string>` + DB `batch_locks` テーブル。TTL 10分。プロセス固有 `INSTANCE_ID = ${hostname}-${pid}-${uuid8}`。DB RPC: `acquire_batch_lock`, `release_batch_lock`。

**サーキットブレーカー** (`src/lib/batch/circuit-breaker.ts`): `location_batch_status` テーブルで連続失敗を追跡。**5回連続失敗**で自動無効化（DB RPC `record_batch_failure` で原子的インクリメント）。

**日次バッチ並行度**: `p-limit` で**同時5店舗**処理。店舗単位で3回リトライ（指数バックオフ）。

**ヘルスエンドポイント** (`/health`, ポート3001): DB接続確認（5秒タイムアウト）、最終daily実行の鮮度チェック（26時間超 = degraded）。HTTP 503 if unhealthy。

### コンポーネント構成

- `src/components/ui/` — shadcn/uiベースコンポーネント
- `src/components/admin/` — 管理画面CRUD（ユーザー/組織/店舗）
- `src/components/dashboard/` — KPIカード, チャート, テーブル
- `src/components/auth/` — 認証フォーム
- `src/components/hpb/` — HPBアップロード関連
- トースト通知: **Sonner**（`sonner` パッケージ, `<Toaster richColors />`）

## 規約

- **UIは日本語のみ**（i18nライブラリなし）
- **インポートエイリアス**: `@/*` → `src/*`
- **ファイル命名**: kebab-case（`csv-parser.ts`, `gbp-oauth.ts`）
- **型定義**: `src/types/` に集約（`database.ts` はSupabase生成型、`api.ts` はAPIレスポンス型）
- **APIレスポンス**: `apiSuccess(data)` / `apiError(message, status)` ヘルパーを使用（`src/lib/api/response.ts`）
- **Server Actions**: `ActionResult<T>` 型を返す。`"use server"` + `requireRole()` + `revalidatePath()`
- **認証フロー**: Server Actionsでフォーム処理、`redirect()` で遷移
- **デザイン**: OKLCH色空間（`--primary: oklch(0.666 0.151 5.2)`）、Geist Sans / Geist Monoフォント
- **HMR安全シングルトン**: `globalThis` パターンでPDFキューやレートリミッターを保持

## テスト

- **ユニットテスト（Vitest）**: `src/**/*.test.ts` — テスト環境は `node`（jsdomではない）。`src/test/setup.ts` でダミー環境変数を自動設定、`beforeEach` で `vi.restoreAllMocks()` 実行。カバレッジ対象は `src/lib/**` と `src/app/api/**`
- **E2Eテスト（Playwright）**: `e2e/**/*.spec.ts` — `auth.setup.ts` でセッション確立後、storageStateで各テストに再利用。Chromiumのみ。E2E用環境変数 `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` が必要

## デプロイ

2つのDockerイメージ + Nginxリバースプロキシ（`docker-compose.yml`）:
- **Webアプリ** (`Dockerfile`): マルチステージビルド、Next.js standalone出力、ポート3000。`NEXT_PUBLIC_*` はDockerビルド `ARG` として渡す（ビルド時に埋め込み）。非rootユーザー `nextjs` (uid 1001) で実行
- **バッチワーカー** (`batch/Dockerfile`): Node 20 alpine + tsx直接実行、ポート3001（ヘルスチェック）、ルートの `src/` をコピーしてSupabaseユーティリティを共有。非rootユーザー `batch` で実行
- **Nginx**: ポート80、`client_max_body_size 10M`、`/_next/static` に `max-age=31536000 immutable`

## Supabaseプロジェクト

- **プロジェクトID**: gjjqevftteoqhxazodyy
- **リージョン**: ap-northeast-2

## 環境変数

`.env.local.example` を参照。Zodバリデーション (`src/lib/env/validation.ts`) により起動時に型チェック。

**Web アプリ必須**:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase接続
- `SUPABASE_SERVICE_ROLE_KEY` — Admin操作用
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — 64文字hex（AES-256-GCM鍵）
- `REPORT_TOKEN_SECRET` — PDF生成用JWTシークレット（16文字以上）

**GBP OAuth**:
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `GOOGLE_OAUTH_SCOPES` — デフォルト: `business.manage openid email`

**バッチワーカー追加**:
- `BATCH_DAILY_CRON` (デフォルト: `0 18 * * *`), `BATCH_MONTHLY_CRON` (デフォルト: `0 18 8 * *`)
- `BATCH_BACKFILL_DAYS` (デフォルト: 30, 1-365), `BATCH_HEALTH_PORT` (デフォルト: 3001)
- `RESEND_API_KEY` — メール通知（未設定時はログ出力のみ）

**PDF生成オプション**:
- `PDF_MAX_CONCURRENT` (デフォルト: 2), `PDF_DEVICE_SCALE_FACTOR` (デフォルト: 1.5, 1-3)

## 仕様書

`specs/` ディレクトリに機能別の仕様書（`.md`）とタスク管理（`.tasks.md`）がある。要件定義書は `docs/GBP_Dashboard_Requirements_v1_7.md`。仕様書には権限マトリクス（Admin/Staff/Client）とRLSポリシー設計を含む。
