# 複数プレイリスト計画書 アーキテクトレビュー（Claude Opus）

レビュー日: 2026-03-18
対象: `docs/plans/multi-playlist-plan.md` v1.0.0
レビュアー: Claude Opus 4.6 (Architect)

---

## Pass 1: CRITICAL

### [C-001] GET /api/playlist の既存SQLが複数行返却し Sync Agent を壊す

- **場所**: セクション 4.2 (既存エンドポイントの変更)、および既存コード `cloud-admin/src/app/api/playlist/route.ts`
- **問題**: 現在の `GET /api/playlist` の SQL は `SELECT ... FROM playlists WHERE device_id = ?` であり、`LIMIT 1` も `is_active` フィルタも付いていない。マイグレーション適用後、同一 device_id に複数プレイリストが存在する状態になると、**この SQL が複数行を返す**。現在のコードは `playlistResult.rows[0]` で先頭行だけを取り出しているため即座にエラーにはならないが、**どの行が返るかは不定（SQLite は ORDER BY なしの行順序を保証しない）**。つまりアクティブでないプレイリストが Sync Agent に配信される可能性がある。

  計画書セクション 4.2 では「SQL を変更する」と記載があるが、**BE-3 ステップの実装よりも前にマイグレーション（BE-1）が適用される**。BE-1 適用後 BE-3 完了までの間、本番環境の Sync Agent が不正なプレイリストを取得するリスクがある。

- **修正案**:
  1. マイグレーションと `GET /api/playlist` の SQL 変更を **同一デプロイで原子的に適用** すること。BE-1 と BE-3 を分離せず、1回のデプロイにまとめる。
  2. または、マイグレーション SQL の Step 3 (`UPDATE playlists SET is_active = 1`) の直後に、既存 SQL が `is_active = 1` のレコードを返すことを保証するため、SQL 変更を先にデプロイしておく（`WHERE is_active = 1` を追加したコードを先にリリースし、その後にマイグレーションを適用する。`is_active` カラムが存在しない状態では `WHERE is_active = 1` がエラーになるため、**カラム追加 + SQL 変更を同一デプロイ**にするのが最も安全）。

### [C-002] 既存コード items/route.ts の playlist 解決ロジックが壊れる

- **場所**: セクション 4.4 (既存 items / settings / reorder API の変更)、および既存コード `cloud-admin/src/app/api/playlist/items/route.ts` 43行目
- **問題**: `POST /api/playlist/items` の現在の SQL は `SELECT id, store_id FROM playlists WHERE device_id = ?` であり、複数プレイリスト環境では複数行が返る。`playlistResult.rows[0]` で先頭行を取得するため、**非アクティブプレイリストに対してアイテムが追加される可能性がある**。

  計画書では「`playlistId` を受け取れるようにする（指定なし時は `deviceId` からアクティブを解決する後方互換維持）」と記載しているが、**現在の `usePlaylistEditor.ts` の `addItem` 関数は `playlistId` を送信していない**（59行目: `deviceId: DEVICE_ID` のみ）。つまり FE 側の hook 拡張（FE-2）が完了する前にマイグレーションが適用されると、管理画面からのアイテム追加がランダムなプレイリストに対して行われる。

- **修正案**:
  1. `items/route.ts` の SQL を `WHERE device_id = ? AND is_active = 1` に変更する処理を、マイグレーションと同一デプロイに含めること。
  2. 同様に `settings/route.ts` の `WHERE device_id = ?` も `WHERE device_id = ? AND is_active = 1` に変更すること（75行目）。
  3. `reorder/route.ts` は既に `playlistId` ベースなので変更不要。

### [C-003] settings/route.ts の `UPDATE playlists SET ... WHERE device_id = ?` が全プレイリストを更新する

- **場所**: セクション 4.4、および既存コード `cloud-admin/src/app/api/playlist/settings/route.ts` 74-76行目
- **問題**: 現在の `PUT /api/playlist/settings` は `WHERE device_id = ?` で UPDATE を実行する。複数プレイリスト環境では、**同一 device_id の全プレイリストの設定（fade_duration_ms, interval_ms, orientation）が一括更新されてしまう**。計画書では「`playlistId` を受け取れるよう拡張」と記載しているが、このバグの深刻度と修正の優先度が明記されていない。

- **修正案**:
  1. エラー＆レスキューマップに本ケースを追加する。
  2. BE-7 ステップ（items / settings / reorder の playlistId 対応）を BE-1 マイグレーションと同一デプロイで実施するか、少なくとも `WHERE device_id = ?` を `WHERE device_id = ? AND is_active = 1` にフォールバックする修正をマイグレーションと同時に行うこと。

### [C-004] アクティブ切替時の version 更新が未確定（Sync Agent との連携が不成立になる可能性）

