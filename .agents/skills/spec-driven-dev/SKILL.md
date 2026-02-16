---
name: spec-driven-dev
description: >-
  GBPダッシュボードプロジェクト向け仕様駆動開発フレームワーク。
  要件定義書に基づき、機能単位のSpec作成からタスク分解・実装までを管理する。
  Triggers on "/spec.plan", "/spec.refine", "/spec.clarify", "/spec.tasks",
  "/spec.run", "I want to build", "I want to add", "create spec", "feature spec",
  "new feature", "implement feature".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, AskUserQuestion, TodoWrite, Task
---

# ABOUTME: GBPダッシュボードプロジェクト向け仕様駆動開発フレームワーク
# ABOUTME: ライフサイクル管理: /spec.plan -> /spec.refine -> /spec.tasks -> /spec.run

# Spec-Driven Development（GBPダッシュボード版）

要件定義書（`docs/GBP_Dashboard_Requirements_v1_7.md`）に基づき、機能単位で仕様を明確化し、曖昧さゼロの状態で実装に進む。

## Quick Reference

| コマンド | 用途 |
|---------|---------|
| `/spec.plan <機能名>` | 要件定義書から機能Specを作成 |
| `/spec.refine [セクション]` | コードベース調査でSpecを改善 |
| `/spec.clarify <回答>` | 質問への回答でSpecを更新 |
| `/spec.tasks` | Specを実行可能なタスクに分解 |
| `/spec.run [task#]` | タスクを順次実装 |

---

## Core Principle

**曖昧さゼロまで反復**: 全ての質問が解決するまでタスク実行を開始しない。Claudeが中断なく実装を完遂できる状態を目指す。

---

## Phase 1: `/spec.plan` - Spec作成

**トリガー**: `/spec.plan <機能説明>` or 「〜を実装したい」

### ワークフロー

1. **`specs/` フォルダを確認** - なければ作成
2. **要件定義書を参照**: `docs/GBP_Dashboard_Requirements_v1_7.md` から関連セクションを抽出
3. **Specファイルを生成**: `specs/{feature-slug}.md`
4. **要件定義書の内容で初期セクションを埋める**
5. **不明点・判断が必要な点を質問として整理**
6. **質問を提示して STOP**

### 出力

```
作成: specs/feature-name.md (DRAFT)
参照元: 要件定義書 セクション X.X

確認が必要な点:
1. [スコープに関する質問]
2. [振る舞いに関する質問]

/spec.clarify で回答してください。
```

---

## Phase 2: `/spec.refine` - 調査・改善

**トリガー**: `/spec.refine [セクション]`

### ワークフロー

1. アクティブな DRAFT Specを読み込む
2. **既存コードベースを検索**してパターン・整合性を確認
3. **要件定義書を再確認**して抜け漏れをチェック
4. Technical Strategyを更新
5. 明確性を再評価
6. **質問が残る場合: STOP して提示**

---

## Phase 3: `/spec.clarify` - 質問回答

**トリガー**: `/spec.clarify <回答>`

### 例

```
User: /spec.clarify Q1: RLSはorg_id単位で適用。Q2: Staffは自分の担当クライアントのみ。

Updated specs/auth-rls.md:
- RLSポリシーをorg_idベースに更新
- Staff権限スコープを修正

残りの質問: なし
Specの準備完了。/spec.tasks を実行してください。
```

---

## Phase 4: `/spec.tasks` - タスク分解

**トリガー**: `/spec.tasks`

### 前提条件

- アクティブSpecが DRAFT または APPROVED であること
- 「未解決の質問」セクションが空であること
- 質問が残っている場合: **STOP → /spec.clarify**

### タスク粒度

タスクは**論理的な実装単位**で分割する:
- 「Supabaseスキーマとマイグレーションの作成」
- 「RLSポリシーの実装」
- 「GBPデータ取得バッチの実装」
- 「店舗詳細ダッシュボードUIの構築」

各タスク内での実装・テストサイクルは `/spec.run` で実行する。

### タスク間の依存関係

