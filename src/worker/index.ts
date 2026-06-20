import { assertConfigured, emptyJsonResponse, errorResponse, jsonResponse, withSecurityHeaders } from './security';
import { completeOAuth, isProvider, startOAuth } from './oauth';
import { getAuthContext, hasValidCsrf, revokeSession } from './session';
import { decryptWorldPackage, encryptWorldPackage, maxImportBytes } from './exportPackage';
import type { Env, TownBootstrap } from './types';
import {
  createDefaultWorld,
  deleteWorld,
  getWorldSnapshot,
  importWorldSnapshot,
  listWorlds,
  updateWorldName,
  updateWorldSettings,
} from './worlds';
import {
  createCharacter,
  createLexiconEntry,
  deleteCharacter,
  deleteLexiconEntry,
  getWorldContent,
  updateCharacter,
} from './content';
import { generateDailyStoriesForCron, generateNextStoryForUserWorld, getStoryByDay, listStoryHistory } from './stories';

const API_PREFIX = '/api/';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    try {
      if (url.pathname.startsWith(API_PREFIX)) {
        return await handleApi(request, env);
      }

      const assetResponse = await env.ASSETS.fetch(request);
      return withSecurityHeaders(assetResponse);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'unhandled_error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
      return errorResponse('internal_error', 'Unexpected server error.', 500);
    }
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runDailyStoryJob(env));
  },
};

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return jsonResponse({ ok: true });
  }

  const authMatch = url.pathname.match(/^\/api\/auth\/([^/]+)\/([^/]+)$/);
  if (authMatch) {
    const provider = authMatch[1];
    const action = authMatch[2];
    if (!isProvider(provider)) {
      return errorResponse('invalid_provider', 'Unsupported OAuth provider.', 404);
    }
    if (action === 'start' && request.method === 'GET') {
      return startOAuth(provider, request, env);
    }
    if (action === 'callback' && request.method === 'GET') {
      return completeOAuth(provider, request, env);
    }
  }

  if (url.pathname === '/api/health' && request.method === 'GET') {
    const missing = assertConfigured(env);
    return jsonResponse({
      ok: true,
      service: 'ai-town-cloudflare-deepseek',
      configured: missing.length === 0,
      missing,
    });
  }

  if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    const body: TownBootstrap = {
      authenticated: auth !== null,
      user: auth
        ? {
            id: auth.user.id,
            displayName: auth.user.displayName,
            provider: auth.user.provider,
          }
        : null,
      defaults: {
        language: 'en',
        characterCount: 3,
      },
      security: {
        sessionCookie: 'HttpOnly',
        csrfProtection: 'planned',
        dataIsolation: 'user_id',
      },
    };
    return jsonResponse(body);
  }

  if (url.pathname === '/api/me' && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    return jsonResponse({
      authenticated: auth !== null,
      user: auth?.user ?? null,
    });
  }

  if (url.pathname === '/api/worlds' && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    return jsonResponse({ worlds: await listWorlds(env, auth) });
  }

  if (url.pathname === '/api/worlds' && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);

    const body = (await request.json().catch(() => ({}))) as { name?: string; language?: 'en' | 'zh' };
    const createOptions: { name?: string; language?: 'en' | 'zh' } = {
      language: body.language === 'zh' ? 'zh' : 'en',
    };
    if (typeof body.name === 'string') createOptions.name = body.name;
    const worldId = await createDefaultWorld(env, auth.user.id, createOptions);
    return jsonResponse({ worldId }, { status: 201 });
  }

  const worldMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)$/);
  if (worldMatch && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    const worldId = worldMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const snapshot = await getWorldSnapshot(env, auth, worldId);
    if (!snapshot) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ world: snapshot.world, snapshot });
  }

  if (worldMatch && request.method === 'PATCH') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = worldMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const body = (await request.json().catch(() => ({}))) as { name?: string };
    if (typeof body.name !== 'string') return errorResponse('invalid_request', 'Story name is required.', 400);
    const world = await updateWorldName(env, auth, worldId, body.name);
    if (!world) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ world });
  }

  if (worldMatch && request.method === 'DELETE') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = worldMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const deleted = await deleteWorld(env, auth, worldId);
    if (!deleted) return errorResponse('not_found', 'Story not found.', 404);
    return emptyJsonResponse();
  }

  const settingsMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/settings$/);
  if (settingsMatch && request.method === 'PATCH') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = settingsMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const body = (await request.json().catch(() => ({}))) as { autoAdvanceEnabled?: boolean };
    const world = await updateWorldSettings(env, auth, worldId, {
      autoAdvanceEnabled: body.autoAdvanceEnabled === true,
    });
    if (!world) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ world });
  }

  const contentMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/content$/);
  if (contentMatch && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    const worldId = contentMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const content = await getWorldContent(env, auth, worldId);
    if (!content) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse(content);
  }

  const charactersMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/characters$/);
  if (charactersMatch && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = charactersMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const body = (await request.json().catch(() => ({}))) as CharacterInputBody;
    const character = await createCharacter(env, auth, worldId, body);
    if (!character) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ character }, { status: 201 });
  }

  const characterMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/characters\/([^/]+)$/);
  if (characterMatch && (request.method === 'PATCH' || request.method === 'DELETE')) {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = characterMatch[1];
    const characterId = characterMatch[2];
    if (!worldId || !characterId) return errorResponse('not_found', 'Character not found.', 404);

    if (request.method === 'PATCH') {
      const body = (await request.json().catch(() => ({}))) as CharacterInputBody;
      const character = await updateCharacter(env, auth, worldId, characterId, body);
      if (!character) return errorResponse('not_found', 'Character not found.', 404);
      return jsonResponse({ character });
    }

    const deleted = await deleteCharacter(env, auth, worldId, characterId);
    if (!deleted) return errorResponse('not_found', 'Character not found.', 404);
    return emptyJsonResponse();
  }

  const lexiconMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/lexicon$/);
  if (lexiconMatch && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = lexiconMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const body = (await request.json().catch(() => ({}))) as LexiconInputBody;
    const entry = await createLexiconEntry(env, auth, worldId, body);
    if (!entry) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ entry }, { status: 201 });
  }

  const lexiconItemMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/lexicon\/([^/]+)$/);
  if (lexiconItemMatch && request.method === 'DELETE') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = lexiconItemMatch[1];
    const lexiconId = lexiconItemMatch[2];
    if (!worldId || !lexiconId) return errorResponse('not_found', 'Lexicon entry not found.', 404);
    const deleted = await deleteLexiconEntry(env, auth, worldId, lexiconId);
    if (!deleted) return errorResponse('not_found', 'Lexicon entry not found.', 404);
    return emptyJsonResponse();
  }

  const generateMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/generate-day$/);
  if (generateMatch && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);
    const worldId = generateMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const body = (await request.json().catch(() => ({}))) as { language?: 'en' | 'zh' };
    const story = await generateNextStoryForUserWorld(env, auth.user.id, worldId, {
      language: body.language === 'zh' ? 'zh' : 'en',
    });
    if (!story) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ story }, { status: 201 });
  }

  const storyHistoryMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/stories$/);
  if (storyHistoryMatch && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    const worldId = storyHistoryMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const stories = await listStoryHistory(env, auth.user.id, worldId);
    if (!stories) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ stories });
  }

  const storyByDayMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/stories\/(\d+)$/);
  if (storyByDayMatch && request.method === 'GET') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    const worldId = storyByDayMatch[1];
    const dayNumber = Number(storyByDayMatch[2]);
    if (!worldId || !Number.isSafeInteger(dayNumber)) return errorResponse('not_found', 'Story not found.', 404);
    const story = await getStoryByDay(env, auth.user.id, worldId, dayNumber);
    if (!story) return errorResponse('not_found', 'Story not found.', 404);
    return jsonResponse({ story });
  }

  const exportMatch = url.pathname.match(/^\/api\/worlds\/([^/]+)\/export$/);
  if (exportMatch && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);

    const worldId = exportMatch[1];
    if (!worldId) return errorResponse('not_found', 'Story not found.', 404);
    const snapshot = await getWorldSnapshot(env, auth, worldId);
    if (!snapshot) return errorResponse('not_found', 'Story not found.', 404);
    const encrypted = await encryptWorldPackage(env, snapshot);
    const body = encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer;
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${safeFileName(snapshot.world.name)}.aitown"`,
        'Cache-Control': 'no-store',
      },
    });
  }

  if (url.pathname === '/api/worlds/import' && request.method === 'POST') {
    const auth = await getAuthContext(request, env);
    if (!auth) return errorResponse('unauthorized', 'Sign in required.', 401);
    if (!(await hasValidCsrf(request, env, auth))) return errorResponse('invalid_csrf', 'Invalid CSRF token.', 403);

    const contentLength = Number(request.headers.get('Content-Length') ?? 0);
    if (contentLength > maxImportBytes()) return errorResponse('file_too_large', 'Import file is too large.', 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > maxImportBytes()) return errorResponse('file_too_large', 'Import file is too large.', 413);

    const snapshot = await decryptWorldPackage(env, bytes);
    const worldId = await importWorldSnapshot(env, auth, snapshot);
    return jsonResponse({ worldId }, { status: 201 });
  }

  if (url.pathname === '/api/logout' && request.method === 'POST') {
    const expiredCookies = await revokeSession(request, env);
    const headers = new Headers();
    for (const cookie of expiredCookies) {
      headers.append('Set-Cookie', cookie);
    }
    return emptyJsonResponse({ headers });
  }

  return errorResponse('not_found', 'API route not found.', 404);
}

function safeFileName(value: string): string {
  const normalized = value.trim().replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '');
  return (normalized || 'ai-town-story').slice(0, 60);
}

async function runDailyStoryJob(env: Env): Promise<void> {
  await generateDailyStoriesForCron(env);
}

interface CharacterInputBody {
  name?: string;
  gender?: string;
  personality?: string;
  appearance?: string;
  backstory?: string;
}

interface LexiconInputBody {
  term?: string;
  description?: string;
  language?: 'en' | 'zh' | 'both';
}