- **場所**: セクション 6 (Sync Agent 変更)、セクション 8.3 MP-EC-04、付録 未確定事項 2
- **問題**: 計画書内で矛盾がある。
  - セクション 6: 「アクティブになったプレイリストの `version` が更新されることで、次回ポーリング時に Sync Agent が変更を検知」
  - セクション 8.3 MP-EC-04: 「本計画書では『更新しない』を採用」
  - 付録 未確定事項 2: 「本計画書では『更新する』を推奨」

  **3箇所で結論が矛盾している**。version を更新しない場合、アクティブ切替後に Sync Agent がいつまでも旧プレイリストを配信し続けるシナリオが発生する。具体的には、プレイリスト A（version: v_100）がアクティブ、プレイリスト B（version: v_90、以前に編集済み）に切替えた場合、Sync Agent が保持する localVersion が v_100 であり、B の version v_90 は「古い」ため、`localVersion === playlist.version` が false となり同期は発生するものの、**version が古い方向に変わったことでキャッシュ比較ロジックが正しく動作しない可能性**がある（version の大小比較ではなく完全一致比較なので、この場合は動作するが、意図が不明確）。

- **修正案**:
  1. 「更新する」に確定し、3箇所の矛盾を解消すること。
  2. `PUT /api/playlists/[id]/activate` のトランザクション内で、切替先プレイリストの version を `generateVersion()` で更新する処理を明記すること。
  3. MP-EC-04 のテストケースも「version が更新される」に修正すること。

### [C-005] SQLite の ON DELETE CASCADE が PRAGMA foreign_keys = ON なしでは動作しない

- **場所**: セクション 4.3 DELETE /api/playlists/[id]
- **問題**: 計画書ではプレイリスト削除時に `playlist_items` が `ON DELETE CASCADE` で連鎖削除されると記載しているが、**SQLite（および Turso/libSQL）はデフォルトで外部キー制約が無効**である。`PRAGMA foreign_keys = ON` をセッションごとに実行するか、libSQL クライアントの接続設定で有効化する必要がある。

  現在のコードベースに `PRAGMA foreign_keys` の設定が見当たらない。既存の `playlist_items` テーブルも `ON DELETE CASCADE` を定義しているが、実際には機能していない可能性がある（現在は単一プレイリストなので問題が顕在化していないだけ）。

- **修正案**:
  1. libSQL クライアント初期化時に `PRAGMA foreign_keys = ON` を実行するか、Turso の設定で外部キー制約を有効化すること。
  2. または、CASCADE に依存せず、削除 API のロジック内で明示的に `DELETE FROM playlist_items WHERE playlist_id = ?` を実行した後にプレイリストを削除する（`db.batch()` でトランザクション化）。
  3. いずれの方法を採用するかを計画書に明記すること。

### [C-006] 既存テスト playlist.test.ts のモックデータが壊れる

- **場所**: セクション 10.1 BE-3
- **問題**: 既存テスト `cloud-admin/src/__tests__/api/playlist.test.ts` および `cloud-admin/src/__tests__/lib/playlist.test.ts` の `buildDbRows` 関数は、`playlists` テーブルの SELECT が 7 カラム（id, device_id, store_id, version, orientation, fade_duration_ms, interval_ms）を返す前提でモックデータを構築している。

  `GET /api/playlist` の SQL を `is_active = 1` フィルタ付きに変更し、SELECT カラムに `name` や `is_active` を追加する場合、**モックデータのカラム数・順序が変わり、既存テストが全て壊れる**。計画書では「141件の既存テストとの整合性」を付録の未確定事項として挙げているが、具体的な対応策が不足している。

- **修正案**:
  1. BE-3 の実装ステップに「既存テストのモックデータ更新」を明示的に含めること。
  2. `getPlaylist()` を `getActivePlaylist()` にリネームする際、既存テストの `getPlaylist` 参照も全て更新する必要がある旨を記載すること。
  3. SELECT のカラムリストを変更せず、WHERE 条件の追加だけにとどめることで既存テストへの影響を最小化するアプローチも検討すること（推奨）。

### [C-007] UNIQUE(device_id) 制約の削除方法が不完全

- **場所**: セクション 2.2 マイグレーション SQL の Step 4 コメント
- **問題**: 計画書では「既存の UNIQUE(device_id) 制約は SQLite では DROP できない」「アプリ側ロジックで最大3件 + アクティブ1件を強制する」と記載しているが、**UNIQUE(device_id) 制約が残ったままでは、2つ目のプレイリストの INSERT が UNIQUE 制約違反で失敗する**。マイグレーション SQL にはこの制約の削除処理が含まれていない。

  SQLite で既存の UNIQUE 制約を削除するには、テーブルを再作成する必要がある（CREATE TABLE new → INSERT INTO new SELECT * FROM old → DROP old → ALTER TABLE new RENAME TO old）。計画書のコメントでこの問題を認識しているにもかかわらず、具体的な解決策が記載されていない。

