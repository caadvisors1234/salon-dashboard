# タスク: HPBデータアップロード（CSV手動アップロード・バリデーション・パース・格納）

**Spec**: ./hpb-upload.md
**作成日**: 2026-02-16
**ステータス**: COMPLETED

---

## コンテキスト

Admin / Staff がサロンボードからエクスポートしたHPB CSVをアップロードし、Shift_JISデコード・バリデーション・パース後に `hpb_monthly_metrics` へUPSERT。CSV原本はSupabase Storageに保管、取込ログは `hpb_upload_logs` に記録する。

DBテーブル（`hpb_monthly_metrics`, `hpb_upload_logs`）とRLSポリシーは `db-schema-rls` Specで作成済み。

---

## 前提条件

- [x] Supabase プロジェクト稼働中 (gjjqevftteoqhxazodyy)
- [x] `hpb_monthly_metrics` / `hpb_upload_logs` テーブル作成済み
- [x] RLSポリシー設定済み（Admin全件、Staff担当org配下、Client不可）
- [x] 認証基盤・権限ガード実装済み（`requireRole`, `getSession`）
- [x] `iconv-lite` / `csv-parse` インストール済み
- [x] Supabase Storage `hpb-csv` バケット作成済み

---

## タスク一覧

### Task 1: 依存パッケージのインストールと Supabase Storage バケット作成 ✅

開発に必要なnpmパッケージのインストールと、CSV原本保管用のSupabase Storageバケットをマイグレーションで作成する。

**実行内容**:
1. `iconv-lite` と `csv-parse` をインストール
2. Supabase Storage に `hpb-csv` バケットを作成するマイグレーションSQLを適用
   - Private バケット
   - ファイルサイズ上限 5MB
3. Storage RLSポリシーを設定
   - Admin / Staff が担当org配下のファイルのみアップロード・参照可能
   - パス構造: `{org_id}/{location_id}/{timestamp}_{filename}`

**受入条件**:
- `iconv-lite` / `csv-parse` が package.json に追加されている
- Supabase Storage に `hpb-csv` バケットが存在する
- Storage RLSが正しく設定されている

**depends_on**: なし

---

### Task 2: HPBカラム定義・マッピング定数の作成 ✅

CSVカラム名 → DBカラム名のマッピング定数と、バリデーション設定の型定義を作成する。

**実行内容**:
1. `src/lib/hpb/constants.ts` を作成
   - `REQUIRED_COLUMNS`: 必須カラム名配列（19カラム）
   - `CSV_TO_DB_COLUMN_MAP`: CSVカラム名 → DBカラム名のマッピング
   - `COLUMN_VALIDATORS`: カラムごとのデータ型（integer / decimal / decimal_range）定義
   - `MAX_FILE_SIZE`: 5MB定数
   - `KNOWN_DUPLICATE_COLUMNS`: 既知の重複カラム名リスト
2. パース結果の型定義を追加（`ParseResult`, `ParseMessage`, `HpbMetricRow`）

**受入条件**:
- 要件定義書の全21カラム（重複含む）のマッピングが定義されている
- 型定義がTypeScriptコンパイルを通過する

**depends_on**: なし

---

### Task 3: CSVパース・バリデーション処理の実装 ✅

`src/lib/hpb/csv-parser.ts` にShift_JISデコード → ヘッダー検証 → 重複カラム処理 → 行バリデーション → DBレコード変換の処理を実装する。

**実行内容**:
1. `parseHpbCsv(buffer: Buffer): ParseResult` 関数を実装
   - Step 1: `iconv-lite` で Shift_JIS → UTF-8 変換
   - Step 2: `csv-parse/sync` で行配列として取得（`columns: false`）
   - Step 3: ヘッダー行（1行目）を取得し、カラム名の出現回数をカウント
   - Step 4: 重複カラム検知 → ワーニング追加、先頭列のインデックスを採用
   - Step 5: 必須カラムの存在チェック（不足時はエラー）
   - Step 6: カラム名 → 列インデックスのマッピングを構築
   - Step 7: 2行目以降を行ごとにバリデーション
     - 対象年月: YYYYMM 6桁数値チェック → 失敗で行スキップ
     - 整数型カラム: `parseInt` + `isNaN` チェック → 失敗で行スキップ
     - 小数型カラム: `parseFloat` + `isNaN` チェック → 失敗で行スキップ
     - CVR/ACR: 0〜100 範囲チェック → 範囲外はワーニングのみ
   - Step 8: バリデーション通過行を `HpbMetricRow` に変換
2. エンコーディング判定: 変換後のヘッダー行に `対象年月` が含まれるかで判定
   - 含まれない場合は「Shift_JISでないファイルの可能性があります」エラー

**受入条件**:
- Shift_JIS CSVが正しくデコード・パースされる（AC4）
- 非Shift_JISファイルでエラーが返る（AC5）
- 必須カラム不足時にエラーが返る（AC6）
- 重複カラム検知・先頭採用が動作する（AC7）
- 対象年月不正行がスキップされる（AC8）
- 数値バリデーション失敗行がスキップされる（AC9）
- CVR/ACR範囲外がワーニングのみで取り込まれる（AC10）

**depends_on**: Task 1, Task 2

---

### Task 4: CSVアップロード API Route の実装 ✅

`src/app/api/hpb/upload/route.ts` に認証・パース・Storage保存・UPSERT・ログ記録のフルフローを実装する。

