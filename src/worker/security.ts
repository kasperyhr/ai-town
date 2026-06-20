import type { ApiError, Env } from './types';

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; connect-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
} as const;

export function jsonResponse<T>(body: T, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function emptyJsonResponse(init: ResponseInit = {}): Response {
  return jsonResponse({ ok: true }, init);
}

export function errorResponse(code: string, message: string, status = 400): Response {
  const body: ApiError = { error: { code, message } };
  return jsonResponse(body, { status });
}

export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function assertConfigured(env: Env): string[] {
  const missing: string[] = [];
  const required = [
    'APP_ORIGIN',
    'SESSION_SECRET',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'DEEPSEEK_API_KEY',
    'EXPORT_MASTER_KEYS_JSON',
  ] as const;

  for (const key of required) {
    if (!env[key] || env[key].startsWith('replace-')) {
      missing.push(key);
    }
  }
  if (env.EXPORT_MASTER_KEYS_JSON.includes('replace-')) {
    missing.push('EXPORT_MASTER_KEYS_JSON');
  }
  return missing;
}
