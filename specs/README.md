# Specs Configuration - GBP Dashboard

GBP Performance Dashboard向けSpec設定。

## プロジェクト情報

- **要件定義書**: `docs/GBP_Dashboard_Requirements_v1_7.md` (v1.7)
- **技術スタック**: Next.js + TypeScript + Supabase + Tailwind CSS v4 + shadcn/ui

## Supabase プロジェクト

- **プロジェクト名**: salon-dashboard
- **プロジェクトID**: gjjqevftteoqhxazodyy
- **リージョン**: ap-northeast-2
- **URL**: https://gjjqevftteoqhxazodyy.supabase.co

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