- **修正案**:
  1. マイグレーション SQL にテーブル再作成方式を追加する。具体的には:
  ```sql
  -- Step 4: UNIQUE(device_id) を削除するためテーブル再作成
  CREATE TABLE playlists_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id       TEXT NOT NULL REFERENCES devices(id),
    store_id        TEXT NOT NULL REFERENCES stores(id),
    name            TEXT NOT NULL DEFAULT '通常',
    is_active       INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
    version         TEXT NOT NULL DEFAULT 'v_0',
    orientation     TEXT NOT NULL DEFAULT 'portrait' CHECK (orientation IN ('portrait','landscape')),
    fade_duration_ms INTEGER NOT NULL DEFAULT 2000,
    interval_ms     INTEGER NOT NULL DEFAULT 10000,
    updated_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );
  INSERT INTO playlists_new (id, device_id, store_id, name, is_active, version, orientation, fade_duration_ms, interval_ms, updated_at)
    SELECT id, device_id, store_id, '通常', 1, version, orientation, fade_duration_ms, interval_ms, updated_at FROM playlists;
  DROP TABLE playlists;
  ALTER TABLE playlists_new RENAME TO playlists;
  ```
  2. テーブル再作成後に Partial Index とその他のインデックスを作成する順序に修正すること。
  3. **注意**: テーブル再作成により `playlist_items` の外部キー参照が壊れる可能性がある。`PRAGMA foreign_keys = OFF` を設定してから再作成し、完了後に `PRAGMA foreign_key_check` で整合性を検証すること。

---

## Pass 2: INFORMATIONAL

### [I-001] API URL 設計: /api/playlist と /api/playlists の共存

- **場所**: セクション 4.1 エンドポイント一覧
- **指摘**: 単数形 `/api/playlist` と複数形 `/api/playlists` が混在している。REST の慣例では複数形に統一するのが一般的。現状の設計では:
  - `/api/playlist?device_id=` (単数形) = Sync Agent 向け後方互換
  - `/api/playlists?device_id=` (複数形) = 新規一覧 API
  - `/api/playlists/[id]/activate` (複数形) = 新規操作

  後方互換のために `/api/playlist` を残す判断は妥当だが、将来的に混乱を招く可能性がある。
- **推奨対応**: 計画書にURL設計の命名規則と、将来的な `/api/playlist` の非推奨化（deprecation）方針を記載すること。対応は任意。

### [I-002] フロントエンドの DEVICE_ID ハードコード

- **場所**: セクション 5.2、既存コード `usePlaylistEditor.ts` 13行目
- **指摘**: 現在 `DEVICE_ID = 'device_kyokomachi_01'` がハードコードされている。複数プレイリスト機能追加に伴い hook に多数の新機能を追加するが、このハードコードは将来の複数デバイス対応の妨げになる。
- **推奨対応**: 本計画のスコープ外だが、`DEVICE_ID` を hook の引数またはコンテキストから受け取る設計への移行を将来タスクとして記録すること。

### [I-003] CreatePlaylistRequest に storeId が不足

- **場所**: セクション 3.1 型定義、セクション 4.3 POST /api/playlists
- **指摘**: `CreatePlaylistRequest` は `deviceId` と `name` のみだが、プレイリスト作成時に `store_id` カラムへの値の設定が必要。計画書では `deviceId` から既存プレイリストを参照して `store_id` を解決する前提と思われるが、その解決ロジックが明記されていない。
- **推奨対応**: POST /api/playlists の処理フローに「deviceId から devices テーブルを参照して store_id を取得する」ステップを明記すること。

### [I-004] テストケースの不足: 並行アクティブ切替のレースコンディション

- **場所**: セクション 8.3 エッジケース
- **指摘**: 複数ブラウザタブから同時にアクティブ切替を実行した場合のテストケースが不足している。`db.batch()` によるトランザクションが Turso のレベルで直列化されるかの確認が必要。
- **推奨対応**: MP-EC テストに「並行アクティブ切替リクエスト時に is_active=1 が常に1件のみであること」のテストケースを追加すること。

### [I-005] アクティブ切替 API の device_id 検証方法

- **場所**: セクション 4.3 PUT /api/playlists/[id]/activate
- **指摘**: activate エンドポイントのリクエストボディは空で、ID は URL パスから取得する。しかし、「同一 device_id のすべてのプレイリストを is_active = 0 に設定」するには device_id が必要。計画書では device_id の取得方法が明記されていない（指定 ID のプレイリストから device_id を逆引きする？クエリパラメータで渡す？）。
- **推奨対応**: activate API の処理フローを以下のように明記すること:
  1. playlist_id でプレイリストを取得し、device_id を得る
  2. その device_id の全プレイリストを is_active = 0 に
  3. 指定プレイリストを is_active = 1 に
  4. 上記をトランザクションで実行

