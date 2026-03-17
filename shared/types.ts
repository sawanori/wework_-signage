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
