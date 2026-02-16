# ABOUTME: GBPダッシュボードプロジェクト向けテンプレート
# ABOUTME: Specファイル、タスクファイル、README設定のテンプレート集

# Spec-Driven Development テンプレート

Spec作成時にこれらのテンプレートをコピー・カスタマイズして使用する。

---

## Specファイルテンプレート

**ファイル名**: `specs/{feature-slug}.md`

```markdown
# Spec: {機能名}

**ステータス**: DRAFT | APPROVED | IN_PROGRESS | COMPLETED
**作成日**: {YYYY-MM-DD}
**最終更新**: {YYYY-MM-DD}
**要件定義書参照**: セクション {X.X}

---

## 1. 目的

{何を構築し、なぜ必要なのかを1段落で記述}

{要件定義書の該当セクションから背景を引用}

---

## 2. 要件

### 機能要件

- [ ] FR1: {条件Yのとき、システムはXを行う}
- [ ] FR2: {ユーザーはZの操作ができる}

### 非機能要件

- [ ] NFR1: パフォーマンス - {例: 初期表示3秒以内}
- [ ] NFR2: セキュリティ - {例: RLSによるデータ分離}

### スコープ外

- {今回構築しないもの}

### 権限マトリクス

| 操作 | Admin | Staff | Client |
|------|-------|-------|--------|
| {操作1} | ✅ | ✅ | ❌ |
| {操作2} | ✅ | ❌ | ❌ |

---

## 3. 技術設計

### 使用技術

- **フロントエンド**: Next.js App Router (`src/app/...`)
- **API**: Next.js API Routes (`src/app/api/...`)
- **DB**: Supabase PostgreSQL
- **認証**: Supabase Auth
- **UI**: shadcn/ui + Tailwind CSS v4

### データベース

{関連テーブルとカラム定義}
{要件定義書 セクション5.3 を参照}

| テーブル | 主要カラム | 備考 |
|---------|-----------|------|
| {table} | {columns} | {notes} |

### RLSポリシー

| テーブル | ポリシー | 条件 |
|---------|---------|------|
| {table} | SELECT | {auth.uid() = user_id 等} |

### APIエンドポイント

| メソッド | パス | 権限 | 説明 |
|---------|------|------|------|
| GET | `/api/...` | Admin/Staff | {説明} |

### 主要コンポーネント

1. {コンポーネントA} - {役割}
2. {コンポーネントB} - {役割}

### 設計判断

| 判断事項 | 選択 | 理由 |
|---------|------|------|
| {判断1} | {選択} | {理由} |

---

## 4. 受入条件

- [ ] AC1: {具体的でテスト可能な条件}
- [ ] AC2: {具体的でテスト可能な条件}

---

## 5. 未解決の質問

1. {スコープ/振る舞いに関する質問?}
2. {エッジケースに関する質問?}

---

## 6. 参照

- 要件定義書: `docs/GBP_Dashboard_Requirements_v1_7.md` セクション {X.X}
- {関連する既存コードへのパス}
```

---

## タスクファイルテンプレート

**ファイル名**: `specs/{feature-slug}.tasks.md`

```markdown
# タスク: {機能名}

**Spec**: ./{feature-slug}.md
**作成日**: {YYYY-MM-DD}
**ステータス**: PENDING | IN_PROGRESS | COMPLETED

---

## コンテキスト

{Specからの2-3行要約}

---

## 前提条件

- [ ] {必要なセットアップ}
- [ ] {依存するSpec/タスクの完了}

---

## タスク一覧

### フェーズ 1: DB・スキーマ

- [ ] **Task 1**: {説明}
  - 受入条件: {検証方法}
  - 対象ファイル: {想定ファイル}
  - depends_on: なし

- [ ] **Task 2**: {説明}
  - 受入条件: {検証方法}
  - 対象ファイル: {想定ファイル}
  - depends_on: Task 1

### フェーズ 2: API・バックエンド

- [ ] **Task 3**: {説明}
  - 受入条件: {検証方法}
  - depends_on: Task 1

### フェーズ 3: UI・フロントエンド

- [ ] **Task 4**: {説明}
  - 受入条件: {検証方法}
  - depends_on: Task 3

### フェーズ 4: 結合・検証

- [ ] **Task 5**: {結合テスト/E2E}
  - 受入条件: {検証方法}
  - depends_on: Task 3, Task 4

---

## 完了チェックリスト

- [ ] 全タスクが完了マーク済み
- [ ] TypeScript型エラーなし
- [ ] Specの受入条件を全て満たす
- [ ] 要件定義書の仕様と一致

---

## メモ

{実装中の判断、ブロッカー、備考}
```

---

## 簡易Specテンプレート（小規模機能用）

```markdown
# Spec: {機能名}

**ステータス**: DRAFT
**要件定義書参照**: セクション {X.X}

## 目的
{何を・なぜ、2-3文で}

## 要件
- [ ] {要件1}
- [ ] {要件2}

## 技術アプローチ
{簡潔な技術戦略}

## 未解決の質問
1. {質問?}
```

---

## specs/README.md テンプレート

```markdown
# Specs Configuration - GBP Dashboard

GBPパフォーマンスダッシュボード向けSpec設定。

## プロジェクト情報

- **要件定義書**: `docs/GBP_Dashboard_Requirements_v1_7.md` (v1.7)
- **技術スタック**: Next.js + TypeScript + Supabase + Tailwind CSS v4 + shadcn/ui

## 言語設定

- コード: TypeScript (Next.js App Router)
- UI: 日本語のみ
- Spec/コメント: 日本語

## プロジェクト規約

### Specに必須のセクション

- [ ] 権限マトリクス（Admin/Staff/Client の3ロール）
- [ ] RLSポリシー設計（データ分離が関係するSpec）
- [ ] 要件定義書の参照セクション番号

### 命名規約

- Specファイル: `{feature-name}.md`（kebab-case）
- タスクファイル: `{feature-name}.tasks.md`
- ブランチ: `feature/spec-{name}`

### ファイル配置規約

| 種別 | 配置先 |
|------|--------|
| ページ | `src/app/(dashboard)/...` |
| 認証ページ | `src/app/(auth)/...` |
| APIルート | `src/app/api/...` |
| 共通コンポーネント | `src/components/ui/` (shadcn), `src/components/` (カスタム) |
| Supabaseクライアント | `src/lib/supabase/` |
| GBP API | `src/lib/gbp/` |
| HPB処理 | `src/lib/hpb/` |
| 型定義 | `src/types/` |
| バッチ処理 | `batch/` |

## ワークフロー設定

### /spec.tasks の前に

- 要件定義書の該当セクションを再確認
- 関連するSupabaseテーブル設計を確認（セクション5.3）
- RLSポリシーの必要性を評価

### /spec.run 中に

- TypeScript strict mode を遵守
- shadcn/ui コンポーネントを優先使用
- Supabase RLSを必ず設定

### 完了後に

- CLAUDE.md に新モジュールを追記（あれば）
- Specステータスを COMPLETED に更新

## データソース参照

| データ | 取得方法 | 粒度 | 要件定義書セクション |
|--------|---------|------|-------------------|
| GBP パフォーマンス | Business Profile Performance API v1 | 日次 | 3.1.1, 3.2.2 |
| GBP 検索キーワード | searchkeywords.impressions.monthly.list | 月次 | 3.1.1, 3.2.3 |
| GBP 評価・レビュー | GBP API v4.9 Reviews | 日次スナップショット | 3.1.1, 3.2.1 |
| HPB | CSV手動アップロード（Shift_JIS） | 月次 | 3.1.2, 3.3.2 |
```
