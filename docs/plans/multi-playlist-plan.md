# 複数プレイリスト管理機能 — 実装計画書

作成日: 2026-03-18
バージョン: 1.0.0

---

## 1. 概要

### 1.1 機能の目的

現在のシステムは1デバイスにつき1プレイリストのみ管理できる。本機能拡張では1デバイスあたり最大3つのプレイリストを作成・管理できるようにし、そのうち1つを「アクティブ」として選択することで本番サイネージに表示するコンテンツを素早く切り替えられるようにする。

ユースケース例: 春メニュー / 夏メニュー / 通常営業 の3プレイリストを並行して編集・保持しつつ、季節の変わり目にワンクリックで切り替える。

### 1.2 ユーザーストーリー

```
店舗スタッフとして、
  春メニュー・夏メニュー・通常営業の3つのプレイリストを管理したい。
  なぜなら、季節ごとの素材を事前に準備しておき、
  当日ワンクリックで本番表示を切り替えたいからだ。

店舗スタッフとして、
  非アクティブなプレイリストも編集・プレビューしたい。
  なぜなら、次シーズンのコンテンツを本番に影響なく準備したいからだ。

店舗スタッフとして、
  アクティブなプレイリストは削除できないようにしたい。
  なぜなら、誤操作で本番表示が消えることを防ぎたいからだ。
```

### 1.3 スコープ

**対象**
- DB スキーマ変更（is_active カラム追加、UNIQUE制約変更）
- 新規 API エンドポイント（一覧取得・作成・アクティブ切替・削除）
- shared/types.ts の型拡張
- Cloud Admin UI の複数プレイリスト管理画面
- usePlaylistEditor hook の拡張

**対象外（変更なし）**
- Sync Agent: `GET /api/playlist?device_id=` の後方互換を維持するため変更不要
- Local Viewer: playlist.json スキーマは変わらないため変更不要
- 既存の items / settings / reorder API: playlist_id ベースのため変更最小

---

## 2. DB スキーマ変更

### 2.1 現状と変更点

現在の `playlists` テーブルには `UNIQUE(device_id)` 制約があり、1デバイス=1プレイリストが強制されている。これを「1デバイスにつき最大3プレイリスト、そのうちアクティブは1つだけ」に変更する。

### 2.2 マイグレーション SQL

ファイルパス: `cloud-admin/migrations/002_multi_playlist.sql`

```sql
-- Step 1: is_active カラムを追加（既存の1件はアクティブとして移行）
ALTER TABLE playlists ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1));

-- Step 2: name カラムを追加（プレイリスト名、デフォルト: "通常")
ALTER TABLE playlists ADD COLUMN name TEXT NOT NULL DEFAULT '通常';

-- Step 3: 既存レコードをアクティブに設定（全デバイス分）
UPDATE playlists SET is_active = 1;

-- Step 4: 既存の UNIQUE(device_id) 制約は SQLite では DROP できないため、
--         テーブル再作成方式でインデックスを差し替える。
--         （Turso/libSQL は ALTER TABLE DROP CONSTRAINT 非対応）
--         代替: アプリ側ロジックで最大3件 + アクティブ1件を強制する。
--         DBレベルの一意性は partial unique index で担保する。

-- Step 5: アクティブプレイリストの一意性を Partial Index で担保
-- 注意: Turso(libSQL) は WHERE 付き CREATE UNIQUE INDEX をサポートする
CREATE UNIQUE INDEX idx_playlists_device_active
  ON playlists (device_id)
  WHERE is_active = 1;

-- Step 6: デバイスごとのプレイリスト一覧取得用インデックス
CREATE INDEX idx_playlists_device_id_all ON playlists (device_id, id);
```

**Turso Partial Index の確認事項（実装前に要検証）:**
Turso は SQLite ベースのため、`CREATE UNIQUE INDEX ... WHERE is_active = 1` の構文はサポートされているが、本番環境での動作確認を実装前に行うこと。未サポートの場合はアプリケーション層のトランザクションで代替する（後述）。

### 2.3 変更後の playlists テーブル定義

```sql
CREATE TABLE playlists (
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
  -- UNIQUE(device_id) を削除し、Partial Index で代替
);
```

### 2.4 既存データの移行方針

| 状況 | 移行方法 |
|------|---------|
| 既存のプレイリストレコード（device_kyokomachi_01） | `is_active = 1`, `name = '通常'` を設定 |
| 既存の `playlist_items` レコード | 変更なし（playlist_id は変わらない） |
| バージョン番号 | 変更なし |

