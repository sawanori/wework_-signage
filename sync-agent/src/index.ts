/**
 * Sync Agent メインループ
 * 60秒間隔でポーリングを実行し、並行実行を防止する
 */

/**
 * startPolling: 指定したintervalMsごとにsyncFnを実行するポーリングを開始する
 * 前回のsyncFnが完了していない場合はスキップして並行実行を防止する
 * @returns stopPolling function
 */
export function startPolling(
  syncFn: () => Promise<void>,
  intervalMs: number,
): () => void {
  let isRunning = false;
  let stopped = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  function scheduleNext(): void {
    if (stopped) return;
    timeoutId = setTimeout(async () => {
      if (stopped) return;

      if (!isRunning) {
        isRunning = true;
        try {
          await syncFn();
        } catch (err) {
          console.error(
            JSON.stringify({
              level: 'error',
              message: 'Sync loop error',
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        } finally {
          isRunning = false;
        }
      }

      scheduleNext();
    }, intervalMs);
  }

  scheduleNext();

  return () => {
    stopped = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
}

// Main entry point (only runs when executed directly, not during tests)
async function main(): Promise<void> {
  const { fetchPlaylist, downloadFile } = await import('./fetcher.js');
  const { moveFile, writePlaylistJson } = await import('./fileManager.js');
  const { verifyHash } = await import('./hashVerifier.js');
  const { cleanupOldFiles } = await import('./cleaner.js');
  const { readFileSync, existsSync } = await import('fs');
  const { join } = await import('path');

  const API_URL = process.env.CLOUD_ADMIN_URL ?? 'https://admin.non-turn.com';
  const DEVICE_ID = process.env.DEVICE_ID ?? 'device_kyokomachi_01';
  const INTERVAL_MS = 60_000;
  const DATA_DIR = process.env.DATA_DIR ?? '/data';
  const IMAGES_DIR = join(DATA_DIR, 'images');
  const TMP_DIR = join(DATA_DIR, 'tmp');
  const PLAYLIST_JSON_PATH = join(DATA_DIR, 'playlist.json');
  const PLAYLIST_JSON_TMP_PATH = join(TMP_DIR, 'playlist.json.tmp');

  console.log(
    JSON.stringify({
      level: 'info',
      message: 'Sync Agent starting',
      apiUrl: API_URL,
      deviceId: DEVICE_ID,
      intervalMs: INTERVAL_MS,
    }),
  );

  const stop = startPolling(async () => {
    // Step 1: Fetch playlist from API
    const playlist = await fetchPlaylist(API_URL, DEVICE_ID);
    if (!playlist) {
      console.error(JSON.stringify({ level: 'error', message: 'Failed to fetch playlist' }));
      return;
    }

    // Step 2: Compare version with local playlist.json
    let localVersion: string | null = null;
    if (existsSync(PLAYLIST_JSON_PATH)) {
      try {
        const local = JSON.parse(readFileSync(PLAYLIST_JSON_PATH, 'utf-8')) as { version?: string };
        localVersion = local.version ?? null;
      } catch {
        // Treat parse error as no local version
      }
    }

    if (localVersion === playlist.version) {
      console.log(
        JSON.stringify({
          level: 'info',
          message: 'Playlist up to date, skipping sync',
          version: playlist.version,
        }),
      );
      return;
    }

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Playlist version changed, starting sync',
        localVersion,
        remoteVersion: playlist.version,
      }),
    );

    // Step 3: Download each item to tmp/, verify hash, move to images/
    for (const item of playlist.items) {
      const ext = item.url.includes('.') ? item.url.split('.').pop() ?? '' : '';
      const filename = ext ? `${item.id}.${ext}` : item.id;
      const tmpFilePath = join(TMP_DIR, `${filename}.tmp`);
      const destFilePath = join(IMAGES_DIR, filename);

      // Skip if already exists with correct hash
      if (existsSync(destFilePath)) {
        const alreadyValid = await verifyHash(destFilePath, item.hash).catch(() => false);
        if (alreadyValid) {
          console.log(
            JSON.stringify({ level: 'info', message: 'File already valid, skipping', id: item.id }),
          );
          continue;
        }
      }

      try {
        await downloadFile(item.url, tmpFilePath);
      } catch (err) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'Download failed',
            id: item.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        continue;
      }

      const valid = await verifyHash(tmpFilePath, item.hash).catch(() => false);
      if (!valid) {
        console.error(
          JSON.stringify({ level: 'error', message: 'Hash mismatch, discarding', id: item.id }),
        );
        try {
          const { unlinkSync } = await import('fs');
          unlinkSync(tmpFilePath);
        } catch {
          // Ignore cleanup errors
        }
        continue;
      }

      moveFile(tmpFilePath, destFilePath);
      console.log(
        JSON.stringify({ level: 'info', message: 'File synced', id: item.id }),
      );
    }

    // Step 4: Write playlist.json atomically (URLs converted to local paths)
    writePlaylistJson(playlist, PLAYLIST_JSON_PATH, PLAYLIST_JSON_TMP_PATH);

    // Step 5: Cleanup old files
    cleanupOldFiles(IMAGES_DIR, playlist.items);

    console.log(
      JSON.stringify({
        level: 'info',
        message: 'Sync complete',
        version: playlist.version,
      }),
    );
  }, INTERVAL_MS);

  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    stop();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}

// Only run main if this is the entry point
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
