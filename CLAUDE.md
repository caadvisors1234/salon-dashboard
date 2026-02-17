# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

美容サロン向けGBP（Google Business Profile）パフォーマンスダッシュボード。組織（クライアント企業）配下の店舗ごとにGBP/HPBの各種指標を収集・可視化し、PDFレポートを生成するマルチテナントSaaS。

**技術スタック**: Next.js 16 / React 19 / TypeScript / Supabase / Tailwind CSS v4 / shadcn/ui (new-york) / Recharts

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

- `src/app/(auth)/` — 認証ページ（login, password-reset, set-password）
- `src/app/(dashboard)/` — サイドバー付きダッシュボード（ロール別ルーティング）
- `src/app/api/` — APIルート（GBP, HPB, OAuth, バッチトリガー, PDF）
- `src/app/report/` — PDF生成用レンダリングページ（Puppeteerで取得）

### ミドルウェアと認証フロー

`src/lib/supabase/middleware.ts` でPATH_BASEDルーティング制御:
- `PUBLIC_PATHS`（`/login`, `/password-reset`, `/set-password`, `/report`）は認証不要
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
- `src/lib/hpb/` — Hot Pepper Beauty CSVアップロード（Shift_JIS対応, 21指標パース）
- `src/lib/batch/` — バッチジョブ制御（プロセス内ロック, リトライ, batch_logsテーブル記録）
- `src/lib/pdf/` — PDFレポート生成（Puppeteer, JWTトークン, セマフォキュー）
- `src/lib/dashboard/` — ダッシュボードクエリとユーティリティ
- `batch/` — スタンドアロンNode.jsバッチワーカー（node-cron, Docker, ヘルスチェック:3001）

### データフロー

**GBPデータ収集**: Google API → `batch/` (日次cron 18:00 JST) → `daily_metrics` / `rating_snapshots` テーブル → ダッシュボード表示

**PDF生成パイプライン**: APIリクエスト → セマフォキュー（最大同時2, `PDF_MAX_CONCURRENT`で設定可） → Puppeteerでブラウザ起動（60秒アイドルタイムアウト） → `/report/store/[locationId]` ページレンダリング → `window.__REPORT_READY === true` を500msポーリング（30秒タイムアウト） → PDF/ZIP返却

**GBPクライアント**: レートリミット300ms間隔（200 QPM目標）、3回リトライ（指数バックオフ1s/2s/4s）、401時自動トークンリフレッシュ。トークンはAES-256-GCM暗号化してDB保存

### コンポーネント構成

- `src/components/ui/` — shadcn/uiベースコンポーネント
- `src/components/admin/` — 管理画面CRUD（ユーザー/組織/店舗）
- `src/components/dashboard/` — KPIカード, チャート, テーブル
- `src/components/auth/` — 認証フォーム
- `src/components/hpb/` — HPBアップロード関連

## 規約

- **UIは日本語のみ**（i18nライブラリなし）
- **インポートエイリアス**: `@/*` → `src/*`
- **ファイル命名**: kebab-case（`csv-parser.ts`, `gbp-oauth.ts`）
- **型定義**: `src/types/` に集約（`database.ts` はSupabase生成型）
- **APIレスポンス**: `{ error: string }` または `{ success: boolean, data: ... }` の構造化JSON
- **認証フロー**: Server Actions（`"use server"`）でフォーム処理、`redirect()` で遷移

## テスト

- **ユニットテスト（Vitest）**: `src/**/*.test.ts` — テスト環境は `node`（jsdomではない）。`src/test/setup.ts` でダミー環境変数を自動設定、`beforeEach` で `vi.restoreAllMocks()` 実行。カバレッジ対象は `src/lib/**` と `src/app/api/**`
- **E2Eテスト（Playwright）**: `e2e/**/*.spec.ts` — `auth.setup.ts` でセッション確立後、storageStateで各テストに再利用。Chromiumのみ。E2E用環境変数 `E2E_USER_EMAIL`, `E2E_USER_PASSWORD` が必要

## デプロイ

2つのDockerイメージ:
- **Webアプリ** (`Dockerfile`): Next.js standalone出力、ポート3000、ビルド時に `NEXT_PUBLIC_*` 環境変数が必要
- **バッチワーカー** (`batch/Dockerfile`): Node 20 alpine + tsx、ポート3001（ヘルスチェック）、ルートの `src/` をコピーしてSupabaseユーティリティを共有

## Supabaseプロジェクト

- **プロジェクトID**: gjjqevftteoqhxazodyy
- **リージョン**: ap-northeast-2

## 環境変数

`.env.local.example` を参照。主要な変数:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase接続
- `SUPABASE_SERVICE_ROLE_KEY` — Admin操作用
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` — GBP OAuth
- `REPORT_TOKEN_SECRET` — PDF生成用JWTシークレット
- `RESEND_API_KEY` — メール通知

## 仕様書

`specs/` ディレクトリに機能別の仕様書（`.md`）とタスク管理（`.tasks.md`）がある。要件定義書は `docs/GBP_Dashboard_Requirements_v1_7.md`。
