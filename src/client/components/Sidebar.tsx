import type { ChangeEvent, ReactElement } from 'react';
import { PlusIcon, SidebarIcon, UploadIcon } from '../icons';
import type { Translator } from '../i18n';
import type { Bootstrap, WorldSummary } from '../types';

type Props = {
  bootstrap: Bootstrap;
  open: boolean;
  worlds: WorldSummary[];
  selectedWorldId: string | null;
  t: Translator;
  onToggle: () => void;
  onCreate: () => void;
  onSelect: (worldId: string) => void;
  onExport: (world: WorldSummary) => void;
  onDelete: (worldId: string) => void;
  onImport: (file: File) => void;
  onLogout: () => void;
};

export function Sidebar({
  bootstrap,
  open,
  worlds,
  selectedWorldId,
  t,
  onToggle,
  onCreate,
  onSelect,
  onExport,
  onDelete,
  onImport,
  onLogout,
}: Props): ReactElement | null {
  if (!bootstrap.authenticated) return null;

  const handleImport = (event: ChangeEvent<HTMLInputElement>): void => {
    const file = event.target.files?.[0];
    if (file) onImport(file);
    event.target.value = '';
  };

  return (
    <aside className="story-sidebar" aria-label={t('storySaves')}>
      <div className="sidebar-header">
        <button
          type="button"
          className="icon-button sidebar-toggle"
          aria-label={open ? t('hideSaves') : t('showSaves')}
          title={open ? t('hideSaves') : t('showSaves')}
          onClick={onToggle}
        >
          <SidebarIcon />
        </button>
        <button type="button" className="icon-button" aria-label={t('createStory')} title={t('createStory')} onClick={onCreate}>
          <PlusIcon />
        </button>
      </div>
      <div className="sidebar-body">
        <h2>{t('storySaves')}</h2>
        {worlds.length === 0 ? (
          <p>{t('noStories')}</p>
        ) : (
          <div className="world-list">
            {worlds.map((world) => (
              <article className={`world-item ${world.id === selectedWorldId ? 'selected' : ''}`} key={world.id}>
                <button type="button" className="world-select" onClick={() => onSelect(world.id)}>
                  <strong>{world.name}</strong>
                  <span>
                    Day {world.storyDay} · {world.characterCount} {t('characters')} · {world.storyCount} stories
                  </span>
                </button>
                <div className="world-actions">
                  <button type="button" className="small-button" onClick={() => onExport(world)}>
                    {t('exportStory')}
                  </button>
                  <button type="button" className="icon-danger" aria-label={t('deleteStory')} onClick={() => onDelete(world.id)}>
                    ×
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <div className="sidebar-footer">
        <label className="file-button icon-file-button" title={t('importStory')}>
          <UploadIcon />
          <span>{t('importStory')}</span>
          <input type="file" accept=".aitown,application/octet-stream" onChange={handleImport} />
        </label>
        {bootstrap.user ? (
          <div className="sidebar-account">
            <div className="sidebar-user">
              <strong>{bootstrap.user.displayName}</strong>
            </div>
            <button className="small-button sidebar-logout" type="button" onClick={onLogout}>
              {t('logout')}
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