マイグレーション適用コマンド:

```bash
turso db shell {db-name} < cloud-admin/migrations/002_multi_playlist.sql
```

---

## 3. shared/types.ts の変更

### 3.1 変更内容

```typescript
// shared/types.ts

// --- 既存型（変更なし）---
export interface PlaylistItem { /* 変更なし */ }
export interface GlobalSettings { /* 変更なし */ }

// --- 既存型（拡張）---
/**
 * GET /api/playlist?device_id= のレスポンス型（後方互換維持）
 * Sync Agent と Local Viewer が参照する。スキーマは変更しない。
 */
export interface PlaylistResponse {
  version: string;
  orientation: "portrait" | "landscape";
  globalSettings: GlobalSettings;
  deviceId: string;
  storeId: string;
  items: PlaylistItem[];
  // 注意: playlistId / playlistName / isActive は意図的に含まない
  //       Sync Agent / Local Viewer の後方互換を壊さないため
}

// --- 新規型 ---

/**
 * プレイリストのサマリー情報（一覧表示用）
 */
export interface PlaylistSummary {
  id: number;           // プレイリストID（DBの INTEGER PRIMARY KEY）
  name: string;         // プレイリスト名（例: "春メニュー"）
  isActive: boolean;    // アクティブかどうか
  itemCount: number;    // アイテム数
  version: string;      // 最終更新バージョン
  updatedAt: number;    // Unix timestamp（秒）
}

/**
 * GET /api/playlists?device_id= のレスポンス型
 */
export interface PlaylistListResponse {
  deviceId: string;
  storeId: string;
  playlists: PlaylistSummary[];  // 最大3件
}

/**
 * GET /api/playlist?device_id=&playlist_id= のレスポンス型
 * 特定プレイリストの詳細取得（管理画面の編集用）
 * PlaylistResponse を拡張して playlist メタ情報を追加
 */
export interface PlaylistDetailResponse extends PlaylistResponse {
  playlistId: number;
  playlistName: string;
  isActive: boolean;
}

/**
 * POST /api/playlists のリクエスト型
 */
export interface CreatePlaylistRequest {
  deviceId: string;
  name: string;  // 1〜50文字
}

/**
 * POST /api/playlists のレスポンス型
 */
export interface CreatePlaylistResponse {
  playlistId: number;
  name: string;
  isActive: boolean;
}

export type LocalPlaylist = PlaylistResponse;
```

---

## 4. API 変更

### 4.1 エンドポイント一覧

| メソッド | パス | 用途 | 認証 |
|---------|------|------|------|
| GET | `/api/playlist?device_id=` | アクティブプレイリスト取得（Sync Agent 向け・後方互換） | 不要 |
| GET | `/api/playlist?device_id=&playlist_id=` | 特定プレイリストの詳細取得（管理画面向け） | 不要 |
| GET | `/api/playlists?device_id=` | プレイリスト一覧取得（サマリー） | 不要 |
| POST | `/api/playlists` | 新規プレイリスト作成（最大3件チェック） | Bearer |
| PUT | `/api/playlists/[id]/activate` | アクティブ切替 | Bearer |
| PUT | `/api/playlists/[id]` | プレイリスト名更新 | Bearer |
| DELETE | `/api/playlists/[id]` | プレイリスト削除（アクティブは不可） | Bearer |

### 4.2 既存エンドポイントの変更

**GET /api/playlist（既存・変更あり）**

`playlist_id` クエリパラメータを追加するが、指定なしの場合は従来通りアクティブなプレイリストを返す（後方互換維持）。

```
# 従来の呼び出し（Sync Agent）→ アクティブなプレイリストを返す
GET /api/playlist?device_id=device_kyokomachi_01

# 新しい呼び出し（管理画面）→ 特定プレイリストの詳細を返す
GET /api/playlist?device_id=device_kyokomachi_01&playlist_id=2
```

現在の `route.ts` の SQL を以下のように変更:

```sql
-- playlist_id 未指定時（後方互換）: is_active = 1 の1件を取得
SELECT id, device_id, store_id, name, is_active, version, orientation, fade_duration_ms, interval_ms
FROM playlists
WHERE device_id = ? AND is_active = 1

-- playlist_id 指定時: 指定IDを取得（device_id との一致もチェック）
SELECT id, device_id, store_id, name, is_active, version, orientation, fade_duration_ms, interval_ms
FROM playlists
WHERE id = ? AND device_id = ?
```

