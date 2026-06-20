import { cookieNames, expireCookie, parseCookies } from './cookies';
import { hmacSha256, newId, randomToken } from './crypto';
import type { AuthContext, AuthenticatedUser, Env } from './types';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14;

interface SessionRow {
  id: string;
  csrf_token_hash: string;
  user_id: string;
  provider: 'github' | 'google';
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

export async function createSession(env: Env, userId: string): Promise<{
  sessionId: string;
  sessionToken: string;
  csrfToken: string;
  expiresAt: string;
}> {
  const sessionId = newId('ses');
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const sessionHash = await hmacSha256(env.SESSION_SECRET, sessionToken);
  const csrfTokenHash = await hmacSha256(env.SESSION_SECRET, csrfToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();

  await env.DB.prepare(
    `INSERT INTO sessions (id, user_id, session_hash, csrf_token_hash, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(sessionId, userId, sessionHash, csrfTokenHash, expiresAt)
    .run();

  return { sessionId, sessionToken, csrfToken, expiresAt };
}

export async function getAuthContext(request: Request, env: Env): Promise<AuthContext | null> {
  const cookies = parseCookies(request);
  const sessionToken = cookies.get(cookieNames.session);
  if (!sessionToken) return null;

  const sessionHash = await hmacSha256(env.SESSION_SECRET, sessionToken);
  const row = await env.DB.prepare(
    `SELECT
       sessions.id,
       sessions.csrf_token_hash,
       users.id AS user_id,
       users.provider,
       users.email,
       users.display_name,
       users.avatar_url
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.session_hash = ?
       AND sessions.revoked_at IS NULL
       AND sessions.expires_at > datetime('now')
     LIMIT 1`,
  )
    .bind(sessionHash)
    .first<SessionRow>();

  if (!row) return null;

  const user: AuthenticatedUser = {
    id: row.user_id,
    provider: row.provider,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };

  return {
    user,
    sessionId: row.id,
    csrfTokenHash: row.csrf_token_hash,
  };
}

export async function revokeSession(request: Request, env: Env): Promise<string[]> {
  const cookies = parseCookies(request);
  const sessionToken = cookies.get(cookieNames.session);
  if (sessionToken) {
    const sessionHash = await hmacSha256(env.SESSION_SECRET, sessionToken);
    await env.DB.prepare(
      `UPDATE sessions
       SET revoked_at = datetime('now')
       WHERE session_hash = ? AND revoked_at IS NULL`,
    )
      .bind(sessionHash)
      .run();
  }
  return [
    expireCookie(env, cookieNames.session),
    expireCookie(env, cookieNames.csrf),
    expireCookie(env, cookieNames.oauthState),
    expireCookie(env, cookieNames.oauthProvider),
  ];
}

export function sessionCookieMaxAge(): number {
  return SESSION_TTL_SECONDS;
}

export async function hasValidCsrf(request: Request, env: Env, auth: AuthContext): Promise<boolean> {
  const headerToken = request.headers.get('X-CSRF-Token');
  const cookieToken = parseCookies(request).get(cookieNames.csrf);
  if (!headerToken || !cookieToken || headerToken !== cookieToken) return false;

  const providedHash = await hmacSha256(env.SESSION_SECRET, headerToken);
  return providedHash === auth.csrfTokenHash;
}
