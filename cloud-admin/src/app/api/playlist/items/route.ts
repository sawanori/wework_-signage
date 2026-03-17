import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { addPlaylistItem } from '@/lib/playlist';

export async function POST(request: Request): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: {
    playlistId?: number;
    id?: string;
    r2Url?: string;
    publicUrl?: string;
    hash?: string;
    fileType?: string;
    originalFilename?: string;
    fileSizeBytes?: number;
    durationOverrideMs?: number | null;
    position?: number;
    storeId?: string;
    deviceId?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const {
    playlistId,
    id,
    r2Url,
    publicUrl,
    hash,
    fileType,
    originalFilename,
    fileSizeBytes,
    durationOverrideMs,
    position,
    storeId,
    deviceId,
  } = body;

  if (
    playlistId === undefined ||
    !id ||
    !r2Url ||
    !publicUrl ||
    !hash ||
    !fileType ||
    !originalFilename ||
    fileSizeBytes === undefined ||
    position === undefined ||
    !storeId ||
    !deviceId
  ) {
    return NextResponse.json(
      { error: 'Missing required fields', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  try {
    await addPlaylistItem({
      playlistId,
      id,
      r2Url,
      publicUrl,
      hash,
      fileType,
      originalFilename,
      fileSizeBytes,
      durationOverrideMs: durationOverrideMs ?? null,
      position,
      storeId,
      deviceId,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