### 4.3 新規エンドポイント詳細

**GET /api/playlists?device_id=**

ファイルパス: `cloud-admin/src/app/api/playlists/route.ts`

レスポンス例:
```json
{
  "deviceId": "device_kyokomachi_01",
  "storeId": "store_kyokomachi",
  "playlists": [
    {
      "id": 1,
      "name": "通常",
      "isActive": true,
      "itemCount": 5,
      "version": "v_1710678000",
      "updatedAt": 1710678000
    },
    {
      "id": 2,
      "name": "春メニュー",
      "isActive": false,
      "itemCount": 3,
      "version": "v_1710670000",
      "updatedAt": 1710670000
    }
  ]
}
```

**POST /api/playlists**

ファイルパス: `cloud-admin/src/app/api/playlists/route.ts`（GET と同ファイル）

リクエスト:
```json
{
  "deviceId": "device_kyokomachi_01",
  "name": "春メニュー"
}
```

レスポンス（201）:
```json
{
  "playlistId": 2,
  "name": "春メニュー",
  "isActive": false
}
```

エラー（3件上限超過時 422）:
```json
{
  "error": "Maximum playlist limit (3) reached",
  "code": "PLAYLIST_LIMIT_EXCEEDED"
}
```

**PUT /api/playlists/[id]/activate**

ファイルパス: `cloud-admin/src/app/api/playlists/[id]/activate/route.ts`

処理内容: 同一 device_id のすべてのプレイリストを `is_active = 0` に設定し、指定 ID のみ `is_active = 1` にする。**この2操作は単一トランザクション（`db.batch()`）で実行すること。**

リクエストボディ: なし（IDはURLパスで指定）

レスポンス（200）:
```json
{
  "playlistId": 2,
  "name": "春メニュー",
  "isActive": true
}
```

エラー（IDが存在しない or device_id 不一致 → 404）:
```json
{
  "error": "Playlist not found",
  "code": "PLAYLIST_NOT_FOUND"
}
```

**PUT /api/playlists/[id]**

ファイルパス: `cloud-admin/src/app/api/playlists/[id]/route.ts`

リクエスト:
```json
{
  "name": "夏メニュー"
}
```

レスポンス（200）:
```json
{
  "playlistId": 2,
  "name": "夏メニュー"
}
```

**DELETE /api/playlists/[id]**

ファイルパス: `cloud-admin/src/app/api/playlists/[id]/route.ts`（PUT と同ファイル）

- アクティブなプレイリストの削除を拒否（409）
- 削除時は `playlist_items` も `ON DELETE CASCADE` で連鎖削除される

エラー（アクティブ削除試行 409）:
```json
{
  "error": "Cannot delete active playlist",
  "code": "CANNOT_DELETE_ACTIVE"
}
```

### 4.4 既存 items / settings / reorder API の変更

これらのAPIは `playlist_id` ベースで動作しているため、基本的な変更は不要。ただし現状の `device_id` から `playlist_id` を解決するロジックを「アクティブプレイリストのIDを返す」から「指定されたプレイリストIDを直接受け取る」に変更することが必要。

具体的な変更:
- `POST /api/playlist/items`: ボディの `deviceId` に加えて `playlistId` を受け取れるようにする（`playlistId` 指定時はそちらを優先、指定なし時は `deviceId` からアクティブを解決する後方互換維持）
- `PUT /api/playlist/items/[id]`: 変更なし（`playlist_id` は item 側に紐づいている）
- `DELETE /api/playlist/items/[id]`: 変更なし
- `PUT /api/playlist/settings`: `deviceId` に加えて `playlistId` を受け取れるように拡張
- `POST /api/playlist/reorder`: `deviceId` に加えて `playlistId` を受け取れるように拡張

---

## 5. フロントエンド変更

### 5.1 新規ファイル構成

