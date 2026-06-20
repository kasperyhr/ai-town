import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactElement } from 'react';
import * as api from './api';
import { PencilIcon } from './icons';
import { makeTranslator, type Translator } from './i18n';
import { currentVersion, releaseNotes } from './releases';
import type { Bootstrap, CharacterRecord, Language, LexiconLanguage, StoryBeat, WorldContent, WorldSummary } from './types';
import { Editors } from './components/Editors';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { MapFocus, TownMap } from './components/TownMap';

const emptyContent: WorldContent = { characters: [], lexiconEntries: [], stories: [] };

function getStoredLanguage(): Language {
  return localStorage.getItem('language') === 'zh' ? 'zh' : 'en';
}

function clampBeatIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(Math.max(index, 0), count - 1);
}

export function App(): ReactElement {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);
  const [bootstrap, setBootstrap] = useState<Bootstrap>({ authenticated: false, user: null });
  const [worlds, setWorlds] = useState<WorldSummary[]>([]);
  const [selectedWorldId, setSelectedWorldId] = useState<string | null>(null);
  const [content, setContent] = useState<WorldContent>(emptyContent);
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [selectedHistoryDay, setSelectedHistoryDay] = useState<number | null>(null);
  const [selectedBeatIndex, setSelectedBeatIndex] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(localStorage.getItem('storySidebarOpen') !== 'false');
  const [editingWorldName, setEditingWorldName] = useState(false);
  const [health, setHealth] = useState<'healthy' | 'missing' | 'offline'>('offline');
  const [hash, setHash] = useState(window.location.hash);
  const t = useMemo(() => makeTranslator(language), [language]);

  const selectedWorld = useMemo(
    () => worlds.find((world) => world.id === selectedWorldId) ?? worlds[0] ?? null,
    [selectedWorldId, worlds],
  );
  const selectedStory = useMemo(
    () => content.stories.find((story) => story.dayNumber === selectedHistoryDay) ?? content.stories[0] ?? null,
    [content.stories, selectedHistoryDay],
  );
  const selectedBeat: StoryBeat | null = selectedStory?.beats?.[clampBeatIndex(selectedBeatIndex, selectedStory.beats.length)] ?? null;
  const showStatusPage = hash === '#status';

  const refreshContent = useCallback(async (worldId: string | null): Promise<void> => {
    if (!worldId) {
      setContent(emptyContent);
      setSelectedHistoryDay(null);
      setSelectedBeatIndex(0);
      return;
    }
    const nextContent = await api.getWorldContent(worldId);
    setContent(nextContent);
    setEditingCharacterId((current) =>
      current && nextContent.characters.some((item) => item.id === current) ? current : nextContent.characters[0]?.id ?? null,
    );
    setSelectedHistoryDay((current) =>
      current && nextContent.stories.some((story) => story.dayNumber === current) ? current : nextContent.stories[0]?.dayNumber ?? null,
    );
    setSelectedBeatIndex((current) => clampBeatIndex(current, nextContent.stories[0]?.beats.length ?? 0));
  }, []);

  const refreshWorlds = useCallback(async (preferredWorldId?: string | null): Promise<void> => {
    if (!bootstrap.authenticated) {
      setWorlds([]);
      setSelectedWorldId(null);
      setContent(emptyContent);
      return;
    }
    const nextWorlds = await api.listWorlds();
    setWorlds(nextWorlds);
    const nextSelected =
      preferredWorldId && nextWorlds.some((world) => world.id === preferredWorldId)
        ? preferredWorldId
        : selectedWorldId && nextWorlds.some((world) => world.id === selectedWorldId)
          ? selectedWorldId
          : nextWorlds[0]?.id ?? null;
    setSelectedWorldId(nextSelected);
    await refreshContent(nextSelected);
  }, [bootstrap.authenticated, refreshContent, selectedWorldId]);

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    localStorage.setItem('language', language);
  }, [language]);

  useEffect(() => {
    const handler = (): void => setHash(window.location.hash);
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  useEffect(() => {
    void (async () => {
      const nextBootstrap = await api.getBootstrap();
      setBootstrap(nextBootstrap);
    })();
  }, []);

  useEffect(() => {
    void refreshWorlds();
  }, [bootstrap.authenticated]);

  useEffect(() => {
    void api.getHealth().then(setHealth);
  }, [hash, bootstrap.authenticated]);

  const createStory = async (): Promise<void> => {
    const worldId = await api.createWorld(language === 'zh' ? '新故事' : 'New Story', language);
    if (!worldId) return;
    setEditingCharacterId(null);
    setSelectedHistoryDay(null);
    setSelectedBeatIndex(0);
    await refreshWorlds(worldId);
  };

  const selectWorld = async (worldId: string): Promise<void> => {
    setSelectedWorldId(worldId);
    setEditingCharacterId(null);
    setSelectedHistoryDay(null);
    setSelectedBeatIndex(0);
    await refreshContent(worldId);
  };

  const renameWorld = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!selectedWorldId) return;
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get('worldName') ?? '').trim();
    if (!name) return;
    const world = await api.renameWorld(selectedWorldId, name);
    if (!world) return;
    setWorlds((items) => items.map((item) => (item.id === world.id ? world : item)));
    setEditingWorldName(false);
  };

  const generateDay = async (): Promise<void> => {
    if (!selectedWorldId || isGenerating) return;
    setIsGenerating(true);
    setGenerationError(null);
    const story = await api.generateNextDay(selectedWorldId, language);
    setIsGenerating(false);
    if (!story) {
      setGenerationError(t('generationFailed'));
      return;
    }
    setSelectedHistoryDay(story.dayNumber);
    setSelectedBeatIndex(0);
    await refreshWorlds(selectedWorldId);
  };

  const saveCharacter = async (
    payload: Pick<CharacterRecord, 'name' | 'gender' | 'personality' | 'appearance' | 'backstory'>,
  ): Promise<void> => {
    if (!selectedWorldId) return;
    const character = await api.saveCharacter(selectedWorldId, editingCharacterId, payload);
    if (!character) return;
    setEditingCharacterId(character.id);
    await refreshWorlds(selectedWorldId);
  };

  const removeCharacter = async (characterId: string): Promise<void> => {
    if (!selectedWorldId) return;
    await api.removeCharacter(selectedWorldId, characterId);
    setEditingCharacterId(null);
    await refreshWorlds(selectedWorldId);
  };

  const addLexicon = async (payload: { term: string; description: string; language: LexiconLanguage }): Promise<void> => {
    if (!selectedWorldId) return;
    await api.addLexicon(selectedWorldId, payload);
    await refreshWorlds(selectedWorldId);
  };

  const deleteLexicon = async (entryId: string): Promise<void> => {
    if (!selectedWorldId) return;
    await api.deleteLexicon(selectedWorldId, entryId);
    await refreshWorlds(selectedWorldId);
  };

  const signOut = async (): Promise<void> => {
    await api.logout();
    setBootstrap(await api.getBootstrap());
    setWorlds([]);
    setSelectedWorldId(null);
    setContent(emptyContent);
  };

  return (
    <main className={`shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <Topbar bootstrap={bootstrap} language={language} showStatusPage={showStatusPage} t={t} onLanguageChange={setLanguageState} />
      {new URLSearchParams(window.location.search).has('auth_error') ? <div className="alert">{t('authError')}</div> : null}
      <Sidebar
        bootstrap={bootstrap}
        open={sidebarOpen}
        worlds={worlds}
        selectedWorldId={selectedWorldId}
        t={t}
        onToggle={() => {
          const next = !sidebarOpen;
          setSidebarOpen(next);
          localStorage.setItem('storySidebarOpen', String(next));
        }}
        onCreate={() => void createStory()}
        onSelect={(worldId) => void selectWorld(worldId)}
        onExport={(world) => void api.exportWorld(world)}
        onDelete={(worldId) => void api.deleteWorld(worldId).then(() => refreshWorlds(null))}
        onImport={(file) => void api.importWorld(file).then((worldId) => refreshWorlds(worldId))}
        onLogout={() => void signOut()}
      />

      {showStatusPage ? (
        <StatusPage health={health} language={language} t={t} />
      ) : (
        <section className="workspace-layout">
          <section className="main-column">
            <section className="town-panel" aria-label={t('town')}>
              <TownMap language={language} world={selectedWorld} characters={content.characters} beat={selectedBeat} t={t} />
              <div className="town-caption">
                <div className="town-caption-header">
                  <div>
                    {selectedWorld ? (
                      <WorldTitle
                        world={selectedWorld}
                        editing={editingWorldName}
                        t={t}
                        onEdit={() => setEditingWorldName(true)}
                        onSubmit={(event) => void renameWorld(event)}
                      />
                    ) : (
                      <h2>{t('town')}</h2>
                    )}
                    <p>{selectedWorld ? `${t('characters')}: ${content.characters.length} · ${t('memories')}: ${selectedWorld.memoryCount}` : ''}</p>
                  </div>
                  <BeatControls
                    count={selectedStory?.beats.length ?? 0}
                    index={selectedBeatIndex}
                    t={t}
                    onStep={(step) => setSelectedBeatIndex((current) => clampBeatIndex(current + step, selectedStory?.beats.length ?? 0))}
                  />
                </div>
                <MapFocus language={language} beat={selectedBeat} t={t} />
                {generationError ? <div className="alert compact-alert">{generationError}</div> : null}
                {bootstrap.authenticated && selectedWorld ? (
                  <div className="town-actions">
                    <button type="button" className="auth-button secondary" onClick={() => void generateDay()}>
                      {isGenerating ? t('generating') : t('generateNextDay')}
                    </button>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={selectedWorld.autoAdvanceEnabled}
                        onChange={(event) =>
                          void api.updateAutoAdvance(selectedWorld.id, event.target.checked).then((world) => {
                            if (world) setWorlds((items) => items.map((item) => (item.id === world.id ? world : item)));
                          })
                        }
                      />
                      <span>{t('autoAdvance')}</span>
                      <small>{t('autoAdvanceOff')}</small>
                    </label>
                  </div>
                ) : !bootstrap.authenticated ? (
                  <p>{t('loginPrompt')}</p>
                ) : null}
              </div>
            </section>

            {bootstrap.authenticated && selectedWorld ? (
              <Editors
                language={language}
                characters={content.characters}
                lexiconEntries={content.lexiconEntries}
                stories={content.stories}
                editingCharacterId={editingCharacterId}
                selectedDay={selectedHistoryDay}
                selectedBeatIndex={selectedBeatIndex}
                t={t}
                onNewCharacter={() => setEditingCharacterId(null)}
                onEditCharacter={setEditingCharacterId}
                onSaveCharacter={(payload) => void saveCharacter(payload)}
                onRemoveCharacter={(id) => void removeCharacter(id)}
                onAddLexicon={(payload) => void addLexicon(payload)}
                onDeleteLexicon={(id) => void deleteLexicon(id)}
                onSelectDay={(day) => {
                  setSelectedHistoryDay(day);
                  setSelectedBeatIndex(0);
                }}
              />
            ) : null}
          </section>
        </section>
      )}
    </main>
  );
}

function StatusPage({
  health,
  language,
  t,
}: {
  health: 'healthy' | 'missing' | 'offline';
  language: Language;
  t: Translator;
}): ReactElement {
  const current = releaseNotes.find((release) => release.version === currentVersion) ?? releaseNotes[0]!;
  return (
    <section className="status-page panel">
      <div className="release-hero">
        <div>
          <p className="eyebrow">{t('status')}</p>
          <h2>{current.title[language]}</h2>
          <p>{t('statusBody')}</p>
        </div>
        <div className="version-badge">{currentVersion}</div>
      </div>

      <div className="version-grid">
        <div>
          <span>{t('currentVersion')}</span>
          <strong>{currentVersion}</strong>
        </div>
        <div>
          <span>{t('releaseDate')}</span>
          <strong>{current.date}</strong>
        </div>
        <div>
          <span>{t('buildHealth')}</span>
          <strong className="status-dot inline-status" data-status={health}>
            {health === 'healthy' ? t('apiHealthy') : health === 'missing' ? t('apiMissing') : t('apiOffline')}
          </strong>
        </div>
      </div>

      <div className="release-list">
        <h3>{t('updateHistory')}</h3>
        {releaseNotes.map((release) => (
          <article className="release-item" key={release.version}>
            <div className="release-item-header">
              <div>
                <strong>{release.version}</strong>
                <h4>{release.title[language]}</h4>
              </div>
              <time>{release.date}</time>
            </div>
            <ul>
              {release.changes[language].map((change) => (
                <li key={change}>{change}</li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorldTitle({
  world,
  editing,
  t,
  onEdit,
  onSubmit,
}: {
  world: WorldSummary;
  editing: boolean;
  t: Translator;
  onEdit: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}): ReactElement {
  if (editing) {
    return (
      <form className="rename-form" onSubmit={onSubmit}>
        <input name="worldName" maxLength={80} defaultValue={world.name} aria-label={t('renameStory')} required autoFocus />
        <button type="submit" className="small-button">
          {t('saveName')}
        </button>
      </form>
    );
  }
  return (
    <div className="editable-title">
      <h2>{world.name}</h2>
      <button type="button" className="icon-button title-edit-button" aria-label={t('renameStory')} title={t('renameStory')} onClick={onEdit}>
        <PencilIcon />
      </button>
    </div>
  );
}

function BeatControls({
  count,
  index,
  t,
  onStep,
}: {
  count: number;
  index: number;
  t: Translator;
  onStep: (step: number) => void;
}): ReactElement | null {
  if (count <= 0) return null;
  return (
    <div className="top-beat-actions" aria-label={t('timeline')}>
      <button type="button" className="small-button beat-nav" disabled={index <= 0} onClick={() => onStep(-1)}>
        {t('previousBeat')}
      </button>
      <span className="beat-count">
        {index + 1}/{count}
      </span>
      <button type="button" className="small-button beat-nav" disabled={index >= count - 1} onClick={() => onStep(1)}>
        {t('nextBeat')}
      </button>
    </div>
  );
}
