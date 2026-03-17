import { useState, useEffect, useRef } from 'react';
import type { PlaylistItem, GlobalSettings, PlaylistResponse } from '../types/playlist';

const FETCH_INTERVAL_MS = 30000;

interface PlaylistState {
  items: PlaylistItem[];
  version: string;
  orientation: 'portrait' | 'landscape';
  globalSettings: GlobalSettings;
}

const initialState: PlaylistState = {
  items: [],
  version: '',
  orientation: 'portrait',
  globalSettings: { fadeDurationMs: 2000, intervalMs: 10000 },
};

/**
 * playlist.jsonを30秒間隔でfetchして状態を管理するフック
 */
export function usePlaylist() {
  const [state, setState] = useState<PlaylistState>(initialState);
  const stateRef = useRef(state);

  // stateRef を最新の state に同期
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const fetchPlaylist = async () => {
      const url = `/data/playlist.json?t=${Date.now()}`;
      try {
        const response = await fetch(url);
        const data: PlaylistResponse = await response.json();

        // version が変化した場合のみ更新
        if (data.version !== stateRef.current.version) {
          setState({
            items: data.items,
            version: data.version,
            orientation: data.orientation,
            globalSettings: data.globalSettings,
          });
        }
      } catch (err) {
        if (err instanceof SyntaxError) {
          console.error('[usePlaylist] playlist.json のパースに失敗しました:', err);
        } else {
          console.warn('[usePlaylist] playlist.json の取得に失敗しました:', err);
        }
        // エラー時は前回のプレイリストを継続使用
      }
    };

    // マウント時に即座に取得
    fetchPlaylist();

    // 30秒間隔で定期取得
    const interval = setInterval(fetchPlaylist, FETCH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return state;
}
