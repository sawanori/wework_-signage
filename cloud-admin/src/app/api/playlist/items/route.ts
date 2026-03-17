import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { addPlaylistItem } from '@/lib/playlist';
import { db } from '@/lib/db';

export async function POST(request: Request): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const deviceId = (body.deviceId as string) ?? '';
  const itemId = (body.itemId as string) ?? (body.id as string) ?? '';
  const publicUrl = (body.publicUrl as string) ?? '';
  const fileType = (body.fileType as string) ?? 'image';
  const originalFilename = (body.originalFilename as string) ?? '';
  const hash = (body.hash as string) ?? '';
  const fileSize = (body.fileSize as number) ?? (body.fileSizeBytes as number) ?? 0;
  const durationOverrideMs = (body.durationOverrideMs as number | null) ?? null;

  if (!deviceId || !itemId || !publicUrl) {
    return NextResponse.json(
      { error: 'Missing required fields (deviceId, itemId, publicUrl)', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  try {
    // Get playlist for this device
    const playlistResult = await db.execute({
      sql: 'SELECT id, store_id FROM playlists WHERE device_id = ?',
      args: [deviceId],
    });

    if (playlistResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Device not found', code: 'DEVICE_NOT_FOUND' },
        { status: 404 },
      );
    }

    const playlist = playlistResult.rows[0];
    const playlistId = playlist.id as number;
    const storeId = playlist.store_id as string;

    // Get next position
    const posResult = await db.execute({
      sql: 'SELECT COALESCE(MAX(position), 0) + 1 as next_pos FROM playlist_items WHERE playlist_id = ?',
      args: [playlistId],
    });
    const position = (posResult.rows[0].next_pos as number) ?? 1;

    await addPlaylistItem({
      playlistId,
      id: itemId,
      r2Url: publicUrl,
      publicUrl,
      hash,
      fileType,
      originalFilename,
      fileSizeBytes: fileSize,
      durationOverrideMs,
      position,
      storeId,
      deviceId,
    });

    return NextResponse.json({ success: true, id: itemId }, { status: 201 });
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
