# タスク: PDFレポート出力

**Spec**: ./pdf-report.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

店舗単位/クライアント単位でPDFレポートを生成・ダウンロードする機能を構築する。Puppeteerで専用レポートページ（A4横）をレンダリングしPDF化する。同時生成制限（最大2件）をインメモリSemaphoreで実現する。クライアント単位は店舗別PDFをZIPでまとめてダウンロード。

---

## 前提条件

- [x] DBスキーマ構築済み（`daily_metrics`, `rating_snapshots`, `monthly_keywords`, `hpb_monthly_metrics`）
- [x] ダッシュボードUI実装済み（Recharts グラフ、KPIカード、キーワードテーブル）
- [x] データ取得クエリ実装済み（`src/lib/dashboard/queries.ts`）
- [x] 認証・RLS実装済み（`requireAuth`, `getSession`）
- [x] Puppeteer / archiver の依存追加（Task 1 で実施）

---

## タスク一覧

### フェーズ 1: インフラ基盤

- [x] **Task 1**: 依存パッケージ追加 + 内部トークンユーティリティ + PDF生成キューの実装
  - 受入条件:
    - `puppeteer`, `archiver`, `@types/archiver` がインストール済み
    - `src/lib/pdf/token.ts` に以下の関数が実装されている:
      - `createReportToken(userId, scope)` → JWT文字列（有効期限5分、`REPORT_TOKEN_SECRET` 環境変数で署名）
      - `verifyReportToken(token)` → `{ userId, scope }` または例外
    - `src/lib/pdf/queue.ts` に以下が実装されている:
      - `PdfQueue` クラス（シングルトン）
      - `enqueue(job: () => Promise<Buffer>)` → `Promise<Buffer>`: Semaphoreで同時実行を最大2件に制限
      - `getStatus()` → `{ running: number, waiting: number }`
      - タイムアウト: 5分超過でジョブを強制エラー
      - 同時実行上限は環境変数 `PDF_MAX_CONCURRENT`（デフォルト2）で設定可能
  - 対象ファイル:
    - `package.json`（依存追加）
    - `src/lib/pdf/token.ts`
    - `src/lib/pdf/queue.ts`
  - depends_on: なし

### フェーズ 2: レポートテンプレートページ

- [x] **Task 2**: レポート用レイアウト + ヘッダー/フッター + ロゴプレースホルダーの作成
  - 受入条件:
    - `public/logo-placeholder.png` にプレースホルダーロゴ画像が配置されている（シンプルなSVGベースのPNG、または代替テキスト付きのプレースホルダー要素）
    - `src/app/report/layout.tsx` にレポート専用レイアウトが実装されている:
      - dashboardレイアウト（サイドバー等）を使用しない独立レイアウト
      - A4横（297mm x 210mm）向け印刷用CSS（`@media print` + `@page`）
      - Tailwind CSSは有効
    - `src/app/report/components/report-header.tsx` が実装されている:
      - Props: `{ orgName: string, locationName: string, periodLabel: string }`
      - ロゴ + クライアント名 + 店舗名 + 対象期間を横並びで表示
    - `src/app/report/components/report-footer.tsx` が実装されている:
      - 生成日（"生成日: YYYY年MM月DD日"）を右寄せ表示
  - 対象ファイル:
    - `public/logo-placeholder.png`（またはSVG要素で代替）
    - `src/app/report/layout.tsx`
    - `src/app/report/components/report-header.tsx`
    - `src/app/report/components/report-footer.tsx`
  - depends_on: なし