### [I-006] DELETE /api/playlists/[id] の device_id 検証

- **場所**: セクション 4.3 DELETE /api/playlists/[id]
- **指摘**: 削除 API のリクエストに device_id の指定方法が不明。プレイリスト ID のみでの削除を許可すると、認証済みユーザーが任意のプレイリストを削除できてしまう（現在は単一テナントなので問題にならないが、将来の複数テナント対応時にリスク）。
- **推奨対応**: 削除・更新系 API にも device_id のクロスチェックを含めるか、将来の認可設計方針を記載すること。

### [I-007] パフォーマンス: プレイリスト一覧取得時の itemCount サブクエリ

- **場所**: セクション 4.3 GET /api/playlists
- **指摘**: `PlaylistSummary` に `itemCount` フィールドがある。これを取得するには各プレイリストに対して `COUNT(*) FROM playlist_items WHERE playlist_id = ?` のサブクエリが必要。最大3プレイリストなので性能問題にはならないが、SQL の具体的な実装（JOIN vs サブクエリ vs 個別クエリ）が計画書に記載されていない。
- **推奨対応**: 以下のような単一クエリでの取得を推奨:
  ```sql
  SELECT p.id, p.name, p.is_active, p.version, p.updated_at,
         COUNT(pi.id) as item_count
  FROM playlists p
  LEFT JOIN playlist_items pi ON pi.playlist_id = p.id
  WHERE p.device_id = ?
  GROUP BY p.id
  ```

### [I-008] プレイリスト名のバリデーション詳細

- **場所**: セクション 8.2 MP-E-06, MP-E-07
- **指摘**: 名前のバリデーションは「空文字 NG」「51文字以上 NG」だが、以下のケースが未定義:
  - 空白のみの文字列（"   "）
  - 制御文字を含む文字列
  - 先頭・末尾の空白のトリム
  - PUT /api/playlists/[id] (名前変更) でも同じバリデーションが必要
- **推奨対応**: バリデーションルールを「1文字以上50文字以下、trim() 後に適用、制御文字は除去」等、具体的に定義すること。

### [I-009] usePlaylistEditor hook の選択プレイリスト初期化

- **場所**: セクション 5.2
- **指摘**: `selectedPlaylistId` の初期値が `null` と定義されているが、画面読み込み時にどのプレイリストを初期選択するかのロジックが不明。アクティブプレイリストを初期選択するのが自然だが、明記されていない。
- **推奨対応**: `fetchPlaylists()` 完了後に `isActive: true` のプレイリストを `selectedPlaylistId` に設定するフローを明記すること。

### [I-010] reorder API の後方互換が不足

- **場所**: セクション 4.4
- **指摘**: 計画書では items / settings の `playlistId` 対応を記載しているが、`POST /api/playlist/reorder` は既に `playlistId` ベースで動作している（既存コード確認済み）。一方、`usePlaylistEditor.ts` の `reorderItems` は `deviceId: DEVICE_ID` を送信しており、`playlistId` を送信していない。計画書では reorder API の変更は「playlistId を受け取れるように拡張」と記載しているが、**既に playlistId のみを受け取る設計に変更済み**。
- **推奨対応**: 現在の実装状態を正確に反映するよう計画書を修正すること。reorder API は変更不要、FE の hook が playlistId を送信するように修正する旨を記載。

---

## サマリ

- **CRITICAL**: 7件
- **INFORMATIONAL**: 10件
- **総合評価**: **条件付き承認**

### 条件

以下の CRITICAL 項目が修正されるまで実装に着手しないこと:

1. **[C-001] + [C-002] + [C-003]**: マイグレーションと既存 SQL の変更を同一デプロイにまとめること。「BE-1 マイグレーション」と「BE-3 既存エンドポイント改修」「BE-7 既存 API の playlistId 対応」を分離しないデプロイ戦略に修正する。
2. **[C-004]**: version 更新の方針を「更新する」に確定し、計画書内の3箇所の矛盾を解消する。
3. **[C-005]**: ON DELETE CASCADE の前提条件（PRAGMA foreign_keys）を確認し、対応策を明記する。
4. **[C-007]**: UNIQUE(device_id) 制約削除のためのテーブル再作成 SQL を計画書に追加する。現在のマイグレーション SQL では2つ目のプレイリストが作成できない。

### 良い点

- Sync Agent / Local Viewer を変更なしに保つ後方互換設計は妥当
- `db.batch()` によるトランザクション設計は適切
- Partial Index による DB レベルのアクティブ一意性担保は堅実
- テストケースの網羅性は高い（正常系・異常系・エッジケースの3層構造）
- エラー&レスキューマップが充実している
