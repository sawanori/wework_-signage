import { NextResponse } from 'next/server';
import { generatePresignedUrl } from '@/lib/r2';

const MAX_FILE_SIZE = 31_457_280; // fileSize >= 31457280 is rejected

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

function checkAuth(request: Request): boolean {
  const apiKey = process.env.ADMIN_API_KEY;
  // If ADMIN_API_KEY is not configured, skip auth in development/test environments
  if (!apiKey) {
    const nodeEnv = process.env.NODE_ENV;
    if (nodeEnv !== 'development' && nodeEnv !== 'test') {
      console.warn(
        JSON.stringify({
          level: 'warn',
          message: 'ADMIN_API_KEY is not set in production environment; denying request',
        }),
      );
      return false;
    }
    return true;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return false;

  return authHeader === `Bearer ${apiKey}`;
}

export async function POST(request: Request): Promise<Response> {
  // C-004: Auth check before JSON parse to prevent unnecessary body consumption
  if (!checkAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  let body: { filename?: string; contentType?: string; fileSize?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body', code: 'INVALID_BODY' },
      { status: 400 },
    );
  }

  const { filename, contentType, fileSize } = body;

  if (!filename || !contentType || fileSize === undefined) {
    return NextResponse.json(
      { error: 'filename, contentType, and fileSize are required', code: 'MISSING_FIELDS' },
      { status: 400 },
    );
  }

  if (fileSize >= MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size exceeds 30MB limit', code: 'FILE_TOO_LARGE' },
      { status: 400 },
    );
  }

  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: 'Unsupported content type', code: 'UNSUPPORTED_CONTENT_TYPE' },
      { status: 400 },
    );
  }

  try {
    const result = await generatePresignedUrl(filename, contentType);

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      fileId: result.fileId,
      publicUrl: result.publicUrl,
    });
  } catch (error) {
    console.error('R2 error:', error);
    return NextResponse.json(
      { error: 'Failed to generate upload URL', code: 'R2_ERROR' },
      { status: 500 },
    );
  }
}
