import { createWriteStream, existsSync, unlinkSync } from 'fs';
import { pipeline } from 'stream/promises';
import type { PlaylistResponse } from '@non-turn/shared';

const API_TIMEOUT_MS = 10_000;
const DOWNLOAD_TIMEOUT_MS = 120_000;

export async function fetchPlaylist(
  apiUrl: string,
  deviceId: string,
): Promise<PlaylistResponse | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const url = `${apiUrl}/api/playlist?device_id=${encodeURIComponent(deviceId)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      console.error(
        JSON.stringify({
          level: 'error',
          message: `API returned ${response.status}`,
          deviceId,
          status: response.status,
        }),
      );
      return null;
    }

    const data = (await response.json()) as PlaylistResponse;
    return data;
  } catch (err) {
    console.error(
      JSON.stringify({
        level: 'error',
        message: 'fetchPlaylist failed',
        error: err instanceof Error ? err.message : String(err),
        deviceId,
      }),
    );
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function downloadFile(url: string, destPath: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
    }

    if (!response.body) {
      throw new Error(`Download failed: no response body for ${url}`);
    }

    const fileStream = createWriteStream(destPath);
    await pipeline(response.body as unknown as NodeJS.ReadableStream, fileStream);
  } catch (err) {
    // Clean up partial download on error
    try {
      if (existsSync(destPath)) {
        unlinkSync(destPath);
      }
    } catch {
      // Ignore cleanup errors
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
