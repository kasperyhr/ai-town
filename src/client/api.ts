import type {
  Bootstrap,
  CharacterRecord,
  LexiconLanguage,
  LexiconRecord,
  Language,
  StoryRecord,
  WorldContent,
  WorldSummary,
} from './types';

export function csrfToken(): string {
  return (
    document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('ait_csrf='))
      ?.split('=')
      .slice(1)
      .join('=') ?? ''
  );
}

export function csrfHeaders(): HeadersInit {
  return { 'X-CSRF-Token': decodeURIComponent(csrfToken()) };
}

export async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T | null> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    credentials: 'same-origin',
  });
  if (!response.ok) return null;
  return (await response.json()) as T;
}

export async function getBootstrap(): Promise<Bootstrap> {
  return (await apiJson<Bootstrap>('/api/bootstrap')) ?? { authenticated: false, user: null };
}

export async function getHealth(): Promise<'healthy' | 'missing' | 'offline'> {
  try {
    const response = await fetch('/api/health', { headers: { Accept: 'application/json' } });
    if (!response.ok) return 'offline';
    const body = (await response.json()) as { configured?: boolean };
    return body.configured ? 'healthy' : 'missing';
  } catch {
    return 'offline';
  }
}

export async function listWorlds(): Promise<WorldSummary[]> {
  return (await apiJson<{ worlds: WorldSummary[] }>('/api/worlds'))?.worlds ?? [];
}

export async function getWorldContent(worldId: string): Promise<WorldContent> {
  return (
    (await apiJson<WorldContent>(`/api/worlds/${worldId}/content`)) ?? {
      characters: [],
      lexiconEntries: [],
      stories: [],
    }
  );
}

export async function createWorld(name: string, language: Language): Promise<string | null> {
  return (
    await apiJson<{ worldId: string }>('/api/worlds', {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({ name, language }),
    })
  )?.worldId ?? null;
}

export async function deleteWorld(worldId: string): Promise<void> {
  await fetch(`/api/worlds/${worldId}`, { method: 'DELETE', headers: csrfHeaders(), credentials: 'same-origin' });
}

export async function renameWorld(worldId: string, name: string): Promise<WorldSummary | null> {
  return (
    await apiJson<{ world: WorldSummary }>(`/api/worlds/${worldId}`, {
      method: 'PATCH',
      headers: csrfHeaders(),
      body: JSON.stringify({ name }),
    })
  )?.world ?? null;
}

export async function exportWorld(world: WorldSummary): Promise<void> {
  const response = await fetch(`/api/worlds/${world.id}/export`, {
    method: 'POST',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
  if (!response.ok) return;
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${world.name.replace(/[^a-zA-Z0-9-_]+/g, '-') || 'ai-town-story'}.aitown`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importWorld(file: File): Promise<string | null> {
  const response = await fetch('/api/worlds/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream', ...csrfHeaders() },
    credentials: 'same-origin',
    body: file,
  });
  if (!response.ok) return null;
  return ((await response.json()) as { worldId: string }).worldId;
}

export async function saveCharacter(
  worldId: string,
  characterId: string | null,
  payload: Pick<CharacterRecord, 'name' | 'gender' | 'personality' | 'appearance' | 'backstory'>,
): Promise<CharacterRecord | null> {
  const result = await apiJson<{ character: CharacterRecord }>(
    characterId ? `/api/worlds/${worldId}/characters/${characterId}` : `/api/worlds/${worldId}/characters`,
    {
      method: characterId ? 'PATCH' : 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify(payload),
    },
  );
  return result?.character ?? null;
}

export async function removeCharacter(worldId: string, characterId: string): Promise<void> {
  await fetch(`/api/worlds/${worldId}/characters/${characterId}`, {
    method: 'DELETE',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
}

export async function addLexicon(
  worldId: string,
  payload: { term: string; description: string; language: LexiconLanguage },
): Promise<LexiconRecord | null> {
  return (
    await apiJson<{ entry: LexiconRecord }>(`/api/worlds/${worldId}/lexicon`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify(payload),
    })
  )?.entry ?? null;
}

export async function deleteLexicon(worldId: string, entryId: string): Promise<void> {
  await fetch(`/api/worlds/${worldId}/lexicon/${entryId}`, {
    method: 'DELETE',
    headers: csrfHeaders(),
    credentials: 'same-origin',
  });
}

export async function generateNextDay(worldId: string, language: Language): Promise<StoryRecord | null> {
  return (
    await apiJson<{ story: StoryRecord }>(`/api/worlds/${worldId}/generate-day`, {
      method: 'POST',
      headers: csrfHeaders(),
      body: JSON.stringify({ language }),
    })
  )?.story ?? null;
}

export async function updateAutoAdvance(worldId: string, autoAdvanceEnabled: boolean): Promise<WorldSummary | null> {
  return (
    await apiJson<{ world: WorldSummary }>(`/api/worlds/${worldId}/settings`, {
      method: 'PATCH',
      headers: csrfHeaders(),
      body: JSON.stringify({ autoAdvanceEnabled }),
    })
  )?.world ?? null;
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', { method: 'POST', headers: { Accept: 'application/json' }, credentials: 'same-origin' });
}
