import { buildCookie, cookieNames, parseCookies } from './cookies';
import { newId, randomToken } from './crypto';
import { createSession, sessionCookieMaxAge } from './session';
import type { AuthenticatedUser, Env } from './types';
import { createDefaultWorld } from './worlds';

type Provider = 'github' | 'google';

interface OAuthProfile {
  provider: Provider;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

interface UserRow {
  id: string;
  provider: Provider;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}

export function isProvider(value: string | undefined): value is Provider {
  return value === 'github' || value === 'google';
}

export function startOAuth(provider: Provider, request: Request, env: Env): Response {
  const state = randomToken();
  const redirectUri = callbackUrl(provider, env);
  const authUrl = provider === 'github' ? githubAuthorizeUrl(env, redirectUri, state) : googleAuthorizeUrl(env, redirectUri, state);

  const headers = new Headers({ Location: authUrl.toString() });
  headers.append(
    'Set-Cookie',
    buildCookie(env, cookieNames.oauthState, state, { maxAgeSeconds: 600, httpOnly: true }),
  );
  headers.append(
    'Set-Cookie',
    buildCookie(env, cookieNames.oauthProvider, provider, { maxAgeSeconds: 600, httpOnly: true }),
  );

  return new Response(null, { status: 302, headers });
}

export async function completeOAuth(provider: Provider, request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  if (!code || !state) {
    return redirectWithError(env, 'missing_oauth_code');
  }

  const cookies = parseCookies(request);
  if (cookies.get(cookieNames.oauthState) !== state || cookies.get(cookieNames.oauthProvider) !== provider) {
    return redirectWithError(env, 'invalid_oauth_state');
  }

  const redirectUri = callbackUrl(provider, env);
  const profile =
    provider === 'github'
      ? await fetchGitHubProfile(env, code, redirectUri)
      : await fetchGoogleProfile(env, code, redirectUri);

  const user = await upsertOAuthUser(env, profile);
  const session = await createSession(env, user.id);

  const headers = new Headers({ Location: new URL('/', env.APP_ORIGIN).toString() });
  headers.append(
    'Set-Cookie',
    buildCookie(env, cookieNames.session, session.sessionToken, {
      maxAgeSeconds: sessionCookieMaxAge(),
      httpOnly: true,
    }),
  );
  headers.append(
    'Set-Cookie',
    buildCookie(env, cookieNames.csrf, session.csrfToken, {
      maxAgeSeconds: sessionCookieMaxAge(),
      httpOnly: false,
    }),
  );
  headers.append('Set-Cookie', buildCookie(env, cookieNames.oauthState, '', { maxAgeSeconds: 0 }));
  headers.append('Set-Cookie', buildCookie(env, cookieNames.oauthProvider, '', { maxAgeSeconds: 0 }));

  return new Response(null, { status: 302, headers });
}

function callbackUrl(provider: Provider, env: Env): string {
  return new URL(`/api/auth/${provider}/callback`, env.APP_ORIGIN).toString();
}

function githubAuthorizeUrl(env: Env, redirectUri: string, state: string): URL {
  const url = new URL('https://github.com/login/oauth/authorize');
  url.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'read:user user:email');
  return url;
}

function googleAuthorizeUrl(env: Env, redirectUri: string, state: string): URL {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid email profile');
  url.searchParams.set('prompt', 'select_account');
  return url;
}

async function fetchGitHubProfile(env: Env, code: string, redirectUri: string): Promise<OAuthProfile> {
  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  });
  const tokenJson = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenJson.access_token) {
    throw new Error(`GitHub token exchange failed: ${tokenJson.error ?? tokenResponse.status}`);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${tokenJson.access_token}`,
      'User-Agent': 'ai-town-cloudflare-deepseek',
    },
  });
  const githubUser = (await userResponse.json()) as {
    id: number;
    login: string;
    name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  };
  if (!userResponse.ok) throw new Error(`GitHub profile fetch failed: ${userResponse.status}`);

  let email = githubUser.email ?? null;
  if (!email) {
    const emailResponse = await fetch('https://api.github.com/user/emails', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenJson.access_token}`,
        'User-Agent': 'ai-town-cloudflare-deepseek',
      },
    });
    if (emailResponse.ok) {
      const emails = (await emailResponse.json()) as Array<{
        email: string;
        primary: boolean;
        verified: boolean;
      }>;
      email = emails.find((item) => item.primary && item.verified)?.email ?? null;
    }
  }

  return {
    provider: 'github',
    providerUserId: String(githubUser.id),
    email,
    displayName: githubUser.name || githubUser.login,
    avatarUrl: githubUser.avatar_url ?? null,
  };
}

async function fetchGoogleProfile(env: Env, code: string, redirectUri: string): Promise<OAuthProfile> {
  const form = new URLSearchParams();
  form.set('client_id', env.GOOGLE_CLIENT_ID);
  form.set('client_secret', env.GOOGLE_CLIENT_SECRET);
  form.set('code', code);
  form.set('grant_type', 'authorization_code');
  form.set('redirect_uri', redirectUri);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form,
  });
  const tokenJson = (await tokenResponse.json()) as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenJson.access_token) {
    throw new Error(`Google token exchange failed: ${tokenJson.error ?? tokenResponse.status}`);
  }

  const userResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${tokenJson.access_token}`,
    },
  });
  const googleUser = (await userResponse.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!userResponse.ok) throw new Error(`Google profile fetch failed: ${userResponse.status}`);

  return {
    provider: 'google',
    providerUserId: googleUser.sub,
    email: googleUser.email ?? null,
    displayName: googleUser.name || googleUser.email || 'Google user',
    avatarUrl: googleUser.picture ?? null,
  };
}

async function upsertOAuthUser(env: Env, profile: OAuthProfile): Promise<AuthenticatedUser> {
  const existing = await env.DB.prepare(
    `SELECT id, provider, email, display_name, avatar_url
     FROM users
     WHERE provider = ? AND provider_user_id = ?
     LIMIT 1`,
  )
    .bind(profile.provider, profile.providerUserId)
    .first<UserRow>();

  if (existing) {
    await env.DB.prepare(
      `UPDATE users
       SET email = ?, display_name = ?, avatar_url = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
      .bind(profile.email, profile.displayName, profile.avatarUrl, existing.id)
      .run();
    return {
      id: existing.id,
      provider: existing.provider,
      email: profile.email,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
    };
  }

  const id = newId('usr');
  await env.DB.prepare(
    `INSERT INTO users (id, provider, provider_user_id, email, display_name, avatar_url)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, profile.provider, profile.providerUserId, profile.email, profile.displayName, profile.avatarUrl)
    .run();
  await createDefaultWorld(env, id);

  return {
    id,
    provider: profile.provider,
    email: profile.email,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
  };
}

function redirectWithError(env: Env, code: string): Response {
  const url = new URL('/', env.APP_ORIGIN);
  url.searchParams.set('auth_error', code);
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString() },
  });
}