```
cloud-admin/src/
├── app/
│   ├── api/
│   │   └── playlists/
│   │       ├── route.ts                   # GET（一覧）/ POST（新規作成）
│   │       └── [id]/
│   │           ├── route.ts               # PUT（名前変更）/ DELETE
│   │           └── activate/
│   │               └── route.ts           # PUT（アクティブ切替）
│   └── page.tsx                           # 変更: プレイリスト選択 UI を追加
├── components/
│   └── playlist/
│       ├── PlaylistSelector.tsx           # 新規: プレイリスト選択タブ/一覧
│       ├── PlaylistCreateButton.tsx       # 新規: 新規作成ボタン（3件上限で非活性）
│       ├── PlaylistActivateButton.tsx     # 新規: アクティブ切替ボタン
│       ├── PlaylistNameEditor.tsx         # 新規: インライン名前編集
│       └── PlaylistDeleteButton.tsx       # 新規: 削除ボタン（アクティブ時は非活性）
└── hooks/
    └── usePlaylistEditor.ts               # 変更: 複数プレイリスト対応に拡張
```

### 5.2 usePlaylistEditor hook の拡張

```typescript
// 拡張後のインターフェース（変更前との差分）

export interface PlaylistEditorState {
  // --- 既存 ---
  playlist: PlaylistDetailResponse | null;  // PlaylistResponse から PlaylistDetailResponse に変更
  loading: boolean;
  error: string | null;
  // --- 新規追加 ---
  playlists: PlaylistSummary[];             // 全プレイリストのサマリー一覧
  selectedPlaylistId: number | null;        // 現在編集中のプレイリストID
  playlistsLoading: boolean;                // 一覧取得中フラグ
}

// 新規追加するアクション
interface PlaylistEditorActions {
  // 既存
  fetchPlaylist: () => Promise<void>;
  addItem: (...) => Promise<void>;
  deleteItem: (...) => Promise<void>;
  reorderItems: (...) => Promise<void>;
  updateSettings: (...) => Promise<void>;
  // 新規
  fetchPlaylists: () => Promise<void>;             // 全プレイリスト一覧取得
  selectPlaylist: (playlistId: number) => void;    // 編集対象プレイリストの切替
  createPlaylist: (name: string) => Promise<void>; // 新規プレイリスト作成
  activatePlaylist: (playlistId: number) => Promise<void>; // アクティブ切替
  renamePlaylist: (playlistId: number, name: string) => Promise<void>; // 名前変更
  deletePlaylist: (playlistId: number) => Promise<void>; // プレイリスト削除
}
```

### 5.3 管理画面 UI 変更（page.tsx）

現在の「プレイリスト管理」セクションの上部に `PlaylistSelector` を追加する。

**UI レイアウト（変更後）:**

```
[Non-Turn Signage]             [プレビューボタン]

[ファイルのアップロード]

[プレイリスト管理]
  +--------------------------------------------+
  | 通常 [LIVE]  春メニュー  夏メニュー  [+新規] |  ← PlaylistSelector
  +--------------------------------------------+
  |  [アクティブにする] [名前を変更] [削除]      |  ← 選択中プレイリストの操作
  +--------------------------------------------+
  |  （既存の PlaylistEditor）                   |  ← アイテム一覧・並び替え・設定
  +--------------------------------------------+
```

- タブUIで各プレイリストを切り替え（アクティブなプレイリストには「LIVE」バッジ）
- 「アクティブにする」ボタンは確認モーダル付き
- 削除ボタンはアクティブプレイリスト選択中は非活性化（グレーアウト）
- 「+新規」ボタンはプレイリスト数が3件のとき非活性化

### 5.4 PlaylistSelector コンポーネント仕様

```typescript
interface PlaylistSelectorProps {
  playlists: PlaylistSummary[];
  selectedPlaylistId: number | null;
  onSelect: (playlistId: number) => void;
  onCreateNew: () => void;            // 名前入力モーダルを開く
  maxPlaylists: number;               // = 3
  loading: boolean;
}
```

### 5.5 アクティブ切替確認モーダル

```
「春メニュー」をアクティブにしますか？

現在の「通常」の配信が停止し、「春メニュー」の配信が
即座に開始されます。

[キャンセル]  [アクティブにする]
```

---

## 6. Sync Agent 変更

**変更なし。**

Sync Agent は `GET /api/playlist?device_id=` を呼び出しており、このエンドポイントは引き続き `is_active = 1` のプレイリストを返す。fetcher.ts の変更は不要。

ただし、アクティブ切替時（`PUT /api/playlists/[id]/activate`）の処理完了後、アクティブになったプレイリストの `version` が更新されることで、次回ポーリング時（最大1分後）に Sync Agent が変更を検知して新しいコンテンツを配信する。

---

## 7. Local Viewer 変更

**変更なし。**

`data/playlist.json` のスキーマ（`PlaylistResponse`）は変更しない。Local Viewer への影響はゼロ。

