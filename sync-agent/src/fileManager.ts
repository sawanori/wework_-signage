import { writeFileSync, renameSync, unlinkSync, existsSync } from 'fs';
import { extname } from 'path';
import type { PlaylistResponse } from '@non-turn/shared';

export function moveFile(src: string, dest: string): void {
  renameSync(src, dest);
}

/**
 * Extract file extension from a URL.
 * e.g. "https://cdn.non-turn.com/kyokomachi/interior-01.jpg" → ".jpg"
 */
export function extractExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    return extname(pathname);
  } catch {
    // Fallback: treat the whole url as a path
    return extname(url);
  }
}

/**
 * Convert R2 URL to local path.
 * e.g. id="img_001", url="https://cdn.non-turn.com/kyokomachi/interior-01.jpg"
 *   → "/data/images/img_001.jpg"
 */
export function toLocalPath(id: string, url: string): string {
  const ext = extractExtFromUrl(url);
  return `/data/images/${id}${ext}`;
}

export function writePlaylistJson(
  playlistData: PlaylistResponse,
  playlistJsonPath: string,
  tmpPath: string,
): void {
  // Convert R2 URLs to local paths for the Local Viewer
  const localPlaylistData: PlaylistResponse = {
    ...playlistData,
    items: playlistData.items.map((item) => ({
      ...item,
      url: toLocalPath(item.id, item.url),
    })),
  };

  writeFileSync(tmpPath, JSON.stringify(localPlaylistData, null, 2), 'utf-8');
  renameSync(tmpPath, playlistJsonPath);
}

export function cleanupTmpFile(tmpFilePath: string): void {
  try {
    if (existsSync(tmpFilePath)) {
      unlinkSync(tmpFilePath);
    }
  } catch {
    // Ignore errors during cleanup
  }
}

export function handleWriteError(error: NodeJS.ErrnoException, tmpPath: string): void {
  console.error(
    JSON.stringify({
      level: 'alert',
      message: 'Write error occurred',
      code: error.code,
      errorMessage: error.message,
      tmpPath,
    }),
  );

  // Attempt cleanup of tmp file
  cleanupTmpFile(tmpPath);
}