**実行内容**:
1. `POST /api/hpb/upload` ハンドラを実装
   - リクエスト: `multipart/form-data` (`file`, `locationId`, `overwrite`)
   - 認証チェック: `getSession()` → Admin / Staff のみ
   - locationId 存在確認: `locations` テーブルから取得（RLSで権限制御）
   - ファイルサイズ: 5MB チェック
   - CSVパース: `parseHpbCsv(buffer)` を呼び出し
   - エラー時: エラーレスポンス返却
   - 重複チェック: パース結果の year_month リストで `hpb_monthly_metrics` を検索
   - 重複あり + `overwrite !== "true"`: `needsConfirmation` レスポンス
   - Storage保存: `supabase.storage.from('hpb-csv').upload(path, buffer)`
     - パス: `{org_id}/{location_id}/{timestamp}_{filename}`
   - UPSERT: `supabase.from('hpb_monthly_metrics').upsert(rows, { onConflict: 'location_id,year_month' })`
   - ログ記録: `supabase.from('hpb_upload_logs').insert(log)`
   - 結果レスポンス返却

**受入条件**:
- Admin/Staff で正常にアップロードできる（AC1, AC2）
- 認証なし / Client ロールで 403 が返る（AC3, NFR2）
- 5MB超で拒否される（AC15）
- 重複時に確認レスポンスが返る（AC11）
- UPSERT が正しく動作する（AC12）
- CSV原本がStorageに保存される（AC13）
- `hpb_upload_logs` にログが記録される（AC14）

**depends_on**: Task 1, Task 3

---

### Task 5: アップロード画面UIの実装 ✅

ページ・フォーム・結果表示・アップロード履歴のUIを実装し、サイドバーにナビゲーションを追加する。

**実行内容**:
1. `src/app/(dashboard)/dashboard/hpb-upload/page.tsx` （Server Component）
   - `requireRole(['admin', 'staff'])` で権限チェック
   - アクセス可能な店舗リスト取得（組織名付き）
   - アップロード履歴取得（最新10件）
   - `UploadForm` と履歴テーブルをレンダリング
2. `src/components/hpb/upload-form.tsx` （Client Component）
   - 店舗セレクト: 組織名 > 店舗名の階層表示（`<Select>` 使用）
   - ファイルドロップゾーン: ドラッグ&ドロップ + クリック選択
   - ファイル選択時にファイル名・サイズをプレビュー表示
   - アップロードボタン: 店舗未選択 or ファイル未選択時は disabled
   - アップロード中: ローディング状態表示
   - API呼び出し: `fetch('/api/hpb/upload', { method: 'POST', body: formData })`
   - `needsConfirmation` レスポンス時: 確認ダイアログ表示 → 承認で `overwrite=true` で再送
3. `src/components/hpb/upload-result.tsx`
   - 成功: 取り込み件数、上書き年月リスト
   - ワーニング: 一覧表示（行番号・カラム名・メッセージ）
   - エラー: エラーメッセージ・詳細
4. サイドバー更新（`src/components/layout/sidebar.tsx`）
   - `NAV_ITEMS` に HPBアップロードを追加
   - Admin / Staff に表示（`staffAndAdmin: true` のような条件）

**受入条件**:
- Client がアップロード画面にアクセスできない（AC3）
- 取り込み結果がUIに表示される（AC16）
- 重複確認ダイアログが表示される（AC11）
- サイドバーからAdmin/Staffがアクセスできる

**depends_on**: Task 4

---

### Task 6: 結合テスト（実CSVフォーマットでのE2E検証） ✅

テスト用CSVを作成し、アップロードのフルフローを検証する。

**実行内容**:
1. テスト用Shift_JIS CSVファイルを作成（要件定義書の21カラム構造を再現）
   - 正常データ（3〜5行）
   - 重複カラム `サロン情報PV数` を含む
   - CVR/ACR 範囲外の値を1行含む
   - 対象年月が不正な行を1行含む
2. テスト用店舗データを確認（既存テストデータ or 新規作成）
3. 検証シナリオ:
   - 正常アップロード → 件数・ワーニング確認
   - 同一年月を再アップロード → 重複確認ダイアログ → 上書き確認
   - 5MB超ファイル → エラー確認
   - ヘッダー不正ファイル → エラー確認
   - UTF-8 CSV → エンコーディングエラー確認
   - Client ロールでのアクセス → 拒否確認
4. Storage にCSV原本が保存されていることを確認
5. `hpb_upload_logs` にログが記録されていることを確認
6. `hpb_monthly_metrics` にデータが正しく格納されていることを確認

**受入条件**:
- 全受入条件（AC1〜AC16）を満たすことを確認
- テスト用CSVで一連のフローが正常に動作する

**depends_on**: Task 5

---

## 完了チェックリスト

- [x] 全タスクが完了マーク済み
- [x] `iconv-lite` / `csv-parse` がインストール済み
- [x] Supabase Storage `hpb-csv` バケットが存在
- [x] CSVパース処理が要件定義書のバリデーションルール8項目を全て実装
- [x] API Route が認証・パース・Storage・UPSERT・ログのフルフローを実装
- [x] UI画面がサイドバーからアクセス可能
- [x] Admin / Staff の権限制御が動作
- [x] TypeScriptコンパイルエラーなし

---

## ファイル一覧（新規作成）

| ファイル | Task |
|---------|------|
| `src/lib/hpb/constants.ts` | Task 2 |
| `src/lib/hpb/csv-parser.ts` | Task 3 |
| `src/app/api/hpb/upload/route.ts` | Task 4 |
| `src/app/(dashboard)/dashboard/hpb-upload/page.tsx` | Task 5 |
| `src/components/hpb/upload-form.tsx` | Task 5 |
| `src/components/hpb/upload-result.tsx` | Task 5 |

## ファイル一覧（変更）

| ファイル | Task | 変更内容 |
|---------|------|---------|
| `package.json` | Task 1 | `iconv-lite`, `csv-parse` 追加 |
| `src/components/layout/sidebar.tsx` | Task 5 | HPBアップロードナビ追加 |