---

## 8. テストケース

### 8.1 DB / API: 正常系

| ID | テスト名 | 期待される動作 |
|----|---------|--------------|
| MP-N-01 | プレイリスト一覧取得 | `GET /api/playlists?device_id=device_kyokomachi_01` で `PlaylistListResponse` 型のJSONが200で返る |
| MP-N-02 | アクティブプレイリスト取得（後方互換） | `GET /api/playlist?device_id=device_kyokomachi_01`（`playlist_id` なし）で `is_active=1` のプレイリストが返る |
| MP-N-03 | 特定プレイリスト取得 | `GET /api/playlist?device_id=device_kyokomachi_01&playlist_id=2` で id=2 のプレイリスト詳細が返る |
| MP-N-04 | プレイリスト新規作成 | `POST /api/playlists` で `{deviceId, name: "春メニュー"}` を送ると201が返り、プレイリスト数が1→2になる |
| MP-N-05 | アクティブ切替 | `PUT /api/playlists/2/activate` 後に `GET /api/playlist?device_id=` がid=2のプレイリストを返す |
| MP-N-06 | 名前変更 | `PUT /api/playlists/2` で `{name: "夏メニュー"}` を送ると一覧に反映される |
| MP-N-07 | プレイリスト削除 | `DELETE /api/playlists/2`（非アクティブ）後に一覧からid=2が消える |
| MP-N-08 | 削除後アイテムも削除 | プレイリスト削除後に `playlist_items` の関連アイテムが CASCADE で削除される |
| MP-N-09 | アクティブ切替後バージョン更新 | `PUT /api/playlists/2/activate` 後に `GET /api/playlist?device_id=` の version が変わる |
| MP-N-10 | 非アクティブプレイリストのアイテム編集 | 非アクティブのplaylist_id=2 に対して `POST /api/playlist/items` でアイテム追加でき、アクティブのプレイリストには影響しない |

### 8.2 DB / API: 異常系

| ID | テスト名 | 期待される動作 |
|----|---------|--------------|
| MP-E-01 | 3件上限超過 | 3件存在する状態で `POST /api/playlists` すると422と `PLAYLIST_LIMIT_EXCEEDED` が返る |
| MP-E-02 | アクティブ削除試行 | `DELETE /api/playlists/1`（アクティブ）を実行すると409と `CANNOT_DELETE_ACTIVE` が返る |
| MP-E-03 | 存在しない playlist_id でアクティブ切替 | `PUT /api/playlists/999/activate` で404が返る |
| MP-E-04 | 別デバイスのプレイリスト操作 | 他の `device_id` に属するプレイリストIDで操作すると404が返る |
| MP-E-05 | 認証なしで作成 | `POST /api/playlists` に Authorization ヘッダなしで送ると401が返る |
| MP-E-06 | 名前が空文字 | `POST /api/playlists` で `name: ""` を送ると400が返る |
| MP-E-07 | 名前が51文字以上 | `POST /api/playlists` で51文字の名前を送ると400が返る |
| MP-E-08 | playlist_id が別 device_id の場合 | `GET /api/playlist?device_id=X&playlist_id=Y`（YはデバイスXに属さない）で404が返る |

### 8.3 エッジケース

| ID | テスト名 | 期待される動作 |
|----|---------|--------------|
| MP-EC-01 | アクティブ切替のトランザクション | `PUT /api/playlists/2/activate` 実行中に DB 障害が発生しても、旧アクティブが `is_active=0` にされた状態で止まらない（両方の UPDATE が成功するか、両方ロールバックされる） |
| MP-EC-02 | プレイリストが1件のとき削除試行 | 1件しかなくかつアクティブの場合、409で削除不可 |
| MP-EC-03 | 同名プレイリストの作成 | 同じデバイスに同名のプレイリストを作成できる（名前の一意性は強制しない） |
| MP-EC-04 | アクティブなプレイリストを再度アクティブに | `PUT /api/playlists/1/activate`（既にアクティブ）は冪等に200を返し、version は更新しない（バージョン不要な場合）or 更新する（設計上の判断が必要 → 本計画書では「更新しない」を採用） |
| MP-EC-05 | Sync Agent への影響 | アクティブ切替後の次回ポーリング（1分以内）で Sync Agent が新しいプレイリストのコンテンツをダウンロードして playlist.json を更新する |
| MP-EC-06 | 3件すべてのプレイリストが空アイテム | 3件存在してもアクティブプレイリストのアイテムが空なら Local Viewer は黒画面（既存動作と同じ） |

