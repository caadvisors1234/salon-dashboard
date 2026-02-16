# Spec: プロジェクト初期セットアップ

**ステータス**: COMPLETED
**作成日**: 2026-02-16
**最終更新**: 2026-02-16
**要件定義書参照**: セクション 5.1, 5.2

---

## 1. 目的

GBP Performance Dashboardの開発基盤を構築する。Next.js (App Router) + TypeScript + Tailwind CSS v4 + shadcn/ui によるフロントエンド/バックエンド統合アプリケーションを作成し、Docker Composeでapp（Next.js）+ nginx（リバースプロキシ）のコンテナ構成を整備する。

Supabaseはクラウド版（`salon-dashboard` プロジェクト: `gjjqevftteoqhxazodyy`）を使用する。

---

## 2. 要件

### 機能要件

- [ ] FR1: Next.js (App Router) + TypeScript プロジェクトを `src/` ディレクトリ構成で作成する
- [ ] FR2: Tailwind CSS v4 + shadcn/ui を導入し、テーマ設定（ダークモード対応含む）を行う
- [ ] FR3: Supabaseクライアント（ブラウザ用 / サーバー用）を設定する
- [ ] FR4: Docker Compose で app / nginx コンテナを構成する
- [ ] FR5: 環境変数ファイル（`.env.local`テンプレート）を用意する
- [ ] FR6: 基本的なプロジェクト構造（ディレクトリ/ファイル配置）を整備する

### 非機能要件

- [ ] NFR1: TypeScript strict mode を有効にする
- [ ] NFR2: `src/` ディレクトリ構成を使用する
- [ ] NFR3: パッケージマネージャーは npm を使用する
- [ ] NFR4: Node.js 20 LTS をベースイメージとする

### スコープ外

- 認証（Auth）実装（別Specで対応）
- RLSポリシー設定（別Specで対応）
- DBスキーマ作成（別Specで対応）
- SSL証明書の設定（本番デプロイ時に対応）
- バッチコンテナ（Phase 2で対応）

---

## 3. 技術設計

### 使用技術

| レイヤー | 技術 | バージョン |
|---------|------|-----------|
| フレームワーク | Next.js (App Router) | latest (v15.x) |
| 言語 | TypeScript | strict mode |
| CSSフレームワーク | Tailwind CSS | v4.x |
| UIライブラリ | shadcn/ui | latest |
| Supabase SDK | @supabase/supabase-js + @supabase/ssr | latest |
| コンテナ | Docker + Docker Compose | - |
| リバースプロキシ | nginx | alpine |

### ディレクトリ構造

```
salon-dashboard/
├── docs/                          # 要件定義書
├── specs/                         # Spec / タスクファイル
├── src/
│   ├── app/
│   │   ├── (auth)/               # 認証関連ページ（後続Spec）
│   │   ├── (dashboard)/          # ダッシュボードページ（後続Spec）
│   │   ├── api/                  # APIルート
│   │   ├── layout.tsx            # ルートレイアウト
│   │   ├── page.tsx              # トップページ（→ログインへリダイレクト予定）
│   │   └── globals.css           # グローバルCSS（Tailwind v4設定）
│   ├── components/
│   │   └── ui/                   # shadcn/ui コンポーネント
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts         # ブラウザ用Supabaseクライアント
│   │   │   ├── server.ts         # サーバー用Supabaseクライアント
│   │   │   └── middleware.ts     # Middleware用Supabaseクライアント
│   │   └── utils.ts              # cn() ユーティリティ等
│   └── types/                    # 共通型定義
├── batch/                        # バッチ処理（Phase 2）
├── docker/
│   └── nginx/
│       └── default.conf          # nginx設定
├── .env.local.example            # 環境変数テンプレート
├── docker-compose.yml            # Docker Compose設定
├── Dockerfile                    # Next.jsアプリ用
├── .dockerignore
├── next.config.ts                # Next.js設定
├── tsconfig.json                 # TypeScript設定
├── package.json
└── components.json               # shadcn/ui設定
```

