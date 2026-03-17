/**
 * Shared authentication utility for Cloud Admin API routes.
 */

export function checkAuth(request: Request): boolean {
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
