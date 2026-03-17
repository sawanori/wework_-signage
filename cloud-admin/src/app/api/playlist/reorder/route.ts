import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { reorderPlaylistItems } from '@/lib/playlist';

export async function POST(request: Request): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: { playlistId?: number; orderedIds?: string[] };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  if (body.playlistId === undefined || !Array.isArray(body.orderedIds)) {
    return NextResponse.json(
      { error: 'playlistId and orderedIds are required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  try {
    await reorderPlaylistItems(body.playlistId, body.orderedIds);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