- [x] **Task 3**: 店舗レポートテンプレートページの実装
  - 受入条件:
    - `src/app/report/store/[locationId]/page.tsx` が実装されている:
      - クエリパラメータ `from`（開始年月 YYYY-MM）、`to`（終了年月 YYYY-MM）、`token`（内部JWT）を受け取る
      - `token` を `verifyReportToken()` で検証し、不正な場合は 403 を返す
      - データ取得は Supabase admin クライアント経由で行う（RLSバイパス、トークンのスコープで対象制限）
    - **GBPセクション**が表示される:
      - KPIカード4枚（総合評価、レビュー数、合計閲覧数、合計アクション数 + 前月比）
      - 閲覧数推移グラフ（4系列折れ線・指定期間）
      - アクション指標推移グラフ（3系列折れ線・指定期間）
      - デバイス内訳円グラフ（最終月）
      - 検索キーワードランキングテーブル（最終月・上位20件、ページネーションなし）
    - **HPBセクション**（データあり時のみ表示）:
      - KPIカード3枚（サロン情報PV、CVR、ACR + エリア平均 + 前月比）
      - 推移グラフ3本（PV、CVR、ACR・自店+エリア平均）
    - HPBデータ未登録時はHPBセクションを非表示（プレースホルダーも不要）
    - ページ全体がA4横レイアウトで表示される（GBPが1ページ目、HPBが2ページ目）
    - Rechartsグラフがクライアントサイドで正しくレンダリングされる
    - グラフのレンダリング完了を示す `window.__REPORT_READY = true` フラグを設定する（Puppeteer待機用）
  - 対象ファイル:
    - `src/app/report/store/[locationId]/page.tsx`
    - `src/app/report/components/report-gbp-section.tsx`（GBP KPI + グラフ + キーワード）
    - `src/app/report/components/report-hpb-section.tsx`（HPB KPI + グラフ）
    - `src/lib/pdf/report-queries.ts`（admin クライアント経由のデータ取得関数）
  - depends_on: Task 1, Task 2

### フェーズ 3: PDF生成エンジン

- [x] **Task 4**: Puppeteer PDF生成 + archiver ZIP生成の実装
  - 受入条件:
    - `src/lib/pdf/generator.ts` に以下の関数が実装されている:
      - `generateStorePdf(locationId, startMonth, endMonth, token)` → `Buffer`:
        - Puppeteer を起動（`headless: true`）
        - `http://localhost:${PORT}/report/store/${locationId}?from=${startMonth}&to=${endMonth}&token=${token}` にアクセス
        - `window.__REPORT_READY === true` をポーリングで待機（最大30秒）
        - `page.pdf({ format: 'A4', landscape: true, printBackground: true, scale: 0.8 })` でPDF生成
        - deviceScaleFactor: 2 で高解像度レンダリング
        - Puppeteerインスタンスを閉じてバッファ返却
      - `generateClientZip(orgId, startMonth, endMonth, token, locations)` → `Buffer`:
        - 各店舗の `generateStorePdf()` を順次実行
        - `archiver` で全PDFをZIPにまとめる
        - ファイル名: `{クライアント名}_{店舗名}_{開始月}-{終了月}.pdf`
      - Puppeteerのブラウザインスタンスは可能な限り再利用する（起動コスト削減）
    - エラーハンドリング:
      - ページロード失敗時は適切なエラーメッセージを返す
      - Puppeteerプロセスのリーク防止（finally でブラウザを必ず閉じる）
  - 対象ファイル:
    - `src/lib/pdf/generator.ts`
  - depends_on: Task 1, Task 3

### フェーズ 4: APIルート

- [x] **Task 5**: レポート生成APIエンドポイントの実装
  - 受入条件:
    - `POST /api/reports/generate` が実装されている:
      - リクエストボディ: `{ type, locationId?, orgId?, startMonth, endMonth }` をバリデーション
      - 認証チェック: `getSession()` でセッション確認
      - 権限チェック:
        - `type: 'store'`: locationId の org_id が、ユーザーのアクセス可能な org に含まれるか確認
        - `type: 'client'`: orgId がユーザーのアクセス可能な org に含まれるか確認
        - Admin: 全org アクセス可、Staff: `user_org_assignments` 経由、Client: 自社orgのみ
      - 内部トークン生成 → キュー投入 → PDF/ZIP生成 → バイナリレスポンス
      - `Content-Disposition` ヘッダーで適切なファイル名を設定
      - タイムアウト: Next.js API Route のタイムアウトを考慮（`maxDuration` 設定）
    - `GET /api/reports/queue-status` が実装されている:
      - 認証チェック
      - `PdfQueue.getStatus()` の結果を返却
    - エラーレスポンス:
      - 401: 未認証
      - 403: 権限不足
      - 400: バリデーションエラー
      - 429: キュー満杯
      - 500: 生成エラー
  - 対象ファイル:
    - `src/app/api/reports/generate/route.ts`
    - `src/app/api/reports/queue-status/route.ts`
  - depends_on: Task 1, Task 4

