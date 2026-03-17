# 複数プレイリスト計画書 Devil's Advocate レビュー

レビュー日: 2026-03-18
対象: `docs/plans/multi-playlist-plan.md` v1.0.0
先行レビュー: `docs/plans/review-multi-playlist-opus.md`
レビュアー: Claude Opus 4.6 (Devil's Advocate)

---

## 先行レビューの検証

### 先行レビューの見落とし

**1. [C-001/C-002] は正当だが、影響範囲が過小評価されている**

先行レビューは `GET /api/playlist` の route.ts と `POST /api/playlist/items` の items/route.ts が壊れると指摘したが、同様に **`lib/playlist.ts` の `getPlaylist()` 関数**（5行目）も同じ SQL `WHERE device_id = ?` を使っている。route.ts と lib/playlist.ts の両方のクエリを同時に修正する必要がある。先行レビューは route.ts の直接 SQL には言及したが、`lib/playlist.ts` のビジネスロジック層を明示的に指摘していない。

**2. `DELETE /api/playlist/items/[id]` の既存バグを見逃している**

`usePlaylistEditor.ts` の `deleteItem` 関数（78-81行目）は DELETE リクエストに **JSON body を送信していない**。しかし `items/[id]/route.ts` の DELETE ハンドラ（84-100行目）は `playlistId` を body から必須として要求している。これは **計画書以前に存在する既存バグ**であり、現在のフロントエンドからのアイテム削除は 400 エラーになっているはずである。先行レビューはこの不整合を検出していない。複数プレイリスト対応でこのバグが顕在化する。

**3. `reorderItems` と reorder API の不整合が INFORMATIONAL ではなく CRITICAL**

先行レビュー I-010 で指摘されている `reorderItems` の問題は INFORMATIONAL に分類されているが、実態はより深刻である。`usePlaylistEditor.ts` の `reorderItems`（107-113行目）は `deviceId: DEVICE_ID` を送信するが、`reorder/route.ts`（24行目）は `playlistId` を必須としている。`deviceId` は無視され `playlistId` が `undefined` となるため、**現在の reorder API は常に 400 エラーを返す**。これは CRITICAL である。

ただし、テスト（e2e-flow.test.ts）では `playlistId: PLAYLIST_ID` を直接送信してテストしているため（225行目）、テストは通過するがフロントエンド実動作は壊れている可能性がある。

**4. 画像プロキシ API `/api/image` のセキュリティ問題**

先行レビューは `/api/image` route を検証していない。`image/route.ts` は `key` パラメータをそのまま R2 の `GetObjectCommand` に渡している（25-27行目）。`key` のバリデーションが一切ないため、任意の R2 バケットキーにアクセスできる。複数プレイリストでは異なるプレイリストの画像が混在するが、この API にはアクセス制御がなく、任意のキーで他店舗の画像を取得できる可能性がある（R2 バケットが店舗間で共有されている場合）。

**5. `PUT /api/playlist/items/[id]` の playlist_id バリデーション欠如**

`items/[id]/route.ts` の PUT ハンドラ（6-69行目）は `UPDATE playlist_items SET ... WHERE id = ?` を実行しているが、**playlist_id のチェックが一切ない**。つまり、任意の item ID を指定すれば、別のプレイリスト（あるいは別デバイス）に属するアイテムの `durationOverrideMs` や `position` を変更できてしまう。複数プレイリスト環境では、これが実際のセキュリティリスクになる。

### 先行レビューの修正案の問題

**1. [C-007] テーブル再作成方式のリスクが不十分**

先行レビューの修正案（テーブル再作成 SQL）は技術的に正しいが、以下のリスクが不足している:

- **AUTOINCREMENT のシーケンスリセット**: SQLite の AUTOINCREMENT は `sqlite_sequence` テーブルで管理される。テーブル再作成時に `sqlite_sequence` の値が引き継がれるかは明示的な確認が必要。引き継がれない場合、新しいプレイリスト作成時に既存の `playlist_items.playlist_id` と衝突する ID が生成される可能性がある。
- **Turso のレプリケーション中のテーブル再作成**: Turso はエッジレプリカを持つため、テーブル DROP/RENAME のレプリケーション中にリクエストが来た場合の挙動が不明。メンテナンスウィンドウの設定が必要になる可能性がある。

**2. [C-004] version 更新を「する」に統一するだけでは不十分**

先行レビューは version を「更新する」に統一する修正案を出しているが、**アクティブ切替時に version を更新すると、Sync Agent のクリーンアップロジック（cleaner.ts）が旧プレイリストの画像を削除する**ことへの言及がない。プレイリスト A（画像 img_001, img_002）からプレイリスト B（画像 img_003, img_004）に切替えた場合、Sync Agent は:
1. 新しい playlist.json を受信
2. img_003, img_004 をダウンロード
3. `cleanupOldFiles` で img_001, img_002 を **削除**

その後、プレイリスト A に戻した場合、img_001, img_002 を再ダウンロードする必要がある。これは意図通りの動作かもしれないが、計画書には明記されていない。頻繁な切替で不要なダウンロード/削除が発生する運用リスクがある。

---

## 追加CRITICAL指摘

### [DA-C-001] Sync Agent のレースコンディション: アクティブ切替中の同期

- **場所**: sync-agent/src/index.ts（84-188行目）、計画書セクション 6
- **問題**: Sync Agent のメインループは以下のステップを非アトミックに実行する:
  1. `fetchPlaylist()` でアクティブプレイリストを取得（Step 1, 86行目）
  2. version 比較（Step 2, 103行目）
  3. 各アイテムのダウンロード（Step 3, 124-173行目）
  4. `writePlaylistJson()` でローカルに書き込み（Step 4, 176行目）
  5. `cleanupOldFiles()` で不要ファイル削除（Step 5, 179行目）

  アクティブ切替が Step 1 と Step 4 の間に発生した場合、**Sync Agent は旧アクティブのプレイリストに基づいて画像をダウンロードし、旧プレイリストの playlist.json を書き込む**。次回ポーリング（最大60秒後）まで、サイネージは旧プレイリストを表示する。

  さらに悪いケースとして、Step 3 のダウンロード中にアクティブが切り替わり、新旧プレイリストの画像が混在した状態で playlist.json が書き込まれることはないが（playlist.json は fetchPlaylist 時点のデータで書き込まれるため）、**切替後の次回ポーリングで新しいプレイリストの全画像をダウンロードし直す必要がある**。

  計画書セクション 6 は「次回ポーリング時（最大1分後）に Sync Agent が変更を検知して新しいコンテンツを配信する」と記載しているが、**最大1分間の旧コンテンツ表示**が許容されるかの明示的な確認が必要。ユーザーが「ワンクリックで即座に切り替える」と期待している場合、1分の遅延は問題になる。

- **修正案**:
  1. 計画書に「アクティブ切替後、サイネージの表示反映には最大60秒の遅延がある」ことを明記する。
  2. ユーザーストーリーの「ワンクリックで切り替え」の期待値を調整するか、Sync Agent のポーリング間隔を短縮するオプションを検討する。
  3. アクティブ切替 API 実行後に Sync Agent へ即時通知（WebSocket / Push）する機構を将来検討事項として記載する。

### [DA-C-002] items/route.ts の playlistId 解決ロジックの不整合

- **場所**: cloud-admin/src/app/api/playlist/items/route.ts（42-57行目）
- **問題**: 現在の `POST /api/playlist/items` は `body.deviceId` から `SELECT id, store_id FROM playlists WHERE device_id = ?` でプレイリストを解決している（43-46行目）。計画書セクション 4.4 では「`playlistId` を受け取れるようにする（指定なし時は `deviceId` からアクティブを解決する後方互換維持）」と記載。

  しかし、**現在のフロントエンド `usePlaylistEditor.ts`（51行目）は `deviceId: DEVICE_ID` のみを送信している**。計画書は FE-2 で hook を拡張するとしているが、FE-2 が完了するまでの間、マイグレーション適用後に items/route.ts が `WHERE device_id = ?` で複数行を返し、先頭行（不定）のプレイリストにアイテムが追加される。

  先行レビュー C-002 でこの問題は指摘されているが、**追加の問題として `body.playlistId` が明示的に送信される場合でも、items/route.ts のコードには `body.playlistId` を受け取るロジックが存在しない**（現在のコードは `body.deviceId` のみ）。つまり BE-7 の実装なしでは FE-2 の `playlistId` 送信は無効になる。BE-7 と FE-2 の完了順序に依存関係があり、これが計画書のステップで明確化されていない。

- **修正案**: BE-7 の優先度を上げ、BE-1 マイグレーションと同一デプロイにすることを計画書に明記する。

### [DA-C-003] deletePlaylistItem のクロスプレイリスト脆弱性

- **場所**: cloud-admin/src/lib/playlist.ts（95-106行目）、cloud-admin/src/app/api/playlist/items/[id]/route.ts（71-113行目）
- **問題**: `deletePlaylistItem(itemId, playlistId)` は `DELETE FROM playlist_items WHERE id = ?` を実行する（98行目）。**playlist_id の WHERE 条件がない**。つまり、`playlistId` パラメータは version 更新にのみ使われ、削除自体は item の ID だけで行われる。

  複数プレイリスト環境では:
  - プレイリスト A の管理画面で「削除」をクリック
  - リクエストに `playlistId: 1`（プレイリスト A の ID）を送信
  - しかし `itemId` がたまたまプレイリスト B のアイテム ID と一致した場合、**プレイリスト B のアイテムが削除される**
  - version はプレイリスト A のみ更新されるため、プレイリスト B の version は変わらず、Sync Agent は削除を検知しない

  現状 item ID は `img_XXX` 形式でグローバルユニークと思われるが、将来的にプレイリスト間で ID が衝突する可能性がある場合、これは深刻なデータ破壊バグになる。

- **修正案**:
  1. `deletePlaylistItem` の SQL を `DELETE FROM playlist_items WHERE id = ? AND playlist_id = ?` に変更する。
  2. 同様に `items/[id]/route.ts` の PUT ハンドラにも `playlist_id` のチェックを追加する。

### [DA-C-004] settings/route.ts が playlistId 指定時でも deviceId 優先で全プレイリスト更新

- **場所**: cloud-admin/src/app/api/playlist/settings/route.ts（72-84行目）
- **問題**: 先行レビュー C-003 は `WHERE device_id = ?` による全プレイリスト更新を指摘したが、**現在のコードには既に `playlistId` を受け取る分岐がある**（32-33行目）。問題は、`deviceId` と `playlistId` の両方が送信された場合、**deviceId が優先される**（72行目の `if (deviceId)` 分岐）。

  `usePlaylistEditor.ts` の `updateSettings`（134-139行目）は常に `deviceId: DEVICE_ID` を送信するため、`playlistId` を追加送信しても `deviceId` が優先され、全プレイリストが更新される。

  つまり、FE-2 で hook を拡張して `playlistId` を送信するようにしても、**既存の settings/route.ts のロジックを変更しない限り、deviceId が存在する限り全プレイリストの設定が一括更新される**。

- **修正案**:
  1. settings/route.ts の優先順位を `playlistId` > `deviceId` に変更する（`playlistId` が指定されている場合はそちらを使用）。
  2. 後方互換のため、`playlistId` 未指定時のみ `deviceId` からアクティブプレイリストを解決する。

---

## 追加INFORMATIONAL指摘

### [DA-I-001] アクティブ切替時の orientation 変更によるディスプレイ表示の崩れ

- **場所**: 計画書セクション 1.1、shared/types.ts
- **問題**: 各プレイリストは独自の `orientation`（portrait / landscape）を持てる。プレイリスト A（portrait）からプレイリスト B（landscape）にアクティブ切替した場合、Sync Agent が新しい playlist.json を書き込み、Local Viewer が `usePlaylist.ts` でそれを検知すると、**画面の向きが即座に切り替わる**。

  物理ディスプレイが portrait 固定で設置されている場合、landscape のプレイリストを配信すると画面が崩れる（あるいは 90 度回転した状態で表示される）。

  計画書ではこのケースに対する警告や制限が記載されていない。

- **推奨対応**: アクティブ切替時に orientation が異なる場合、確認モーダルで「ディスプレイの向きが変わります」旨の追加警告を表示する。または、同一デバイスの全プレイリストで orientation を統一する制約を追加する。

### [DA-I-002] プレイリスト間で同一画像を共有する場合の R2 ストレージ重複

- **場所**: 計画書セクション対象外
- **問題**: プレイリスト A と B で同じ画像（例: ロゴ画像）を使いたい場合、現在の設計では同じ画像を2回アップロードし、2つの R2 オブジェクトと2つの `playlist_items` レコードが作成される。item ID がアップロードごとに異なるため、Sync Agent も同じ画像を2回ダウンロードする。

  最大3プレイリスト x 共通画像で、ストレージ使用量とダウンロード量が最大3倍になる。

- **推奨対応**: 将来検討事項として、画像の hash ベースの重複排除（deduplication）を記載する。短期的には許容範囲（最大3倍）と判断してもよい。

### [DA-I-003] GET /api/playlists の認証不要設計のリスク

- **場所**: 計画書セクション 4.1
- **問題**: `GET /api/playlists?device_id=` は認証不要と定義されている。`device_id` が推測可能な命名規則（`device_kyokomachi_01` など）であるため、第三者が他店舗の `device_id` を推測して以下の情報を取得できる:
  - プレイリスト名（例: 「春メニュー」「裏メニュー」等、ビジネス上センシティブな可能性）
  - アイテム数
  - 更新タイムスタンプ（営業時間の推測に利用可能）
  - どのプレイリストがアクティブか

  現在は単一テナントなのでリスクは低いが、将来の複数テナント対応時に問題になる。

- **推奨対応**: 計画書に「GET /api/playlists は Sync Agent 向けではなく管理画面向けのため、将来的に認証を追加する候補」と記載する。

### [DA-I-004] Local Viewer の usePlaylist.ts がアクティブ切替を30秒間検知しない可能性

- **場所**: local-viewer/src/hooks/usePlaylist.ts（4行目、40行目）
- **問題**: Local Viewer は playlist.json を30秒間隔（`FETCH_INTERVAL_MS = 30000`）でポーリングし、`version` が変化した場合のみ state を更新する（40行目）。

  アクティブ切替のタイムラインは:
  1. 管理画面でアクティブ切替（即座）
  2. Sync Agent がポーリングで検知（最大60秒）
  3. Sync Agent が画像ダウンロード + playlist.json 書き込み（数秒〜数分）
  4. Local Viewer がポーリングで検知（最大30秒）

  **最大で合計 60 + DL時間 + 30 = 90秒以上**の遅延が発生する。計画書のユーザーストーリー「ワンクリックで本番表示を切り替え」の期待値との乖離が大きい。

- **推奨対応**: 計画書セクション 6 に「表示反映までの最大遅延時間」を明記し、ユーザー向けの UI に「反映には最大2分程度かかります」等の説明を追加する。

### [DA-I-005] 既存テスト usePlaylistPreview.test.ts と useUpload.test.ts への影響

- **場所**: cloud-admin/src/__tests__/hooks/usePlaylistPreview.test.ts、useUpload.test.ts
- **問題**: 先行レビュー C-006 は playlist.test.ts のモックデータが壊れることを指摘したが、hooks のテストへの影響が未検証。`usePlaylistEditor` の型が `PlaylistResponse` から `PlaylistDetailResponse` に変更される計画のため、preview hook がこの型に依存している場合、テストの修正が必要になる。

- **推奨対応**: BE-3 実装前に全テスト（cloud-admin 8ファイル + sync-agent 7ファイル = 計15ファイル）への影響を一覧化する。

### [DA-I-006] `POST /api/playlists` でのプレイリスト作成時、store_id の解決が2パターン存在する

- **場所**: 計画書セクション 4.3、先行レビュー I-003
- **問題**: 先行レビュー I-003 は `CreatePlaylistRequest` に `storeId` がないことを指摘し「deviceId から devices テーブルを参照して store_id を取得する」ステップの明記を推奨した。しかし、もう一つの選択肢として **同一 device_id の既存プレイリストから store_id をコピーする** 方法もある。

  devices テーブルから取得する場合と既存プレイリストからコピーする場合で、devices テーブルの store_id と playlists テーブルの store_id が不整合している場合に結果が異なる。どちらの方法を採用するかで整合性の保証が変わる。

- **推奨対応**: 計画書にどちらの方法で store_id を解決するかを明記する。

### [DA-I-007] Turso の `db.batch()` トランザクション保証レベルの確認

- **場所**: 計画書セクション 4.3 PUT /api/playlists/[id]/activate
- **問題**: アクティブ切替は `db.batch()` でトランザクション化すると記載されているが、Turso の `db.batch()` が提供するトランザクション保証レベル（SERIALIZABLE? READ COMMITTED?）が計画書に記載されていない。エッジレプリカ経由のリクエストの場合、batch がプライマリにルーティングされるかも確認が必要。

- **推奨対応**: Turso の batch トランザクション保証レベルを確認し、計画書に記載する。

---

## 先行レビューとの統合サマリ

### 先行レビュー CRITICAL: 7件

| ID | 指摘内容 | 判定 |
|----|---------|------|
| C-001 | GET /api/playlist の SQL が複数行返却 | **同意** — lib/playlist.ts も同様に影響を受ける点を補足 |
| C-002 | items/route.ts の playlist 解決ロジック | **同意** — DA-C-002 で依存関係の問題を追加指摘 |
| C-003 | settings/route.ts の全プレイリスト更新 | **同意** — DA-C-004 で playlistId 優先順位の問題を追加指摘 |
| C-004 | version 更新の矛盾 | **同意** — クリーンアップロジックへの影響を補足 |
| C-005 | ON DELETE CASCADE の PRAGMA foreign_keys | **同意** — SQLite/libSQL 公式文書で「デフォルト OFF」が確認された |
| C-006 | 既存テストのモックデータ破壊 | **同意** — hooks テストへの影響も追加 |
| C-007 | UNIQUE(device_id) 制約削除の不備 | **同意** — AUTOINCREMENT とレプリケーションのリスクを補足 |

### 追加 CRITICAL: 4件

| ID | 指摘内容 |
|----|---------|
| DA-C-001 | Sync Agent のレースコンディション（最大60秒の表示遅延がユーザー期待と乖離） |
| DA-C-002 | items/route.ts の playlistId 解決ロジック不整合と BE-7/FE-2 の依存関係 |
| DA-C-003 | deletePlaylistItem の SQL に playlist_id 条件がなく、クロスプレイリスト削除が可能 |
| DA-C-004 | settings/route.ts が deviceId 優先で playlistId を無視する |

### 追加 INFORMATIONAL: 7件

| ID | 指摘内容 |
|----|---------|
| DA-I-001 | orientation 変更時のディスプレイ表示崩れ |
| DA-I-002 | プレイリスト間の画像重複による R2 ストレージ増加 |
| DA-I-003 | GET /api/playlists の認証不要設計のリスク |
| DA-I-004 | 表示反映の最大遅延が90秒以上（ユーザー期待値との乖離） |
| DA-I-005 | hooks テストファイルへの影響が未評価 |
| DA-I-006 | store_id 解決ロジックの2パターン |
| DA-I-007 | Turso batch トランザクション保証レベルの未確認 |

### 既存バグの発見: 2件

先行レビュー・計画書のスコープ外だが、複数プレイリスト対応で顕在化する既存バグ:

| バグ | 内容 | 影響 |
|------|------|------|
| usePlaylistEditor.deleteItem が body なしで DELETE | items/[id]/route.ts が playlistId 必須のため 400 エラー | 現在のフロントエンドからのアイテム削除が動作しない可能性 |
| usePlaylistEditor.reorderItems が deviceId を送信 | reorder/route.ts が playlistId 必須のため 400 エラー | 現在のフロントエンドからの並び替えが動作しない可能性 |

### 統合後の総合評価: **計画書の修正が必要**

先行レビューの CRITICAL 7件に加え、追加 CRITICAL 4件（うち DA-C-003, DA-C-004 はデータ整合性に関わるため特に優先度が高い）が存在する。

**最優先で対応すべき事項:**
1. マイグレーション + 全 SQL 変更の同一デプロイ化（先行 C-001/C-002/C-003 + DA-C-002）
2. `deletePlaylistItem` と `items/[id]` PUT の playlist_id バリデーション追加（DA-C-003）
3. settings/route.ts の playlistId 優先順位修正（DA-C-004）
4. アクティブ切替後の表示反映遅延のユーザー期待値調整（DA-C-001 + DA-I-004）
5. 既存バグ（deleteItem/reorderItems）の修正を計画書スコープに含める

---

## 参考情報源

- [SQLite Foreign Key Support（公式）](https://sqlite.org/foreignkeys.html): foreign_keys はデフォルト OFF
- [libsql/sqld #764 - Make sure foreign_keys work as intended](https://github.com/libsql/sqld/issues/764)
- [tursodatabase/libsql-client-ts #173 - Allow foreign key constraints to be disabled in batches](https://github.com/tursodatabase/libsql-client-ts/issues/173)
- [Turso libSQL Documentation](https://docs.turso.tech/libsql)