### 8.4 フロントエンド: 正常系

| ID | テスト名 | 期待される動作 |
|----|---------|--------------|
| MP-FE-N-01 | プレイリスト一覧表示 | 管理画面表示時に3つのタブがレンダリングされ、アクティブに「LIVE」バッジが表示される |
| MP-FE-N-02 | プレイリスト切替 | 別タブをクリックすると対応するプレイリストのアイテム一覧が表示される |
| MP-FE-N-03 | 新規作成フロー | 「+新規」→ 名前入力モーダル → 確定でタブが追加される |
| MP-FE-N-04 | アクティブ切替フロー | 「アクティブにする」→ 確認モーダル → 確定で「LIVE」バッジが移動する |
| MP-FE-N-05 | 削除フロー | 「削除」→ 確認モーダル → 確定でタブが消える |

### 8.5 フロントエンド: 異常系

| ID | テスト名 | 期待される動作 |
|----|---------|--------------|
| MP-FE-E-01 | 3件時「+新規」非活性 | 3件存在するとき「+新規」ボタンがグレーアウトしクリックできない |
| MP-FE-E-02 | アクティブ時「削除」非活性 | 選択中プレイリストがアクティブのとき「削除」ボタンがグレーアウトしクリックできない |
| MP-FE-E-03 | アクティブ切替APIエラー | `PUT /api/playlists/[id]/activate` が500を返した場合、エラーバナーを表示してUIを元の状態に戻す |

---

## 9. エラー＆レスキューマップ

| 処理 | 想定される異常 | ハンドリング方法 | ユーザーへの影響 |
|------|---------------|-----------------|-----------------|
| GET /api/playlists | DB接続失敗 | 500返却、スタックトレースはレスポンスに含めない | 管理画面でプレイリスト一覧が表示されない。既存サイネージは継続 |
| POST /api/playlists（上限チェック） | 3件超過 | 422と `PLAYLIST_LIMIT_EXCEEDED` を返す | ユーザーに上限超過を通知。既存プレイリストは維持 |
| PUT /api/playlists/[id]/activate | `is_active = 0` 更新成功後 `is_active = 1` 更新失敗 | `db.batch()` のトランザクションでロールバック、500返却 | アクティブ切替失敗。旧アクティブのサイネージが継続（安全側に倒れる） |
| PUT /api/playlists/[id]/activate | DB接続失敗 | 500返却 | アクティブ切替失敗。UIはエラーを表示し元の状態を維持 |
| DELETE /api/playlists/[id] | アクティブプレイリストを削除試行 | 409と `CANNOT_DELETE_ACTIVE` を返す | 削除を拒否。サイネージへの影響なし |
| DELETE /api/playlists/[id] | CASCADE削除中にDB障害 | 500返却、部分削除が発生しないよう libSQL のトランザクション保証に委ねる | 削除失敗。管理画面でエラー表示 |
| GET /api/playlist（後方互換） | `is_active = 1` のレコードが0件（移行不備等） | 「アクティブなプレイリストが存在しない」として404を返す | Sync Agent は既存 playlist.json を継続使用。サイネージ無影響 |
| FE: アクティブ切替 | APIエラー（500/422） |楽観的更新を行わず、エラーバナーを表示してリフェッチ | ユーザーへのエラー表示。UIは元の状態に戻る |
| FE: プレイリスト作成 | 上限エラー（422） | `PLAYLIST_LIMIT_EXCEEDED` メッセージをエラーバナーに表示 | ユーザーに上限を通知 |

---

## 10. 実装ステップ（FE/BE 並列）

### 10.1 BE（バックエンド）ステップ

