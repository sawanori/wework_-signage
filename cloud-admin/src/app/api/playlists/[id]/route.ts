import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { renamePlaylist, deletePlaylist } from '@/lib/playlist';

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

  let body: { name?: string; deviceId?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const name = (body.name ?? '').trim();

  if (!name || name.length === 0) {
    return NextResponse.json(
      { error: 'name is required (1-50 characters)', code: 'INVALID_NAME' },
      { status: 400 },
    );
  }

  if (name.length > 50) {
    return NextResponse.json(
      { error: 'name must be 50 characters or less', code: 'INVALID_NAME' },
      { status: 400 },
    );
  }

  try {
    const result = await renamePlaylist(playlistId, name);
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

export async function DELETE(
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

  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id') ?? '';

  if (!deviceId) {
    return NextResponse.json(
      { error: 'device_id is required', code: 'MISSING_DEVICE_ID' },
      { status: 400 },
    );
  }

  try {
    await deletePlaylist(playlistId, deviceId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PLAYLIST_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Playlist not found', code: 'PLAYLIST_NOT_FOUND' },
          { status: 404 },
        );
      }
      if (error.message === 'CANNOT_DELETE_ACTIVE') {
        return NextResponse.json(
          { error: 'Cannot delete active playlist', code: 'CANNOT_DELETE_ACTIVE' },
          { status: 409 },
        );
      }
    }
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
