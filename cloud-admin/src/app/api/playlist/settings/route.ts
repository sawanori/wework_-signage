import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateVersion } from '@/lib/version';

export async function PUT(request: Request): Promise<Response> {
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: {
    playlistId?: number;
    fadeDurationMs?: number;
    intervalMs?: number;
    orientation?: 'portrait' | 'landscape';
  };

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
    const fields: string[] = [];
    const args: (number | string)[] = [];

    if (body.fadeDurationMs !== undefined) {
      fields.push('fade_duration_ms = ?');
      args.push(body.fadeDurationMs);
    }

    if (body.intervalMs !== undefined) {
      fields.push('interval_ms = ?');
      args.push(body.intervalMs);
    }

    if (body.orientation !== undefined) {
      fields.push('orientation = ?');
      args.push(body.orientation);
    }

    if (fields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update', code: 'NO_FIELDS' },
        { status: 400 },
      );
    }

    fields.push('version = ?', 'updated_at = unixepoch()');
    args.push(generateVersion(), body.playlistId);

    await db.execute({
      sql: `UPDATE playlists SET ${fields.join(', ')} WHERE id = ?`,
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
