import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { deletePlaylistItem } from '@/lib/playlist';
import { db } from '@/lib/db';

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

  const itemId = params.id;

  let body: {
    durationOverrideMs?: number | null;
    position?: number;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  try {
    const fields: string[] = [];
    const args: (number | null | string)[] = [];

    if (body.durationOverrideMs !== undefined) {
      fields.push('duration_override_ms = ?');
      args.push(body.durationOverrideMs);
    }

    if (body.position !== undefined) {
      fields.push('position = ?');
      args.push(body.position);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update', code: 'NO_FIELDS' },
        { status: 400 },
      );
    }

    args.push(itemId);

    await db.execute({
      sql: `UPDATE playlist_items SET ${fields.join(', ')} WHERE id = ?`,
      args,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
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

  const itemId = params.id;

  let body: { playlistId?: number };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  if (body.playlistId === undefined) {
    return NextResponse.json(
      { error: 'playlistId is required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  try {
    await deletePlaylistItem(itemId, body.playlistId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DB error:', error);
    return NextResponse.json(
      { error: 'database error', code: 'DB_ERROR' },
      { status: 500 },
    );
  }
}
