import { readdirSync, unlinkSync } from 'fs';
import { join, basename } from 'path';
import type { PlaylistItem } from '@non-turn/shared';

export function cleanupOldFiles(imagesDir: string, currentItems: PlaylistItem[]): void {
  // Build set of filenames that should be kept
  const keepFilenames = new Set<string>();
  for (const item of currentItems) {
    // Extract filename from url (e.g. "/data/images/img_001.jpg" → "img_001.jpg")
    const filename = basename(item.url);
    keepFilenames.add(filename);
  }

  // Also keep files by id pattern: id + any extension
  const keepIds = new Set<string>(currentItems.map((item) => item.id));

  let files: string[];
  try {
    files = readdirSync(imagesDir);
  } catch {
    return;
  }

  for (const file of files) {
    if (!keepFilenames.has(file)) {
      // Check if file matches any kept ID (e.g. "img_001.jpg" matches id "img_001")
      const fileBasename = file.replace(/\.[^.]+$/, '');
      if (!keepIds.has(fileBasename)) {
        try {
          unlinkSync(join(imagesDir, file));
        } catch {
          // Ignore errors during individual file deletion
        }
      }
    }
  }
}
