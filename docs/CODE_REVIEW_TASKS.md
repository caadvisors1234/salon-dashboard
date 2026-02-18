# コードベース包括レビュー — 改善タスク一覧

> **作成日**: 2026-02-18
> **対象**: salon-dashboard コードベース全体
> **レビュー領域**: セキュリティ / パフォーマンス / コード品質 / テスト・信頼性

---

## 目次

- [P0: Critical](#p0-critical)
- [P1: High](#p1-high)
- [P2: Medium](#p2-medium)
- [P3: Low](#p3-low)
- [ポジティブ所見（維持すべき点）](#ポジティブ所見)

---

## P0: Critical

### - [x] TASK-001: OAuthトークン保存時の競合状態を修正

- **カテゴリ**: セキュリティ / データ整合性
- **ファイル**: `src/lib/gbp/token-store.ts:57-88`（DELETE クエリ: line 67）
- **現状の問題**:
  `saveOAuthTokens()` が全トークンを DELETE してから INSERT する非トランザクション処理になっている。
  ```typescript
  // 現在のコード (line 67)
  await supabase.from("google_oauth_tokens").delete().gte("created_at", "1970-01-01T00:00:00Z");
  ```
  2人の管理者が同時に OAuth 認証すると、一方のトークンが消失する競合状態が発生する。
- **期待する修正**:
  1. Supabase の upsert を使用してアトミックな操作にする（`onConflict` オプション活用）
  2. または RPC 関数でトランザクション内で DELETE + INSERT を実行
  3. 監査ログテーブルにトークン操作を記録する
- **依存**: TASK-022（監査ログテーブル）が先に完了していれば監査記録も同時実装可。なければトークン操作のアトミック化のみ先行実装し、監査記録は TASK-022 完了後に追加
- **受け入れ基準**:
  - 同時 OAuth フローでトークンが消失しないこと
  - トークン保存が単一のアトミック操作であること
  - トークン操作が監査ログに記録されること（TASK-022 完了後）

---

### - [x] TASK-002: レポート生成時のロケーションアクセス再検証

- **カテゴリ**: セキュリティ
- **依存**: なし
- **ファイル**: `src/app/api/reports/generate/route.ts` / `src/app/report/store/[locationId]/page.tsx`
- **現状の問題**:
  report_token の JWT は検証されるが、トークン発行後にユーザーのアクセス権が剥奪されても最大5分間（トークン有効期限）レポート生成が可能。`/report/store/[locationId]/page.tsx` でロケーション所有権の再検証がない。
- **期待する修正**:
  1. レポートページのデータ取得時に `checkLocationAccess(userId, locationId)` を呼び出す
  2. アクセス権がない場合はエラーページを表示する
- **受け入れ基準**:
  - アクセス権剥奪後のトークンではレポート生成が拒否されること
  - 組織移管されたロケーションに旧トークンでアクセスできないこと

---

### - [x] TASK-003: GBP APIモジュールのユニットテスト作成

- **カテゴリ**: テスト
- **依存**: なし
- **ファイル**: `src/lib/gbp/` 配下全ファイル（テストファイルが存在しない）
- **現状の問題**:
  バッチパイプラインの中核である以下のモジュールにテストが一切ない:
  - `client.ts` — リトライロジック、スロットリング、401時自動リフレッシュ
  - `oauth.ts` — コード交換、トークンリフレッシュ
  - `performance.ts` — メトリクスAPI呼出、`saveDailyMetrics`
  - `reviews.ts` — レーティングスナップショット取得
  - `keywords.ts` — キーワードランキング取得
  - `token-store.ts` — 暗号化・復号・保存
- **期待する修正**:
  各モジュールに対応するテストファイルを作成。特に以下のケースを網羅:
  - `client.test.ts`:
    - 正常レスポンス処理
    - 429 レスポンス時の指数バックオフリトライ
    - 401 → トークンリフレッシュ → リトライ成功
    - 401 → リフレッシュ失敗 → エラー伝播
    - 最大リトライ回数超過
    - 300ms スロットリング動作
  - `oauth.test.ts`:
    - 正常なコード交換
    - 無効なコードでのエラー処理
    - トークンリフレッシュの成功/失敗
  - `token-store.test.ts`:
    - AES-256-GCM 暗号化/復号の往復テスト
    - 無効な暗号鍵での復号エラー
- **受け入れ基準**:
  - `src/lib/gbp/` のテストカバレッジが80%以上
  - 正常系・異常系・エッジケースが網羅されていること

---

### - [x] TASK-004: E2Eテストの修復と拡充

- **カテゴリ**: テスト
- **依存**: なし
- **ファイル**: `e2e/hpb-upload.spec.ts`, `e2e/dashboard.spec.ts`
- **現状の問題**:
  - `hpb-upload.spec.ts` の全テストが `test.fixme()` で無効化されている
  - `dashboard.spec.ts` のアサーションが `not.toBeEmpty()` のみで曖昧
  - PDF生成、ロール別ダッシュボード表示のE2Eテストが存在しない
- **期待する修正**:
  1. `hpb-upload.spec.ts` の `test.fixme()` を解除し、テストを実動作させる
  2. `dashboard.spec.ts` に具体的なアサーションを追加（KPI値表示、チャート存在確認）
  3. 以下のE2Eシナリオを新規追加:
     - ロール別ダッシュボード表示（admin / staff / client）
     - レポート生成フロー（月選択 → 生成 → ダウンロード）
- **受け入れ基準**:
  - `test.fixme()` が0件であること
  - 全E2Eテストが CI で安定的にパスすること

---

### - [x] TASK-005: バッチジョブの分散ロック実装

- **カテゴリ**: 信頼性 / データ整合性
- **依存**: なし
- **ファイル**: `src/lib/batch/lock.ts`（全52行）
- **現状の問題**:
  プロセス内メモリ（`Set`）によるロックのみ実装。Docker 上のバッチワーカーと `/api/batch/trigger` API の同時実行を防止できない。
  ```typescript
  // 現在のコード: プロセスローカルなSet
  const activeLocks = new Set<string>();
  export function acquireLock(jobType: string): boolean {
    if (activeLocks.has(jobType)) return false;
    activeLocks.add(jobType);
    return true;
  }
  ```
- **期待する修正**:
  1. Supabase の `batch_locks` テーブルを作成（`job_type`, `locked_at`, `locked_by`, `expires_at`）
  2. `SELECT ... FOR UPDATE` または PostgreSQL Advisory Lock でアトミックなロック取得
  3. TTL ベースの自動解放（プロセスクラッシュ時のデッドロック防止）
  4. 既存のインメモリロックは高速パスとして残し、DB ロックとの二重チェック構成にする
- **受け入れ基準**:
  - バッチワーカーと API トリガーの同時実行がDB レベルで防止されること
  - プロセスクラッシュ後にロックが自動解放されること（TTL: 10分推奨）
  - ロック取得・解放がログに記録されること

---

## P1: High

### - [ ] TASK-006: バッチジョブのロケーション処理を並列化

- **カテゴリ**: パフォーマンス
- **依存**: なし（TASK-005 の分散ロックとは独立して実装可能）
- **ファイル**: `src/lib/batch/jobs/daily.ts:163-175`
- **現状の問題**:
  ロケーションを `for...of` ループで直列処理している。100店舗 × 2 API 呼出 × 300ms スロットル = 最低60秒。
  ```typescript
  // 現在のコード (lines 166-168)
  for (const location of locations) {
    const result = await processLocation(location, date, gbpAccountId);
    results.push(result);
  }
  ```
- **期待する修正**:
  1. `p-limit` 等で並行数を制御した並列処理に変更（推奨: 同時5件）
  2. GBP API のレートリミット（200 QPM）を超えないよう並行数を調整
  3. 個別ロケーションの失敗が他に影響しないよう `Promise.allSettled` を使用
  ```typescript
  // 修正例
  import pLimit from 'p-limit';
  const limit = pLimit(5);
  const settled = await Promise.allSettled(
    locations.map(loc => limit(() => processLocation(loc, date, gbpAccountId)))
  );
  // Promise.allSettled の戻り値は PromiseSettledResult[] なので unwrap が必要
  const results: JobLocationResult[] = settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { locationId: locations[i].id, success: false, error: r.reason?.message ?? String(r.reason), metricsCount: 0 }
  );
  ```
- **受け入れ基準**:
  - バッチ実行時間が既存の1/4以下になること（100店舗で15秒以内目標）
  - GBP API レートリミットを超過しないこと
  - 個別失敗がジョブ全体を停止しないこと

---

### - [ ] TASK-007: getClientSummaries のクエリ並列化

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: `src/lib/dashboard/queries.ts:67-105`
- **現状の問題**:
  5つの Supabase クエリが直列実行されている。organizations → locations の依存関係はあるが、locations 取得後の metrics / ratings / hpb は独立しているため並列化可能。
- **期待する修正**:
  1. `orgs` → `locations` は直列のまま維持（依存関係あり）
  2. `locationIds` 取得後の metrics, ratings, hpb クエリを `Promise.all()` で並列化
  ```typescript
  const [metricsResult, ratingsResult, hpbResult] = await Promise.all([
    supabase.from("daily_metrics").select("...").in("location_id", locationIds)...,
    supabase.from("rating_snapshots").select("...").in("location_id", locationIds)...,
    supabase.from("hpb_monthly_metrics").select("...").in("location_id", locationIds)...,
  ]);
  ```
- **受け入れ基準**:
  - ダッシュボード初期表示が2-3秒短縮されること
  - 返却データの内容が変更前と同一であること（回帰テストで確認）

---

### - [ ] TASK-008: PDF生成エンドポイントにユーザー単位レート制限を追加

- **カテゴリ**: セキュリティ
- **依存**: なし
- **ファイル**: `src/app/api/reports/generate/route.ts`
- **現状の問題**:
  キュー全体の上限（待機10件）チェックはあるが、ユーザー単位の制限がない。単一ユーザーが大量リクエストを送信して他ユーザーを締め出すことが可能。
- **期待する修正**:
  1. ユーザー単位のレート制限を実装（推奨: 1ユーザー5件/時間）
  2. インメモリの `Map<userId, { count, resetAt }>` で簡易実装可
  3. 制限超過時は 429 レスポンスに残り待ち時間を含める
- **受け入れ基準**:
  - 同一ユーザーが短時間に大量生成できないこと
  - 制限超過時に明確なエラーメッセージが返ること
  - 異なるユーザー間でレート制限が独立していること

---

### - [ ] TASK-009: CSVアップロードのファイル内容検証を強化

- **カテゴリ**: セキュリティ
- **依存**: なし
- **ファイル**: `src/app/api/hpb/upload/route.ts:78-83`
- **現状の問題**:
  ファイル検証が拡張子チェック（`.csv`）のみ。MIMEタイプやファイル内容のバリデーションがない。
  ```typescript
  // 現在のコード (lines 78-83)
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return NextResponse.json(
      { success: false, error: "CSVファイルのみアップロード可能です" },
      { status: 400 }
    );
  }
  ```
- **期待する修正**:
  1. ファイル先頭バイトがテキストデータであることを確認（BOM/Shift_JIS 先頭パターン）
  2. ファイル名のサニタイズ（ディレクトリトラバーサル文字の除去）
  ```typescript
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  ```
  3. Content-Type ヘッダーの検証（`text/csv` または `application/octet-stream`）
- **受け入れ基準**:
  - バイナリファイルがCSV拡張子でアップロードされた場合に拒否されること
  - ファイル名に `../` 等が含まれていてもストレージパスが安全であること

---

### - [ ] TASK-010: セキュリティヘッダーの設定

- **カテゴリ**: セキュリティ
- **依存**: なし（TASK-026 の CSP とは別途実施可能。CSP は TASK-026 で対応）
- **ファイル**: `next.config.ts`（新規セクション追加）
- **現状の問題**:
  セキュリティ関連の HTTP ヘッダーが一切設定されていない。
- **期待する修正**:
  `next.config.ts` に以下のヘッダー設定を追加:
  ```typescript
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  }
  ```
- **受け入れ基準**:
  - レスポンスヘッダーに上記5つが含まれること
  - 既存機能に影響がないこと（特に iframe 埋め込みがないことの確認）

---

### - [ ] TASK-011: Supabaseダウン時のミドルウェアエラーハンドリング

- **カテゴリ**: 信頼性
- **依存**: なし
- **ファイル**: `src/lib/supabase/middleware.ts:40-42`
- **現状の問題**:
  `supabase.auth.getUser()` に try-catch がなく、Supabase 障害時にミドルウェア全体がクラッシュし、全リクエストが 500 エラーになる。
- **期待する修正**:
  1. `getUser()` を try-catch で囲む
  2. エラー時は未認証として扱い、PUBLIC_PATHS はそのまま通す
  3. 保護パスへのアクセスはログインページにリダイレクト
  4. エラーをログに記録（Supabase 障害の検知用）
- **受け入れ基準**:
  - Supabase ダウン時でもアプリが 500 エラーにならないこと
  - 公開パス（`/login`, `/report`等）は正常にアクセスできること
  - エラーがサーバーログに出力されること

---

### - [ ] TASK-012: バッチジョブのテスト作成

- **カテゴリ**: テスト
- **依存**: なし
- **ファイル**: `src/lib/batch/jobs/monthly.ts`, `src/lib/batch/jobs/backfill.ts`（テストファイルなし）
- **現状の問題**:
  月次集計ジョブ（`monthly.ts`）とバックフィルジョブ（`backfill.ts`）にテストがない。
- **期待する修正**:
  以下のテストケースを作成:
  - `monthly.test.ts`:
    - 正常な月次集計の実行と結果検証
    - 対象ロケーションが0件の場合の動作
    - 集計対象期間の正確性
  - `backfill.test.ts`:
    - 新規ロケーションのバックフィル実行
    - 既にデータが存在する期間のスキップ
    - API エラー時のリトライ動作
- **受け入れ基準**:
  - 各テストファイルでカバレッジ70%以上
  - 正常系・異常系が網羅されていること

---

### - [ ] TASK-013: APIルートのテスト作成

- **カテゴリ**: テスト
- **依存**: なし
- **ファイル**: `src/app/api/oauth/`, `src/app/api/reports/`, `src/app/api/gbp/`
- **現状の問題**:
  以下のAPIルートにテストが存在しない:
  - OAuth: `route.ts`, `callback/route.ts`, `disconnect/route.ts`, `status/route.ts`
  - Reports: `generate/route.ts`, `queue-status/route.ts`
  - GBP: `accounts/route.ts`, `locations/route.ts`
- **期待する修正**:
  優先度の高い順にテストを作成:
  1. `reports/generate/route.test.ts` — 認証チェック、キュー制限、エラーハンドリング
  2. `oauth/google/callback/route.test.ts` — state 検証、コード交換、エラー応答
  3. `reports/queue-status/route.test.ts` — ステータス返却
- **受け入れ基準**:
  - 各テストで認証・認可チェック、正常系、主要エラー系をカバー

---

## P2: Medium

### - [ ] TASK-014: HPBデータ取得の select("*") を最適化

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: `src/lib/dashboard/queries.ts:484-488`, `src/lib/pdf/report-queries.ts:290-294`
- **現状の問題**:
  `getHpbData()` が `select("*")` で19カラム全取得。表示に必要なのは一部のみ。
- **期待する修正**:
  `select("*")` を、実際にダッシュボード/レポートで参照されるカラムのみに限定する。
  1. `queries.ts` の `getHpbData()` の呼び出し元コンポーネントで実際に使用されるプロパティを洗い出す
  2. `report-queries.ts` のレポート描画で参照されるプロパティを洗い出す
  3. 各呼び出し元で必要なカラムだけを `.select()` に列挙する（`...` 等の省略はしないこと）
  4. `report-queries.ts` 側も同様に修正
- **受け入れ基準**:
  - `select("*")` が `select("column1, column2, ...")` に置き換えられていること
  - 転送データ量が削減されること
  - 表示内容が変更前と同一であること（回帰テストで確認）

---

### - [ ] TASK-015: ダッシュボードメトリクスAPIにキャッシュヘッダー追加

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: `src/app/api/dashboard/metrics/route.ts`
- **現状の問題**:
  同じ期間への繰り返しリクエストが毎回 DB に問い合わせる。Cache-Control ヘッダーが未設定。
- **期待する修正**:
  1. 完了月（当月以前）のデータには `Cache-Control: private, max-age=3600` を設定
  2. 当月データには `Cache-Control: private, max-age=300` を設定
  3. レスポンスに `Last-Modified` ヘッダーを含める

  **注意**: ダッシュボードメトリクスはロール別にフィルタされたデータを返すため、`public` は使用しないこと。`public` を使うと CDN/プロキシ経由で他ユーザーのデータが共有されるリスクがある。
- **受け入れ基準**:
  - ブラウザキャッシュにより同一期間の再リクエストが削減されること
  - Cache-Control が `private` であること（`public` は不可）

---

### - [ ] TASK-016: PDFスクリーンショットの deviceScaleFactor を調整

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: `src/lib/pdf/generator.ts:155`
- **現状の問題**:
  全スクリーンショットが `deviceScaleFactor: 2` で取得され、メモリ使用量が2倍。
  ```typescript
  await page.setViewport({ width: 1122, height: 793, deviceScaleFactor: 2 });
  ```
- **期待する修正**:
  1. `deviceScaleFactor` を環境変数で設定可能にする（デフォルト: 1.5）
  2. 印刷品質テストを行い、1x と 2x の品質差を評価
  3. メモリ使用量の削減効果を測定
- **受け入れ基準**:
  - PDF の視覚的品質が許容範囲内であること
  - スクリーンショットバッファのメモリ使用量が削減されること

---

### - [ ] TASK-017: チャートコンポーネントに React.memo を適用

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: `src/components/dashboard/impressions-chart.tsx` 等のチャートコンポーネント
- **現状の問題**:
  親コンポーネント（`LocationDashboard`）が再レンダリングされると、データ変更がなくても全チャートが再描画される。
- **期待する修正**:
  1. 各チャートコンポーネントを `React.memo()` でラップ
  2. props のデータオブジェクトを `useMemo` でメモ化
- **受け入れ基準**:
  - React DevTools で不要な再レンダリングが発生しないこと

---

### - [ ] TASK-018: APIレスポンス形式の統一

- **カテゴリ**: コード品質
- **依存**: TASK-021（エラー詳細除去）を包含する。TASK-018 で統一する際に TASK-021 の修正も同時に行うのが効率的
- **ファイル**: `src/app/api/` 配下の全ルート
- **現状の問題**:
  ルートごとにレスポンス形式が異なる:
  - `reports/generate`: `{ error: string }`
  - `hpb/upload`: `{ success: false, error: string, details?: ParseMessage[] }`
  - `dashboard/metrics`: `{ timeSeries, deviceBreakdown, ... }`（成否フラグなし）
- **期待する修正**:
  1. 共通レスポンス型を定義:
  ```typescript
  // src/types/api.ts
  type ApiSuccessResponse<T> = { success: true; data: T };
  type ApiErrorResponse = { success: false; error: string; details?: unknown };
  type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
  ```
  2. 全 API ルートのレスポンスをこの型に統一
  3. エラーレスポンスのステータスコードも統一（400: バリデーション, 401: 未認証, 403: 権限不足, 429: レート制限, 500: サーバーエラー）
- **受け入れ基準**:
  - 全 API ルートが `ApiResponse<T>` 型に準拠すること
  - クライアント側のエラーハンドリングが統一パターンで記述できること

---

### - [ ] TASK-019: ユーティリティ関数の重複解消

- **カテゴリ**: コード品質
- **依存**: なし
- **ファイル**: 複数ファイルに散在
- **現状の問題**:
  以下の関数が複数箇所に重複定義されている:
  - `sleep()` — `src/lib/batch/jobs/daily.ts:74-76` と `src/lib/gbp/client.ts:25-27`
  - 日付ユーティリティ — `src/lib/dashboard/queries.ts:30-33` と `src/components/dashboard/report-dialog.tsx:49-52`
- **期待する修正**:
  1. `src/lib/utils.ts`（既存）に `sleep()` を追加・エクスポート
  2. 日付ユーティリティは `src/lib/dashboard/utils.ts` に集約
  3. 各ファイルの重複定義を共通関数のインポートに置き換え
- **受け入れ基準**:
  - `sleep()` の定義が1箇所のみであること
  - 日付ユーティリティの定義が1箇所のみであること

---

### - [ ] TASK-020: ReportDialog のポーリングロジックをカスタムフックに分離

- **カテゴリ**: コード品質
- **依存**: なし
- **ファイル**: `src/components/dashboard/report-dialog.tsx:60-98`
- **現状の問題**:
  5つの `useState`、ポーリングロジック（3秒間隔）、API 呼出、ファイルダウンロードが1コンポーネントに混在。アンマウント時のクリーンアップにも不安がある。
  ```typescript
  // 現在のコード: setInterval がコンポーネント内に直接定義 (lines 84-98)
  const pollInterval = setInterval(async () => { ... }, 3000);
  ```
- **期待する修正**:
  1. `useReportGeneration()` カスタムフックを作成
  2. ポーリング、生成状態管理、ダウンロード処理をフックに移動
  3. `useEffect` の cleanup でインターバルを確実にクリア
- **受け入れ基準**:
  - `ReportDialog` のコンポーネント本体がUI記述のみになること
  - アンマウント時にポーリングが停止すること

---

### - [ ] TASK-021: APIエラーレスポンスからDB詳細を除去

- **カテゴリ**: セキュリティ
- **依存**: TASK-018（APIレスポンス統一）と同時に実施するのが効率的。単独で先行実施も可能
- **ファイル**: `src/app/api/hpb/upload/route.ts:202` 等
- **現状の問題**:
  Supabase のエラーメッセージがクライアントに直接返却されている:
  ```typescript
  error: `データの保存に失敗しました: ${upsertError.message}`
  ```
  スキーマ情報やSQL構造が漏洩するリスクがある。
- **期待する修正**:
  1. 詳細エラーはサーバーログにのみ出力
  2. クライアントには汎用エラーメッセージを返却
  ```typescript
  console.error("[HPB Upload] Upsert error:", upsertError);
  return NextResponse.json({ success: false, error: "データの保存に失敗しました" }, { status: 500 });
  ```
- **受け入れ基準**:
  - API レスポンスに Supabase/PostgreSQL のエラー詳細が含まれないこと

---

### - [ ] TASK-022: 機密操作の監査ログ実装

- **カテゴリ**: セキュリティ / 運用
- **依存**: なし（テーブル作成が先。TASK-001 のトークン監査記録はこのタスク完了後に追加）
- **ファイル**: `src/app/api/oauth/google/disconnect/route.ts` 等
- **現状の問題**:
  OAuth 接続/切断、トークンリフレッシュ等のセキュリティ操作が `console.error` にのみ記録され、DB 監査テーブルがない。
- **期待する修正**:
  1. `audit_logs` テーブルを作成（`user_id`, `action`, `resource`, `details`, `ip_address`, `created_at`）
  2. 以下の操作を記録:
     - OAuth 接続 / 切断
     - トークンリフレッシュ（成功/失敗）
     - ユーザー作成 / 削除 / ロール変更
     - レポート生成
- **受け入れ基準**:
  - 上記操作が `audit_logs` テーブルに記録されること
  - 管理画面から監査ログを閲覧できること（将来的に）

---

### - [ ] TASK-023: バッチジョブのサーキットブレーカーとデッドレターキュー

- **カテゴリ**: 信頼性
- **依存**: TASK-006（並列化）完了後に実施推奨。並列化とサーキットブレーカーを同時に変更すると検証が困難になるため
- **ファイル**: `batch/src/scheduler.ts`, `src/lib/batch/jobs/daily.ts`
- **現状の問題**:
  - 毎日失敗するロケーション（無効な `gbp_location_id` 等）が無限にリトライされ続ける
  - 失敗ロケーションの追跡やエスカレーション機能がない
- **期待する修正**:
  1. `location_batch_status` テーブルを作成（`location_id`, `consecutive_failures`, `last_error`, `disabled_at`）
  2. 連続3回失敗したロケーションを自動無効化
  3. 無効化されたロケーションを管理画面で確認・再有効化できるようにする
- **受け入れ基準**:
  - 連続失敗ロケーションが自動的にスキップされること
  - 管理者に通知されること（ログまたはダッシュボード表示）

---

### - [ ] TASK-024: ヘルスチェックの強化

- **カテゴリ**: 信頼性 / 運用
- **依存**: なし
- **ファイル**: `batch/src/services/health.ts`
- **現状の問題**:
  バッチワーカーのヘルスチェックがプロセス生存のみを確認。DB 接続、OAuth トークン有効性、最終実行時刻を検証しない。
- **期待する修正**:
  ヘルスチェックレスポンスに以下を追加:
  ```json
  {
    "status": "healthy",
    "checks": {
      "database": { "status": "ok", "latency_ms": 12 },
      "oauth_token": { "status": "ok", "expires_in_hours": 23 },
      "last_daily_run": { "status": "ok", "completed_at": "2026-02-18T09:00:00Z" },
      "last_monthly_run": { "status": "ok", "completed_at": "2026-02-01T09:00:00Z" }
    }
  }
  ```
- **受け入れ基準**:
  - ヘルスエンドポイントがDB接続を検証すること
  - DB 未接続時に `"status": "unhealthy"` を返すこと

---

### - [ ] TASK-025: rating_snapshots テーブルのインデックス確認・追加

- **カテゴリ**: パフォーマンス
- **依存**: なし
- **ファイル**: Supabase マイグレーション
- **現状の問題**:
  `queries.ts:274-290` で `rating_snapshots` に `.lte("date", ...)` + `.order("date")` クエリを実行しているが、`(location_id, date)` 複合インデックスの存在が不明。
- **期待する修正**:
  1. 既存インデックスを確認
  2. 必要に応じて以下を作成:
  ```sql
  CREATE INDEX IF NOT EXISTS idx_rating_snapshots_location_date
    ON rating_snapshots(location_id, date DESC);
  ```
- **受け入れ基準**:
  - `EXPLAIN ANALYZE` でインデックスが使用されていること

---

## P3: Low

### - [ ] TASK-026: Content Security Policy (CSP) の設定

- **カテゴリ**: セキュリティ
- **依存**: TASK-010（セキュリティヘッダー）完了後に同じ `headers()` 関数内に追加するのが効率的
- **ファイル**: `next.config.ts`
- **現状の問題**:
  CSP ヘッダーが未設定。レポートページでユーザー制御データ（店舗名等）が描画される。
- **期待する修正**:
  適切な CSP ポリシーを設定。Recharts（inline SVG）や Supabase SDK のドメインを許可リストに追加。
- **受け入れ基準**:
  - CSP ヘッダーが設定されていること
  - 既存機能（チャート表示、Supabase 通信）が正常に動作すること

---

### - [ ] TASK-027: 構造化ロギングの導入

- **カテゴリ**: コード品質 / 運用
- **依存**: なし（ただし広範囲のため、他タスクと並行せず単独で実施推奨）
- **ファイル**: コードベース全体
- **現状の問題**:
  全ログが `console.log/error/warn` で出力され、構造化されていない。相関 ID がなく、リクエスト追跡が困難。ログプレフィックスも `[DailyJob]`, `[Main]`, `[GBP Client]` と不統一。
- **期待する修正**:
  1. `pino` 等の構造化ロガーを導入
  2. 共通ロガーファクトリを作成（`createLogger("batch:daily")` 等）
  3. リクエスト ID の伝播（バッチジョブ単位、API リクエスト単位）
- **受け入れ基準**:
  - ログが JSON 形式で出力されること
  - リクエスト/ジョブ単位で追跡可能であること

---

### - [ ] TASK-028: React Suspense / Streaming の導入

- **カテゴリ**: パフォーマンス / UX
- **依存**: TASK-007（クエリ並列化）完了後に実施推奨。クエリ構造が変わった後に Suspense 境界を設計する方が効率的
- **ファイル**: `src/app/(dashboard)/dashboard/` 配下のページ
- **現状の問題**:
  全クエリ完了まで画面が空白。`Promise.all()` で並列化しても、最も遅いクエリに律速される。
- **期待する修正**:
  1. ヘッダー・サイドバーは即座に表示
  2. KPI カード、チャート、テーブルを個別の `<Suspense>` 境界で囲む
  3. 各セクションに `loading.tsx` または Skeleton UI を配置
- **受け入れ基準**:
  - First Contentful Paint が改善されること
  - データ読み込み中に Skeleton が表示されること

---

### - [ ] TASK-029: 環境変数の起動時バリデーション強化

- **カテゴリ**: 信頼性
- **依存**: なし
- **ファイル**: `batch/src/lib/config.ts`, Web アプリ起動時
- **現状の問題**:
  環境変数の存在チェックのみで、形式バリデーションがない:
  - `GOOGLE_TOKEN_ENCRYPTION_KEY` の長さ（64 hex chars 必要）
  - `NEXT_PUBLIC_SUPABASE_URL` の URL 形式
  - cron 式の構文
  - ポート番号の範囲
- **期待する修正**:
  `zod` スキーマで環境変数をバリデーション:
  ```typescript
  const envSchema = z.object({
    GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/i),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    HEALTH_PORT: z.coerce.number().int().min(1024).max(65535).default(3001),
  });
  ```
- **受け入れ基準**:
  - 不正な環境変数で起動時に明確なエラーメッセージが表示されること

---

### - [ ] TASK-030: ダイアログコンポーネントの共通化

- **カテゴリ**: コード品質
- **依存**: なし
- **ファイル**: `src/components/admin/user-invite-dialog.tsx`, `src/components/admin/user-edit-dialog.tsx`
- **現状の問題**:
  `toggleOrg` 関数、組織選択UI、フォームリセットロジックが両コンポーネントで同一実装。
- **期待する修正**:
  1. `useOrgSelection()` カスタムフックを作成（`toggleOrg`, `selectedOrgs`, `resetSelection`）
  2. 共通 UI 部分をコンポーネント化（`OrgSelector`）
- **受け入れ基準**:
  - 重複コードが解消されること
  - 既存の動作が維持されること

---

## ポジティブ所見

以下のプラクティスは品質が高く、維持すべき:

| 領域 | 内容 |
|------|------|
| TypeScript | `any` 型の使用ゼロ、判別共用体の適切な活用 |
| 暗号化 | OAuth トークンの AES-256-GCM 暗号化がDB保存前に適用 |
| RLS | 全テーブルで Row Level Security が有効 |
| 認証ガード | `getSession()` → `requireAuth()` → `requireRole()` の明確な階層構造 |
| コード構造 | 循環依存なし、デッドコードなし、インポートエイリアス統一 |
| GBP クライアント | 指数バックオフリトライ、401時の自動トークンリフレッシュ実装済み |
| グレースフルシャットダウン | バッチワーカーが SIGTERM/SIGINT を適切にハンドリング（最大60秒待機） |
| Cookie セキュリティ | HTTPOnly, SameSite=Lax, Secure（本番環境）フラグ適用済み |