```
Step BE-1: マイグレーション
  - cloud-admin/migrations/002_multi_playlist.sql 作成
  - Turso Partial Index の動作検証
  - ローカル DB（local.db）に適用して確認

Step BE-2: shared/types.ts 更新
  - PlaylistSummary / PlaylistListResponse / PlaylistDetailResponse / CreatePlaylistRequest 等の追加

Step BE-3: GET /api/playlist 既存エンドポイント改修
  - playlist_id クエリパラメータ対応（後方互換維持）
  - playlist.ts の getPlaylist() を getActivePlaylist(deviceId) と getPlaylistById(playlistId, deviceId) に分割

Step BE-4: GET / POST /api/playlists 新規実装
  - cloud-admin/src/app/api/playlists/route.ts 作成
  - getPlaylistSummaries(deviceId) をビジネスロジックに追加
  - createPlaylist(deviceId, name) をビジネスロジックに追加（3件上限チェック込み）

Step BE-5: PUT /api/playlists/[id]/activate 実装
  - cloud-admin/src/app/api/playlists/[id]/activate/route.ts 作成
  - activatePlaylist(playlistId, deviceId) をトランザクションで実装

Step BE-6: PUT / DELETE /api/playlists/[id] 実装
  - cloud-admin/src/app/api/playlists/[id]/route.ts 作成
  - renamePlaylist(playlistId, name) / deletePlaylist(playlistId, deviceId) を実装

Step BE-7: items / settings / reorder API の playlistId 対応拡張
  - 各 API の POST/PUT ボディに playlistId を受け取れるよう拡張
  - 後方互換: playlistId 未指定時は deviceId からアクティブを解決
```

### 10.2 FE（フロントエンド）ステップ

```
Step FE-1: shared/types.ts 更新（BE-2 完了後に開始）
  - 同上（BE と共有ファイルのため調整が必要）

Step FE-2: usePlaylistEditor hook 拡張（BE-3, BE-4 完了後）
  - PlaylistEditorState に playlists / selectedPlaylistId / playlistsLoading を追加
  - fetchPlaylists / selectPlaylist / createPlaylist / activatePlaylist / renamePlaylist / deletePlaylist 追加
  - 既存の fetchPlaylist / addItem / deleteItem / reorderItems / updateSettings は selectedPlaylistId を使うよう変更

Step FE-3: PlaylistSelector コンポーネント実装
  - タブ形式の UI（Apple デザイン準拠）
  - アクティブには「LIVE」バッジ
  - プレイリスト数が3件のとき「+新規」非活性

Step FE-4: プレイリスト操作ボタン群の実装
  - PlaylistActivateButton（確認モーダル付き）
  - PlaylistNameEditor（インライン編集 or モーダル）
  - PlaylistDeleteButton（アクティブ時は非活性）

Step FE-5: page.tsx 統合
  - PlaylistSelector をプレイリスト管理セクション上部に配置
  - 選択中プレイリストIDを PlaylistEditor に渡す
  - プレビューは選択中プレイリストのコンテンツを表示
```

### 10.3 並列実行可能なタスク

| タスク | 並列対象 | 条件 |
|--------|---------|------|
| BE-1 マイグレーション | FE-3 コンポーネント実装 | 独立。BE マイグレーション中に FE コンポーネント骨格を作れる |
| BE-4 一覧API | BE-5 アクティブ切替API | 独立。並列実装可 |
| FE-3 Selector | FE-4 ボタン群 | 独立。並列実装可 |

### 10.4 直列（依存あり）のタスク

| タスク | 依存先 | 理由 |
|--------|--------|------|
| BE-3 以降 | BE-1 マイグレーション完了 | is_active カラムが存在しないと実装・テストができない |
| FE-2 hook 拡張 | BE-3, BE-4 完了 | API エンドポイントが存在しないと統合テストができない |
| FE-5 page.tsx 統合 | FE-2, FE-3, FE-4 すべて完了 | hook とコンポーネントが揃ってから結合 |

---

## 付録: 未確定事項・確認が必要な事項

以下は実装前に確認が必要な事項（実装時に Undetermined として扱う）:

1. **Turso Partial Index の対応状況**: `CREATE UNIQUE INDEX ... WHERE is_active = 1` が Turso 本番環境（Edge レプリカ環境）でサポートされているか要検証。未サポートの場合は `activatePlaylist()` の関数内でアプリケーションレベルのトランザクション（`db.batch()`）による一意性保証に切り替える。

2. **アクティブ切替後の version 更新有無**: `PUT /api/playlists/[id]/activate` 実行時、切替先プレイリストの `version` を更新するか否か。更新する場合: Sync Agent が即座に変更を検知して配信を切り替える（推奨）。更新しない場合: Sync Agent は次のポーリングまで旧コンテンツを配信し続ける可能性がある。**本計画書では「更新する」を推奨**。

3. **既存テスト（141件）との整合性**: `GET /api/playlist` の SQL が `UNIQUE(device_id)` 前提で書かれているテストが存在する可能性があるため、マイグレーション後に全テストの再実行が必要。