### Docker Compose構成

要件定義書セクション5.2に準拠:

| コンテナ | 役割 | ポート | 再起動ポリシー |
|---------|------|--------|---------------|
| app | Next.js（フロント + API） | 3000 | `unless-stopped` |
| nginx | リバースプロキシ | 80 | `unless-stopped` |

> **注記**: SSL終端（443ポート）は本番デプロイ時に追加。開発段階ではHTTP（80）のみ。
> **注記**: batch コンテナは Phase 2 で追加する。

### Dockerfile（Next.js app）

- ベースイメージ: `node:20-alpine`
- マルチステージビルド: deps → builder → runner
- standalone output mode（Next.js最適化）
- 非rootユーザーで実行

### nginx設定

- ポート80でリクエストを受付
- `/` 以下を app:3000 にプロキシ
- WebSocket対応（`Upgrade` ヘッダー転送）
- 静的ファイルキャッシュヘッダー

### Supabaseクライアント設計

Supabase公式推奨パターンに準拠:

| クライアント | 用途 | ファイル |
|------------|------|---------|
| Browser Client | クライアントコンポーネント | `src/lib/supabase/client.ts` |
| Server Client | サーバーコンポーネント / Server Actions / Route Handlers | `src/lib/supabase/server.ts` |
| Middleware Client | Next.js Middleware（セッション更新） | `src/lib/supabase/middleware.ts` |

### Tailwind CSS v4 + shadcn/ui 設定

Next.jsではPostCSS経由でTailwind CSS v4を使用する（`@tailwindcss/postcss`）。

**globals.css の構成**:
1. `@import "tailwindcss"` でTailwind読み込み
2. `@import "tw-animate-css"` でアニメーション読み込み
3. `:root` / `.dark` でCSS変数定義（`hsl()` ラッパー使用）
4. `@theme inline` でCSS変数をTailwindユーティリティにマッピング
5. `@layer base` でbodyスタイル適用

**components.json（shadcn/ui）**:
- `"tailwind.config": ""` （v4ではconfig不要）
- `"tailwind.css": "src/app/globals.css"`
- `"cssVariables": true`

### 環境変数

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://gjjqevftteoqhxazodyy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| パッケージマネージャー | npm | create-next-appデフォルト、チーム標準化 |
| Supabase | クラウド版 | ローカルDocker不要でDB管理を簡略化 |
| Node.jsバージョン | 20 LTS | 長期サポート、安定性 |
| Docker output | standalone | コンテナサイズ最適化 |
| CSS方式 | PostCSS（`@tailwindcss/postcss`） | Next.js標準統合、Viteプラグイン不要 |

---

## 4. 受入条件

- [ ] AC1: `docker compose up` でapp / nginx コンテナが起動し、ブラウザでhttp://localhost にアクセスしてNext.jsのページが表示される
- [ ] AC2: Tailwind CSSのユーティリティクラスが正しく適用される（`bg-primary`, `text-foreground` 等）
- [ ] AC3: shadcn/ui コンポーネントが追加・利用可能である（`npx shadcn@latest add button` 等）
- [ ] AC4: Supabaseクライアントが環境変数を読み込み、接続準備ができている
- [ ] AC5: TypeScript strict mode でコンパイルエラーがない
- [ ] AC6: `src/` ディレクトリ構成で整理されている
- [ ] AC7: `.env.local.example` にSupabase接続情報のテンプレートがある

---

## 5. 未解決の質問

（なし - 初期セットアップのため判断事項は全て確定）

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション 5.1, 5.2
- Supabase公式: Next.js + Supabase Auth 統合ガイド
- shadcn/ui: Tailwind v4 対応ガイド
- tailwind-v4-shadcn スキル: Tailwind v4 セットアップパターン
