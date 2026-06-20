import type { FormEvent, ReactElement } from 'react';
import { localizeCharacter, type Translator } from '../i18n';
import type { CharacterRecord, Language, LexiconLanguage, LexiconRecord } from '../types';
import { StoryHistory } from './StoryHistory';
import type { StoryRecord } from '../types';

type Props = {
  language: Language;
  characters: CharacterRecord[];
  lexiconEntries: LexiconRecord[];
  stories: StoryRecord[];
  editingCharacterId: string | null;
  selectedDay: number | null;
  selectedBeatIndex: number;
  t: Translator;
  onNewCharacter: () => void;
  onEditCharacter: (id: string) => void;
  onSaveCharacter: (payload: Pick<CharacterRecord, 'name' | 'gender' | 'personality' | 'appearance' | 'backstory'>) => void;
  onRemoveCharacter: (id: string) => void;
  onAddLexicon: (payload: { term: string; description: string; language: LexiconLanguage }) => void;
  onDeleteLexicon: (id: string) => void;
  onSelectDay: (day: number) => void;
};

export function Editors({
  language,
  characters,
  lexiconEntries,
  stories,
  editingCharacterId,
  selectedDay,
  selectedBeatIndex,
  t,
  onNewCharacter,
  onEditCharacter,
  onSaveCharacter,
  onRemoveCharacter,
  onAddLexicon,
  onDeleteLexicon,
  onSelectDay,
}: Props): ReactElement {
  return (
    <section className="editor-grid">
      <section className="panel">
        <div className="panel-title-row">
          <h2>{t('characters')}</h2>
          <button type="button" className="small-button" onClick={onNewCharacter}>
            {t('addCharacter')}
          </button>
        </div>
        <div className="character-tabs">
          {characters.map((character) => (
            <button
              type="button"
              className={character.id === editingCharacterId ? 'active' : ''}
              onClick={() => onEditCharacter(character.id)}
              key={character.id}
            >
              {character.name}
            </button>
          ))}
        </div>
        <CharacterForm
          language={language}
          character={characters.find((item) => item.id === editingCharacterId) ?? null}
          t={t}
          onSave={onSaveCharacter}
          onRemove={onRemoveCharacter}
        />
      </section>

      <section className="panel">
        <h2>{t('lexicon')}</h2>
        <LexiconForm t={t} onAdd={onAddLexicon} />
        <div className="lexicon-list">
          {lexiconEntries.map((entry) => (
            <article className="lexicon-item" key={entry.id}>
              <div>
                <strong>{entry.term}</strong>
                <span>{entry.language}</span>
                <p>{entry.description}</p>
              </div>
              <button type="button" className="icon-danger" aria-label={t('delete')} onClick={() => onDeleteLexicon(entry.id)}>
                ×
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="panel story-panel">
        <h2>{t('recentStories')}</h2>
        <StoryHistory stories={stories} selectedDay={selectedDay} selectedBeatIndex={selectedBeatIndex} t={t} onSelectDay={onSelectDay} />
      </section>
    </section>
  );
}

function CharacterForm({
  language,
  character,
  t,
  onSave,
  onRemove,
}: {
  language: Language;
  character: CharacterRecord | null;
  t: Translator;
  onSave: (payload: Pick<CharacterRecord, 'name' | 'gender' | 'personality' | 'appearance' | 'backstory'>) => void;
  onRemove: (id: string) => void;
}): ReactElement {
  const display = character ? localizeCharacter(character, language) : null;
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    onSave({
      name: String(formData.get('name') ?? ''),
      gender: String(formData.get('gender') ?? ''),
      personality: String(formData.get('personality') ?? ''),
      appearance: String(formData.get('appearance') ?? ''),
      backstory: String(formData.get('backstory') ?? ''),
    });
  };

  return (
    <form className="data-form" onSubmit={handleSubmit} key={character?.id ?? 'new'}>
      <h3>{character ? t('editCharacter') : t('addCharacter')}</h3>
      <label>
        {t('name')}
        <input name="name" maxLength={60} defaultValue={display?.name ?? ''} required />
      </label>
      <label>
        {t('gender')}
        <input name="gender" maxLength={40} defaultValue={display?.gender ?? ''} />
      </label>
      <label>
        {t('personality')}
        <textarea name="personality" rows={4} maxLength={500} defaultValue={display?.personality ?? ''} required />
      </label>
      <label>
        {t('appearance')}
        <textarea name="appearance" rows={4} maxLength={500} defaultValue={display?.appearance ?? ''} required />
      </label>
      <label>
        {t('backstory')}
        <textarea name="backstory" rows={5} maxLength={1000} defaultValue={display?.backstory ?? ''} />
      </label>
      <div className="form-actions">
        <button className="auth-button secondary" type="submit">
          {t('saveCharacter')}
        </button>
        {character ? (
          <button className="small-button danger-text" type="button" onClick={() => onRemove(character.id)}>
            {t('removeCharacter')}
          </button>
        ) : null}
      </div>
    </form>
  );
}

function LexiconForm({
  t,
  onAdd,
}: {
  t: Translator;
  onAdd: (payload: { term: string; description: string; language: LexiconLanguage }) => void;
}): ReactElement {
  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    onAdd({
      term: String(formData.get('term') ?? ''),
      description: String(formData.get('description') ?? ''),
      language: String(formData.get('language') ?? 'en') as LexiconLanguage,
    });
    form.reset();
  };

  return (
    <form className="data-form compact-form" onSubmit={handleSubmit}>
      <label>
        {t('term')}
        <input name="term" maxLength={80} required />
      </label>
      <label>
        {t('description')}
        <textarea name="description" rows={3} maxLength={600} />
      </label>
      <label>
        {t('scope')}
        <select name="language" defaultValue="en">
          <option value="en">English</option>
          <option value="zh">中文</option>
          <option value="both">Both</option>
        </select>
      </label>
      <button className="auth-button secondary" type="submit">
        {t('addTerm')}
      </button>
    </form>
  );
}
