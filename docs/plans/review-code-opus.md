# コードレビュー（Claude Opus）

レビュー日: 2026-03-17
対象: Module A, B, C 本番コード

---

## Pass 1: CRITICAL

### [C-001] Sync Agent メインループに差分検知・ダウンロード・ハッシュ検証・クリーンアップの統合が未実装
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/index.ts`:74-81
- **問題**: `main()` 関数内の `syncFn` は `fetchPlaylist()` を呼んでログを出力するだけで、仕様 C-02（差分検知）、C-03（アトミックダウンロード）、C-04（ハッシュ検証）、C-05（クリーンアップ）、C-07（playlist.json更新）の統合処理が一切実装されていない。`fileManager.ts`、`hashVerifier.ts`、`cleaner.ts` のモジュールは存在するが、メインループから呼び出されておらず、実質的にデッドコードである。これはシステム全体の同期機能が動作しないことを意味する。
- **修正案**: `syncFn` 内に以下のフローを実装する:
  1. `fetchPlaylist()` で API からプレイリスト取得
  2. ローカル `playlist.json` の version と比較（差分検知）
  3. 差分がある場合、各 item について tmp/ へダウンロード → `verifyHash()` でハッシュ検証 → `moveFile()` で images/ へ移動
  4. 全 item 完了後に `writePlaylistJson()` でアトミック置換
  5. `cleanupOldFiles()` で不要ファイル削除

### [C-002] Sync Agent に画像ダウンロード機能が存在しない
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/fetcher.ts`
- **問題**: `fetcher.ts` には API からプレイリスト JSON を取得する `fetchPlaylist()` のみが実装されている。仕様 C-03 で要求されている画像/PDFファイルのダウンロード機能（120秒タイムアウト、AbortController 制御）が存在しない。R2 からファイルを取得する手段がないため、同期機能が根本的に動作しない。
- **修正案**: `fetcher.ts` に `downloadFile(url: string, destPath: string): Promise<void>` を追加。120秒の AbortController タイムアウト、ストリーミング書き込み（`response.body.pipe` or `Readable.fromWeb`）、エラー時の tmp ファイルクリーンアップを実装する。

### [C-003] Sync Agent playlist.json の URL ローカルパス変換が未実装
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/fileManager.ts`
- **問題**: 仕様 Section 3.3 では、Sync Agent が playlist.json を書き込む際に `items[].url` を R2 の URL からローカルパス（`/data/images/{id}.{ext}`）に変換する必要がある。現在の `writePlaylistJson()` は `playlistData` をそのまま JSON シリアライズしており、URL 変換ロジックが存在しない。Local Viewer はローカルパスしか参照しないため、この未実装によりファイルが読み込めない。
- **修正案**: `writePlaylistJson()` 内で、各 item の `url` を `R2 URL` から `/data/images/{id}.{ext}` に変換してから書き込む。または別途変換関数を用意する。

### [C-004] Upload API の認証チェック順序が不適切（バリデーション後に認証）
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/app/api/upload/route.ts`:24-63
- **問題**: `POST /api/upload` では、リクエストボディのバリデーション（filename, contentType, fileSize チェック）を全て実行した後に `checkAuth()` を呼んでいる（58行目）。認証されていないユーザーに対して、ファイルサイズ超過やフォーマットエラーなどの具体的なエラー情報を返してしまう。セキュリティのベストプラクティスでは、認証チェックを最初に行うべき。
- **修正案**: `checkAuth(request)` を `body = await request.json()` の直前（JSON パース前）に移動する。認証失敗時は即座に 401 を返す。