### フェーズ 5: フロントエンドUI

- [x] **Task 6**: レポート出力ダイアログ + 既存ページへのボタン統合
  - 受入条件:
    - `src/components/dashboard/report-dialog.tsx` が実装されている:
      - Props: `{ type: 'store' | 'client', locationId?: string, orgId?: string, triggerLabel?: string }`
      - shadcn/ui `Dialog` ベース
      - 期間選択: 開始年月・終了年月の `MonthPicker`（既存の `PeriodSelector` パターンを参考）
      - 「PDFを生成」ボタン:
        - クリックで `POST /api/reports/generate` にリクエスト
        - 生成中: ボタン無効化 + スピナー + "生成中..." テキスト
        - 成功: Blob → ダウンロードリンクで自動ダウンロード（.pdf or .zip）
        - エラー: toast でエラーメッセージ表示
      - キュー待ち表示: `GET /api/reports/queue-status` をポーリング（3秒間隔）し「待機中（N番目）」表示
    - 店舗詳細ページ（`/dashboard/clients/[orgId]/locations/[locationId]`）に「レポート出力」ボタンが追加されている:
      - ページヘッダー（パンくず横 or 右上）に配置
      - `<ReportDialog type="store" locationId={locationId} />`
    - クライアント詳細ページ（`/dashboard/clients/[orgId]`）に「一括レポート出力」ボタンが追加されている:
      - ページヘッダーに配置
      - `<ReportDialog type="client" orgId={orgId} />`
    - 全3ロール（Admin/Staff/Client）で正しく動作する
  - 対象ファイル:
    - `src/components/dashboard/report-dialog.tsx`
    - `src/app/(dashboard)/dashboard/clients/[orgId]/locations/[locationId]/page.tsx`（ボタン追加）
    - `src/app/(dashboard)/dashboard/clients/[orgId]/page.tsx`（ボタン追加）
  - depends_on: Task 5

---

## 完了チェックリスト

- [x] 全タスクが完了マーク済み
- [x] TypeScript型エラーなし（`npx tsc --noEmit`）
- [ ] Specの受入条件（AC1-AC20）を全て満たす
- [ ] 要件定義書セクション6の仕様と一致
- [ ] 3ロール（Admin/Staff/Client）でのアクセス制御が正しい
- [ ] 同時生成制限（最大2件）が動作する
- [ ] A4横レイアウトでグラフが正しく描画される

---

## メモ

- Puppeteer はレポートページにアクセスするため、Next.js サーバーが起動済みであることが前提
- レポートページ内のグラフは `"use client"` コンポーネントのため、Puppeteer でのJSレンダリング待機が必要（`__REPORT_READY` フラグ）
- 既存の `src/lib/dashboard/queries.ts` のクエリロジックを `src/lib/pdf/report-queries.ts` で再利用する（admin クライアントに差し替え）
- Puppeteer のブラウザインスタンスはリクエスト間で再利用を検討（起動に数秒かかるため）
- Docker 環境では Chromium のインストール方法に注意（`puppeteer` のビルトインダウンロードを使用）
- `archiver` はストリームベースでメモリ効率が良い
- Next.js API Route のデフォルトタイムアウトに注意。`maxDuration` を適切に設定する（store: 60秒、client: 300秒）
