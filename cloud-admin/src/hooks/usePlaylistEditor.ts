'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PlaylistResponse, PlaylistItem, GlobalSettings } from '@non-turn/shared';

export interface PlaylistEditorState {
  playlist: PlaylistResponse | null;
  loading: boolean;
  error: string | null;
}

const DEVICE_ID = 'device_kyokomachi_01';

function getAuthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_ADMIN_API_KEY ?? ''}`,
  };
}

export function usePlaylistEditor() {
  const [state, setState] = useState<PlaylistEditorState>({
    playlist: null,
    loading: false,
    error: null,
  });

  const fetchPlaylist = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/playlist?device_id=${DEVICE_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to fetch playlist (${res.status})`);
      }
      const playlist = (await res.json()) as PlaylistResponse;
      setState({ playlist, loading: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリストの取得に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, []);

  const addItem = useCallback(
    async (fileId: string, publicUrl: string, fileType: 'image' | 'pdf', filename: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch('/api/playlist/items', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            deviceId: DEVICE_ID,
            itemId: fileId,
            publicUrl,
            fileType,
            originalFilename: filename,
            hash: '',
            fileSize: 0,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to add item (${res.status})`);
        }
        await fetchPlaylist();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'アイテムの追加に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch(`/api/playlist/items/${itemId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to delete item (${res.status})`);
        }
        await fetchPlaylist();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'アイテムの削除に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist]
  );

  const reorderItems = useCallback(
    async (items: PlaylistItem[]) => {
      // Optimistically update local state
      setState((prev) => {
        if (!prev.playlist) return prev;
        return {
          ...prev,
          playlist: { ...prev.playlist, items },
        };
      });

      try {
        const res = await fetch('/api/playlist/reorder', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            deviceId: DEVICE_ID,
            orderedIds: items.map((item) => item.id),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to reorder (${res.status})`);
        }
        await fetchPlaylist();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '並び替えの保存に失敗しました。';
        setState((prev) => ({ ...prev, error: message }));
        // Revert by refetching
        void fetchPlaylist();
      }
    },
    [fetchPlaylist]
  );

  const updateSettings = useCallback(
    async (settings: GlobalSettings & { orientation?: 'portrait' | 'landscape' }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const res = await fetch('/api/playlist/settings', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            deviceId: DEVICE_ID,
            ...settings,
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to update settings (${res.status})`);
        }
        await fetchPlaylist();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '設定の保存に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist]
  );

  // Initial load
  useEffect(() => {
    void fetchPlaylist();
  }, [fetchPlaylist]);

  return {
    state,
    fetchPlaylist,
    addItem,
    deleteItem,
    reorderItems,
    updateSettings,
  };
}