### [C-005] Upload API の checkAuth が ADMIN_API_KEY 未設定時に認証をスキップする
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/app/api/upload/route.ts`:13-22
- **問題**: `checkAuth()` 関数は `ADMIN_API_KEY` 環境変数が未設定の場合に `return true` としている。コメントには "development mode" とあるが、Vercel にデプロイ後に環境変数の設定漏れがあった場合、全ての書き込み操作が認証なしで実行可能になる。本番環境での「サイレント障害」に該当する。
- **修正案**: 環境変数未設定時は `return false`（デフォルト拒否）にするか、`NODE_ENV === 'development'` の場合のみスキップするガードを追加する。少なくとも警告ログを出力する。

### [C-006] Playlist操作API（playlist/route.ts）に認証チェックが実装されていない
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/app/api/playlist/route.ts`
- **問題**: 仕様 B-01 では GET /api/playlist は認証不要だが、このファイルには GET のみが実装されている。仕様 B-03〜B-07 で要求されている POST/PUT/DELETE エンドポイント（アイテム追加、設定変更、並び替え、削除）の API ルートファイルが見当たらない。`playlist.ts` にビジネスロジック（`addPlaylistItem`, `deletePlaylistItem`, `reorderPlaylistItems`）は存在するが、それを呼び出す API ルートが未実装。
- **修正案**: 以下のルートファイルを実装する:
  - `src/app/api/playlist/items/route.ts` (POST)
  - `src/app/api/playlist/items/[id]/route.ts` (PUT, DELETE)
  - `src/app/api/playlist/settings/route.ts` (PUT)
  - `src/app/api/playlist/reorder/route.ts` (POST)
  各エンドポイントに `checkAuth()` を含める。

### [C-007] Player.tsx の PDF スライドが canvas のまま放置されている（描画未実装）
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/components/Slide.tsx`:32-33
- **問題**: PDF タイプのスライドでは `<canvas className="fg-image" />` が返されるが、pdf.js による描画処理が一切接続されていない。`pdfLoader.ts` は BlobURL を返す設計だが、Slide コンポーネントからは呼び出されておらず、空の canvas が表示されるだけになる。仕様 A-06（PDF展開表示）が機能しない。
- **修正案**: PDF スライドの処理フローを実装する。選択肢は2つ:
  1. `pdfLoader.ts` で生成した BlobURL を `<img>` の src として使う（既存の BlobURL 方式と整合）
  2. Player レベルで PDF アイテムを検出し、`loadPdfAsSlides()` で展開した結果を複数の image スライドとして items に注入する

### [C-008] Player.tsx の PDF スライドで背景ぼかしが機能しない
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/components/Slide.tsx`:25-28
- **問題**: 背景レイヤー（`.bg-blur`）は `backgroundImage: url(item.url)` を使用している。PDF ファイルの URL を CSS の `background-image` に指定してもブラウザは表示できないため、PDF スライドでは背景ぼかしが機能しない。仕様 A-01（パターンC）が PDF スライドで崩れる。
- **修正案**: PDF スライドの場合は、`pdfLoader.ts` で生成した BlobURL（画像化済み）を背景にも適用する。

### [C-009] DB操作でトランザクションが使用されていない
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/lib/playlist.ts`:53-92, 94-104, 106-121
- **問題**: `addPlaylistItem`, `deletePlaylistItem`, `reorderPlaylistItems` の各関数では、データ変更と version 更新が別々の `db.execute()` で実行されており、トランザクションで囲まれていない。特に `reorderPlaylistItems` ではループ内で N+1 回の UPDATE を実行しており、途中で失敗した場合に中途半端な position 状態が残る。
- **修正案**: libSQL の `db.batch()` または `db.transaction()` を使用して、各操作を単一トランザクション内で実行する。特に reorder は batch 処理が必須。

### [C-010] Zustand playerStore が未実装（stub のみ）
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/store/playerStore.ts`
- **問題**: ファイル内容が TODO コメントのみで、Zustand store が実装されていない。仕様では「Zustand store（現在スライドindex、フェード状態）」を使用する設計だが、Player.tsx は useState で独自に状態管理している。設計と実装の乖離があり、将来的に状態の共有や外部からのアクセスが困難になる。
- **修正案**: Player.tsx の状態管理を Zustand store に移行するか、現在の useState ベースの実装が適切と判断するなら設計書を更新する。MVP 段階では useState で動作しているため、優先度は中程度。

---

## Pass 2: INFORMATIONAL

