import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { activatePlaylist } from '@/lib/playlist';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const playlistId = parseInt(params.id, 10);
  if (isNaN(playlistId)) {
    return NextResponse.json(
      { error: 'Invalid playlist id', code: 'INVALID_ID' },
      { status: 400 },
    );
  }

  // deviceId comes from the request body
  let body: { deviceId?: string } = {};

  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text) as { deviceId?: string };
    }
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const deviceId = body.deviceId ?? '';

  if (!deviceId) {
    return NextResponse.json(
      { error: 'deviceId is required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  try {
    const result = await activatePlaylist(playlistId, deviceId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === 'PLAYLIST_NOT_FOUND') {
      return NextResponse.json(
        { error: 'Playlist not found', code: 'PLAYLIST_NOT_FOUND' },
        { status: 404 },
      );
    }
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
