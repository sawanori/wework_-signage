// shared/types.ts

/**
 * プレイリスト1アイテム
 * PDFの場合: type = "pdf", urlはR2上のPDFファイルへのURL
 */
export interface PlaylistItem {
  id: string;                       // 例: "img_001"
  url: string;                      // R2上のファイルURL
  hash: string;                     // SHA-256ハッシュ（大文字小文字: lowercase hex）
  type: "image" | "pdf";            // ファイル種別
  durationOverrideMs: number | null; // nullの場合はglobalSettings.intervalMsを使用。PDFの場合、durationOverrideMsは無視され、1ページあたり20秒固定で表示される
  position: number;                  // 表示順（昇順）
}

/**
 * グローバル設定
 */
export interface GlobalSettings {
  fadeDurationMs: number;   // デフォルト: 2000
  intervalMs: number;        // デフォルト: 10000
}

/**
 * GET /api/playlist のレスポンス型
 * Sync AgentとLocal Viewerの両方が参照する
 */
export interface PlaylistResponse {
  version: string;           // "v_{unixTimestamp}" 例: "v_1710678000"
  orientation: "portrait" | "landscape";
  globalSettings: GlobalSettings;
  deviceId: string;          // 端末識別子
  storeId: string;           // 店舗識別子
  items: PlaylistItem[];
}

/**
 * data/playlist.json のスキーマ
 * Sync AgentがLocal Viewerのために書き込む形式
 * PlaylistResponseと同一構造（そのまま保存）
 */
export type LocalPlaylist = PlaylistResponse;

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