### [I-001] playlist.ts の DB 行アクセスが positional index（unknown[]）で型安全性が低い
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/lib/playlist.ts`:16-23, `/home/noritakasawada/project/wework_signage/cloud-admin/src/app/api/playlist/route.ts`:30-37
- **指摘**: DB の行データを `as unknown[]` にキャストし、`row[0]`, `row[1]` のように positional index でアクセスしている。SELECT のカラム順を変更するとバグが発生しやすく、レビュー時にもカラムの対応を確認しにくい。同じコードが `playlist.ts` と `route.ts` で重複している。
- **推奨対応**: libSQL は `rows` を `Record<string, unknown>` 形式でも返せる（`row.device_id` のようにアクセス可能）。名前付きアクセスに切り替えるか、あるいは `getPlaylist()` 関数を `route.ts` からも呼び出して重複を排除する。

### [I-002] Player.tsx のフェード実装で新スライドの opacity が常に 1
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/components/Player.tsx`:138-156
- **指摘**: `slides.map()` で各スライドをレンダリングする際、`<Slide opacity={1} ... />` と常に opacity=1 を渡している。フェードトランジションは外側の `div.slide-fade` の CSS transition に依存しているが、新しいスライドが追加された時点で opacity=1 が設定されるため、CSS によるフェードイン効果が発生しない可能性がある。正しくフェードさせるには、新スライドの初期 opacity を 0 にして、次のレンダリングサイクルで 1 に変更する必要がある。
- **推奨対応**: slides の各エントリに `opacity` 状態を持たせ、追加時は 0、次の `requestAnimationFrame` または `useEffect` で 1 に切り替える。

### [I-003] pdfLoader.ts で BlobURL のメモリリーク
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/lib/pdfLoader.ts`:34-43
- **指摘**: `URL.createObjectURL(blob)` で生成された BlobURL は、明示的に `URL.revokeObjectURL()` を呼ばないとメモリリークする。長時間稼働するサイネージシステムでは、PDF の再展開が繰り返されるたびに BlobURL が蓄積する。
- **推奨対応**: 返却された BlobURL 配列を消費側で管理し、不要になったタイミングで `URL.revokeObjectURL()` を呼び出す仕組みを追加する。

### [I-004] imagePreloader.ts が Player.tsx から呼び出されていない
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/lib/imagePreloader.ts`
- **指摘**: 仕様 A-04 では「常に現在表示中+次スライドの2枚のみDOMに保持」「プリロード戦略」が要求されているが、`preloadImage()` 関数は Player.tsx から一度も呼び出されていない。次のスライドの画像を事前にキャッシュする仕組みが欠如しており、大容量画像（30MB）の場合にフェード開始時にロードが間に合わない可能性がある。
- **推奨対応**: `scheduleNext()` 内で次のスライドの画像に対して `preloadImage()` を呼び出す。

### [I-005] logger.ts が Sync Agent 内で一貫して使用されていない
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/logger.ts`, `index.ts`, `fetcher.ts`, `fileManager.ts`
- **指摘**: `logger.ts` に `info()`, `warn()`, `error()`, `alert()` のヘルパー関数が定義されているが、`index.ts` と `fetcher.ts` では `console.error(JSON.stringify({...}))` を直接使用しており、logger モジュールがインポートされていない。ログフォーマットの一貫性が損なわれている（logger.ts は `timestamp` フィールドを含むが、直接記述の箇所は含まない）。
- **推奨対応**: 全ての構造化ログ出力を `logger.ts` 経由に統一する。

### [I-006] Slide.tsx の img タグに onError ハンドラがない
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/components/Slide.tsx`:35
- **指摘**: 仕様 A-E-03 では「画像ファイルが存在しない場合、当該スライドをスキップして次スライドに進む」と要求されている。現在の `<img>` タグには `onError` ハンドラが設定されておらず、画像ロードエラー時のスキップロジックが未実装。
- **推奨対応**: `Slide` コンポーネントに `onError` コールバック prop を追加し、Player 側でスキップ処理を実装する。