タスクファイルには依存関係を明記する:
- `depends_on: [Task 1, Task 2]` で先行タスクを指定
- DBスキーマ → API → UI の順序を遵守

---

## Phase 5: `/spec.run` - タスク実装

**トリガー**: `/spec.run [task#]`

### 前提条件

- タスクファイルが存在: `specs/{feature}.tasks.md`
- タスクファイルがない場合: **STOP → /spec.tasks**

### 実装ルール

- **実装 → 動作確認 → コミット** のサイクル
- **型安全性**: TypeScript strict mode を遵守
- **既存パターンの踏襲**: コードベース内の既存パターンに合わせる
- **タスクファイルに完了マーク**
- **要件定義書との照合**: 実装が要件定義書の仕様に合致しているか確認

### 実装時の参照先

| 種別 | 参照先 |
|------|--------|
| 要件定義書 | `docs/GBP_Dashboard_Requirements_v1_7.md` |
| Supabase Auth | nextjs-supabase-auth スキル |
| Tailwind + shadcn | tailwind-v4-shadcn スキル |
| DB設計 | 要件定義書 セクション 5.3 |
| 画面設計 | 要件定義書 セクション 4 |

---

## File Structure

```
specs/
├── README.md                          # プロジェクト設定
├── phase1-auth-foundation.md          # Spec: 認証基盤
├── phase1-auth-foundation.tasks.md    # タスク分解
├── phase2-gbp-batch.md               # Spec: GBPバッチ
├── phase3-dashboard-ui.md             # Spec: ダッシュボードUI
└── ...
```

---

## Spec Status Flow

```
DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED
          |              |
          v              v
      (質問あり?)    (ブロック?)
          |              |
          v              v
        DRAFT      IN_PROGRESS
```

---

## プロジェクト固有のモジュールスコープ

Spec作成時に以下のモジュール構成を考慮する:

| モジュール | ファイル配置 | 考慮事項 |
|-----------|-------------|---------|
| 認証・認可 | `src/app/(auth)/`, `src/lib/supabase/` | Supabase Auth, 招待制, 3ロール(Admin/Staff/Client), RLS |
| クライアント管理 | `src/app/(dashboard)/clients/` | organizations, locations テーブル |
| GBPデータ取得 | `src/lib/gbp/`, `src/app/api/batch/` | Performance API v1, Reviews API v4.9, OAuth 2.0 |
| HPBデータ管理 | `src/app/(dashboard)/hpb-upload/`, `src/lib/hpb/` | Shift_JIS CSV, 重複カラム, バリデーション |
| ダッシュボードUI | `src/app/(dashboard)/`, `src/components/` | Recharts, KPIカード, レスポンシブ |
| レポート出力 | `src/app/api/reports/`, `src/lib/pdf/` | Puppeteer, キュー制限 |
| バッチ処理 | `batch/`, `src/app/api/batch/` | 日次/月次cron, リトライ, バックフィル |
| 共通 | `src/lib/`, `src/types/` | 型定義, ユーティリティ |

---

## 開発フェーズとSpec対応

要件定義書の開発フェーズとSpecの対応関係:

| フェーズ | 対象Spec | 要件定義書セクション |
|---------|---------|-------------------|
| Phase 1: 基盤構築 | 認証, DB, RLS, 管理画面 | 2, 5.1-5.3 |
| Phase 2: API連携 | GBP API, バッチ, HPB CSV, 通知 | 3, 3.3 |
| Phase 3: UI | ダッシュボード, グラフ, レスポンシブ | 4 |
| Phase 4: レポート | PDF生成, E2Eテスト | 6, 7 |

---

## Templates

See `references/templates.md` for:
- Specファイルテンプレート
- タスクファイルテンプレート
- specs/README.md テンプレート

---

## Session Resume

コンテキスト圧縮時の復帰手順:

1. `specs/` 内の `IN_PROGRESS` ステータスのファイルを確認
2. `.tasks.md` ファイルの未完了タスクを確認
3. 報告: 「進行中のSpec: X, 残りタスク: Y件」
4. 確認: 「/spec.run で続行しますか？」
5. **要件定義書を再読み込み**して文脈を復元
