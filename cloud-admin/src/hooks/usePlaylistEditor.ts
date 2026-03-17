'use client';

import { useState, useCallback, useEffect } from 'react';
import type { PlaylistDetailResponse, PlaylistItem, GlobalSettings, PlaylistSummary } from '@non-turn/shared';

export interface PlaylistEditorState {
  // Active/selected playlist detail
  playlist: PlaylistDetailResponse | null;
  loading: boolean;
  error: string | null;
  // Multi-playlist state
  playlists: PlaylistSummary[];
  selectedPlaylistId: number | null;
  playlistsLoading: boolean;
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
    playlists: [],
    selectedPlaylistId: null,
    playlistsLoading: false,
  });

  const fetchPlaylists = useCallback(async () => {
    setState((prev) => ({ ...prev, playlistsLoading: true }));
    try {
      const res = await fetch(`/api/playlists?device_id=${DEVICE_ID}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to fetch playlists (${res.status})`);
      }
      const data = await res.json() as { playlists: PlaylistSummary[] };
      const playlists = data.playlists ?? [];

      // Set selected playlist to active one if not yet selected
      setState((prev) => {
        const activePlaylist = playlists.find((p) => p.isActive);
        const selectedId = prev.selectedPlaylistId ?? (activePlaylist?.id ?? null);
        return {
          ...prev,
          playlists,
          selectedPlaylistId: selectedId,
          playlistsLoading: false,
        };
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリスト一覧の取得に失敗しました。';
      setState((prev) => ({ ...prev, playlistsLoading: false, error: message }));
    }
  }, []);

  const fetchPlaylist = useCallback(async (playlistId?: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const targetId = playlistId ?? state.selectedPlaylistId;
      let url: string;

      if (targetId !== null && targetId !== undefined) {
        url = `/api/playlist?device_id=${DEVICE_ID}&playlist_id=${targetId}`;
      } else {
        url = `/api/playlist?device_id=${DEVICE_ID}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to fetch playlist (${res.status})`);
      }
      const playlist = (await res.json()) as PlaylistDetailResponse;
      setState((prev) => ({
        ...prev,
        playlist,
        loading: false,
        error: null,
        selectedPlaylistId: playlist.playlistId ?? prev.selectedPlaylistId,
      }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリストの取得に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [state.selectedPlaylistId]);

  const selectPlaylist = useCallback((playlistId: number) => {
    setState((prev) => ({ ...prev, selectedPlaylistId: playlistId }));
    void fetchPlaylist(playlistId);
  }, [fetchPlaylist]);

  const createPlaylist = useCallback(async (name: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ deviceId: DEVICE_ID, name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to create playlist (${res.status})`);
      }
      setState((prev) => ({ ...prev, loading: false }));
      await fetchPlaylists();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリストの作成に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [fetchPlaylists]);

  const activatePlaylist = useCallback(async (playlistId: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/playlists/${playlistId}/activate`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ deviceId: DEVICE_ID }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to activate playlist (${res.status})`);
      }
      setState((prev) => ({ ...prev, loading: false }));
      await fetchPlaylists();
      // Refresh the selected playlist detail
      await fetchPlaylist(playlistId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'アクティブ切替に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [fetchPlaylists, fetchPlaylist]);

  const renamePlaylist = useCallback(async (playlistId: number, name: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to rename playlist (${res.status})`);
      }
      setState((prev) => ({ ...prev, loading: false }));
      await fetchPlaylists();
      // Refresh playlist detail if renaming selected playlist
      if (state.selectedPlaylistId === playlistId) {
        await fetchPlaylist(playlistId);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリスト名の変更に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [fetchPlaylists, fetchPlaylist, state.selectedPlaylistId]);

  const deletePlaylist = useCallback(async (playlistId: number) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const res = await fetch(`/api/playlists/${playlistId}?device_id=${DEVICE_ID}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Failed to delete playlist (${res.status})`);
      }
      setState((prev) => ({ ...prev, loading: false }));
      await fetchPlaylists();
      // If we deleted the selected playlist, switch to active one
      if (state.selectedPlaylistId === playlistId) {
        setState((prev) => ({ ...prev, selectedPlaylistId: null }));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'プレイリストの削除に失敗しました。';
      setState((prev) => ({ ...prev, loading: false, error: message }));
    }
  }, [fetchPlaylists, state.selectedPlaylistId]);

  const addItem = useCallback(
    async (fileId: string, publicUrl: string, fileType: 'image' | 'pdf', filename: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const body: Record<string, unknown> = {
          itemId: fileId,
          publicUrl,
          fileType,
          originalFilename: filename,
          hash: '',
          fileSize: 0,
        };

        // Send playlistId if we have a selected one, otherwise fall back to deviceId
        if (state.selectedPlaylistId !== null) {
          body.playlistId = state.selectedPlaylistId;
        } else {
          body.deviceId = DEVICE_ID;
        }

        const res = await fetch('/api/playlist/items', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to add item (${res.status})`);
        }
        await fetchPlaylist(state.selectedPlaylistId ?? undefined);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'アイテムの追加に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist, state.selectedPlaylistId]
  );

  const deleteItem = useCallback(
    async (itemId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const playlistId = state.playlist?.playlistId ?? state.selectedPlaylistId;

        if (!playlistId) {
          throw new Error('No playlist selected');
        }

        const res = await fetch(`/api/playlist/items/${itemId}`, {
          method: 'DELETE',
          headers: getAuthHeaders(),
          body: JSON.stringify({ playlistId }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to delete item (${res.status})`);
        }
        await fetchPlaylist(state.selectedPlaylistId ?? undefined);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'アイテムの削除に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist, state.playlist, state.selectedPlaylistId]
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
        const playlistId = state.playlist?.playlistId ?? state.selectedPlaylistId;

        if (!playlistId) {
          throw new Error('No playlist selected');
        }

        const res = await fetch('/api/playlist/reorder', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            playlistId,
            orderedIds: items.map((item) => item.id),
          }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to reorder (${res.status})`);
        }
        await fetchPlaylist(state.selectedPlaylistId ?? undefined);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '並び替えの保存に失敗しました。';
        setState((prev) => ({ ...prev, error: message }));
        // Revert by refetching
        void fetchPlaylist(state.selectedPlaylistId ?? undefined);
      }
    },
    [fetchPlaylist, state.playlist, state.selectedPlaylistId]
  );

  const updateSettings = useCallback(
    async (settings: GlobalSettings & { orientation?: 'portrait' | 'landscape' }) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const playlistId = state.playlist?.playlistId ?? state.selectedPlaylistId;
        const body: Record<string, unknown> = { ...settings };

        if (playlistId) {
          body.playlistId = playlistId;
        } else {
          body.deviceId = DEVICE_ID;
        }

        const res = await fetch('/api/playlist/settings', {
          method: 'PUT',
          headers: getAuthHeaders(),
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Failed to update settings (${res.status})`);
        }
        await fetchPlaylist(state.selectedPlaylistId ?? undefined);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : '設定の保存に失敗しました。';
        setState((prev) => ({ ...prev, loading: false, error: message }));
      }
    },
    [fetchPlaylist, state.playlist, state.selectedPlaylistId]
  );

  // Initial load
  useEffect(() => {
    void fetchPlaylists().then(() => {
      void fetchPlaylist();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    fetchPlaylist,
    fetchPlaylists,
    selectPlaylist,
    createPlaylist,
    activatePlaylist,
    renamePlaylist,
    deletePlaylist,
    addItem,
    deleteItem,
    reorderItems,
    updateSettings,
  };
}