### [I-007] GET /api/playlist で getPlaylist() を使わず直接 SQL を実行している
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/app/api/playlist/route.ts`
- **指摘**: `playlist.ts` に `getPlaylist(deviceId)` 関数が実装済みだが、`route.ts` では同じ SQL を直接実行しており、コードが完全に重複している。ビジネスロジックの変更時に2箇所の修正が必要になる。
- **推奨対応**: `route.ts` から `getPlaylist()` を呼び出すようにリファクタリングする。

### [I-008] cleaner.ts のファイル削除でエラーがサイレントに無視される
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/cleaner.ts`:29-33
- **指摘**: `unlinkSync()` の catch ブロックが空で、ファイル削除の失敗が完全にサイレントになっている。権限エラーやファイルシステム障害を検知できない。
- **推奨対応**: 少なくとも warn レベルのログを出力する。

### [I-009] r2.ts の fileId 生成で PDF ファイルのプレフィックスが常に "img_"
- **ファイル**: `/home/noritakasawada/project/wework_signage/cloud-admin/src/lib/r2.ts`:28
- **問題**: `fileId = img_${randomUUID()...}` と固定プレフィックス "img_" を使用しているが、仕様では PDF ファイルの場合は "pdf_001" のような ID が例示されている。ファイルタイプに応じたプレフィックス分けがない。
- **推奨対応**: `generatePresignedUrl()` に `fileType` パラメータを追加し、`image` なら `img_`、`pdf` なら `pdf_` のプレフィックスを使う。

### [I-010] usePlaylist.ts で fetch レスポンスの status チェックがない
- **ファイル**: `/home/noritakasawada/project/wework_signage/local-viewer/src/hooks/usePlaylist.ts`:36-37
- **指摘**: `response.ok` のチェックがなく、404 や 500 レスポンスでも `response.json()` を呼び出す。サーバーがエラー JSON を返した場合、それがプレイリストとして解釈される可能性がある。
- **推奨対応**: `if (!response.ok)` のガードを追加し、エラーレスポンスの場合は前回のプレイリストを維持する。

### [I-011] fileManager.ts の cleanupTmpFile でエラーが完全にサイレント
- **ファイル**: `/home/noritakasawada/project/wework_signage/sync-agent/src/fileManager.ts`:22-24
- **指摘**: `cleanupTmpFile()` の catch ブロックが空。tmp ファイルの削除失敗は通常問題にならないが、ディスク容量不足の兆候である可能性がある。
- **推奨対応**: warn レベルのログ出力を追加する。

---

## サマリ

- **CRITICAL: 10件**
  - C-001: メインループ統合未実装（Sync Agent が実質動作しない）
  - C-002: 画像ダウンロード機能なし
  - C-003: URL ローカルパス変換未実装
  - C-004: 認証チェック順序不適切
  - C-005: API Key 未設定時の認証スキップ
  - C-006: 書き込み系 API ルート未実装
  - C-007: PDF 描画未接続
  - C-008: PDF 背景ぼかし不可
  - C-009: DB トランザクション未使用
  - C-010: Zustand store 未実装（stub）

- **INFORMATIONAL: 11件**
  - I-001〜I-011

- **総合評価: 条件付き承認**

### 判定理由

各モジュールの基本構造（ファイル分割、型定義、エラーハンドリングの方針）は仕様に沿っており、設計の方向性は正しい。特に以下の点は良い実装:

- Sync Agent のポーリング設計（並行実行防止、graceful shutdown）
- usePlaylist のキャッシュバスター付き fetch とエラー時のフォールバック
- useKioskExit の Escape キー3回検知ロジック
- fetcher.ts の AbortController タイムアウト実装
- hashVerifier.ts のストリーミングハッシュ計算
- upload/route.ts のファイルサイズ・Content-Type バリデーション

ただし、Sync Agent のメインループ統合（C-001, C-002, C-003）と PDF 表示（C-007, C-008）は仕様の中核機能であり、これらが動作しない状態では結合テストに進めない。C-001〜C-003 の修正を最優先とし、C-004〜C-006 のセキュリティ問題、C-007〜C-008 の PDF 対応を次に対処すること。
