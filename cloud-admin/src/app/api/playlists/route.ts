import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { getPlaylistSummaries, createPlaylist } from '@/lib/playlist';

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const deviceId = url.searchParams.get('device_id');

  if (!deviceId) {
    return NextResponse.json(
      { error: 'device_id is required', code: 'MISSING_DEVICE_ID' },
      { status: 400 },
    );
  }

  try {
    const result = await getPlaylistSummaries(deviceId);

    if (!result) {
      return NextResponse.json(
        { error: 'Device not found', code: 'DEVICE_NOT_FOUND' },
        { status: 404 },
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: { deviceId?: string; name?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const deviceId = body.deviceId ?? '';
  const name = (body.name ?? '').trim();

  if (!deviceId) {
    return NextResponse.json(
      { error: 'deviceId is required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

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
    const result = await createPlaylist(deviceId, name);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'PLAYLIST_LIMIT_EXCEEDED') {
        return NextResponse.json(
          { error: 'Maximum playlist limit (3) reached', code: 'PLAYLIST_LIMIT_EXCEEDED' },
          { status: 422 },
        );
      }
      if (error.message === 'DEVICE_NOT_FOUND') {
        return NextResponse.json(
          { error: 'Device not found', code: 'DEVICE_NOT_FOUND' },
          { status: 404 },
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
