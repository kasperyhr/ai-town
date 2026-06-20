import type { Env } from './types';

const SESSION_COOKIE = 'ait_session';
const CSRF_COOKIE = 'ait_csrf';
const OAUTH_STATE_COOKIE = 'ait_oauth_state';
const OAUTH_PROVIDER_COOKIE = 'ait_oauth_provider';

export const cookieNames = {
  session: SESSION_COOKIE,
  csrf: CSRF_COOKIE,
  oauthState: OAUTH_STATE_COOKIE,
  oauthProvider: OAUTH_PROVIDER_COOKIE,
} as const;

export function parseCookies(request: Request): Map<string, string> {
  const header = request.headers.get('Cookie') ?? '';
  const cookies = new Map<string, string>();
  for (const part of header.split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName || rawValue.length === 0) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join('=')));
  }
  return cookies;
}

export function buildCookie(
  env: Env,
  name: string,
  value: string,
  options: {
    maxAgeSeconds?: number;
    httpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict';
    path?: string;
  } = {},
): string {
  const secure = env.COOKIE_SECURE === 'false' ? false : new URL(env.APP_ORIGIN).protocol === 'https:';
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path ?? '/'}`,
    `SameSite=${options.sameSite ?? 'Lax'}`,
  ];

  if (options.httpOnly ?? true) parts.push('HttpOnly');
  if (secure) parts.push('Secure');
  if (options.maxAgeSeconds !== undefined) parts.push(`Max-Age=${options.maxAgeSeconds}`);

  return parts.join('; ');
}

export function expireCookie(env: Env, name: string): string {
  return buildCookie(env, name, '', { maxAgeSeconds: 0 });
}
