# タスク: プロジェクト初期セットアップ

**Spec**: ./initial-setup.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui のプロジェクトを作成し、Docker Compose（app + nginx）で動作する開発基盤を構築する。Supabaseはクラウド版を使用。

---

## 前提条件

- [x] Supabase プロジェクト `salon-dashboard` (gjjqevftteoqhxazodyy) が作成済み
- [ ] Docker / Docker Compose がインストール済み
- [ ] Node.js 20+ がローカルにインストール済み

---

## タスク一覧

### Task 1: Next.js プロジェクト作成 ✅

`create-next-app` で Next.js プロジェクトを作成する。

**実行内容**:
- `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm` を実行
- 既存の `docs/`, `specs/` ディレクトリを保持

**受入条件**:
- `npm run dev` でNext.jsが起動し、ブラウザでページが表示される
- `src/` ディレクトリ構成になっている
- TypeScript + Tailwind CSS + ESLint が有効

**対象ファイル**: package.json, tsconfig.json, next.config.ts, src/app/layout.tsx, src/app/page.tsx
**depends_on**: なし

---

### Task 2: Tailwind CSS v4 + shadcn/ui セットアップ ✅

Tailwind CSS v4 の設定を確認・調整し、shadcn/ui を初期化する。

**実行内容**:
1. create-next-app が生成した Tailwind 設定を確認
2. `tw-animate-css` をインストール
3. `globals.css` を Tailwind v4 の4ステップパターンで構成:
   - `:root` / `.dark` でCSS変数定義（hsl()ラッパー）
   - `@theme inline` でマッピング
   - `@layer base` でbodyスタイル
4. `npx shadcn@latest init` で shadcn/ui を初期化
5. `components.json` を Tailwind v4 向けに設定（`"config": ""`）
6. `src/lib/utils.ts` に `cn()` ユーティリティを配置
7. テスト用に Button コンポーネントを追加して動作確認

**受入条件**:
- `bg-primary`, `text-foreground` 等のユーティリティクラスが適用される
- shadcn/ui の Button が正しくレンダリングされる
- ダークモード切替のCSS変数が定義されている

**対象ファイル**: src/app/globals.css, components.json, src/lib/utils.ts, postcss.config.mjs
**depends_on**: Task 1

---

### Task 3: Supabase クライアント設定 ✅

Supabase SDK をインストールし、Browser / Server / Middleware の3種クライアントを設定する。

**実行内容**:
1. `npm install @supabase/supabase-js @supabase/ssr` をインストール
2. `src/lib/supabase/client.ts` - ブラウザ用クライアント作成（`createBrowserClient`）
3. `src/lib/supabase/server.ts` - サーバー用クライアント作成（`createServerClient` + cookies）
4. `src/lib/supabase/middleware.ts` - Middleware用セッション更新ロジック
5. `src/middleware.ts` - Next.js Middleware（セッションリフレッシュ）
6. `.env.local.example` を作成（Supabase URL / Key テンプレート）
7. `.env.local` を作成（実際の接続情報）
8. `.gitignore` に `.env.local` が含まれていることを確認

**受入条件**:
- TypeScript コンパイルエラーなし
- 環境変数テンプレートが `.env.local.example` に存在
- Supabaseクライアントが各コンテキストで利用可能

**対象ファイル**: src/lib/supabase/client.ts, src/lib/supabase/server.ts, src/lib/supabase/middleware.ts, src/middleware.ts, .env.local.example, .env.local
**depends_on**: Task 1

---

### Task 4: プロジェクト構造の整備 ✅

後続Specで使用するディレクトリ構造とプレースホルダーファイルを作成する。

**実行内容**:
1. ディレクトリ作成:
   - `src/app/(auth)/` - 認証関連ページ
   - `src/app/(dashboard)/` - ダッシュボードページ
   - `src/app/api/` - APIルート
   - `src/components/` - カスタムコンポーネント
   - `src/types/` - 型定義
   - `batch/` - バッチ処理（Phase 2）
2. `src/types/index.ts` にプロジェクト共通の型定義の骨格を作成
3. ルートレイアウト (`src/app/layout.tsx`) を日本語対応（`lang="ja"`）に更新
4. トップページ (`src/app/page.tsx`) をプレースホルダーページに更新

**受入条件**:
- 上記ディレクトリが全て存在する
- `layout.tsx` の `<html lang="ja">` が設定されている
- TypeScript コンパイルエラーなし

**対象ファイル**: src/app/layout.tsx, src/app/page.tsx, src/types/index.ts
**depends_on**: Task 2, Task 3

---

### Task 5: Docker 環境構築 ✅

Dockerfile, docker-compose.yml, nginx 設定を作成し、コンテナ起動を確認する。

**実行内容**:
1. `Dockerfile` 作成（マルチステージビルド）:
   - Stage 1: deps - 依存関係インストール
   - Stage 2: builder - Next.js ビルド
   - Stage 3: runner - standalone 実行（非rootユーザー）
2. `.dockerignore` 作成
3. `next.config.ts` に `output: "standalone"` を追加
4. `docker/nginx/default.conf` 作成:
   - ポート80 → app:3000 プロキシ
   - WebSocket対応ヘッダー
   - 静的ファイルキャッシュ
5. `docker-compose.yml` 作成:
   - app: ポート3000, restart: unless-stopped
   - nginx: ポート80, restart: unless-stopped, depends_on: app
6. `docker compose build && docker compose up` で起動確認

**受入条件**:
- `docker compose up` で両コンテナが起動
- http://localhost でNext.jsページが表示される
- `docker compose down` でクリーンに停止

**対象ファイル**: Dockerfile, .dockerignore, docker-compose.yml, docker/nginx/default.conf, next.config.ts
**depends_on**: Task 4

---

## 完了チェックリスト

- [ ] 全タスクが完了マーク済み
- [ ] TypeScript strict mode でコンパイルエラーなし
- [ ] `docker compose up` でアプリケーションが正常起動
- [ ] Tailwind CSS + shadcn/ui が正常動作
- [ ] Supabase クライアントが設定済み
- [ ] Specの受入条件を全て満たす

---

## メモ

- create-next-app が生成する Tailwind CSS のバージョン（v3 or v4）を確認し、v4でなければ手動アップグレードが必要
- shadcn/ui init 時に Tailwind v4 向けの設定が正しく生成されるか確認
- Docker ビルド時に `.env.local` はビルドに含めない（ランタイム環境変数として渡す）
