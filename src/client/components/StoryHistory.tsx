import type { ReactElement } from 'react';
import type { Translator } from '../i18n';
import type { StoryRecord } from '../types';

type Props = {
  stories: StoryRecord[];
  selectedDay: number | null;
  selectedBeatIndex: number;
  t: Translator;
  onSelectDay: (day: number) => void;
};

export function StoryHistory({ stories, selectedDay, selectedBeatIndex, t, onSelectDay }: Props): ReactElement {
  if (stories.length === 0) return <p>{t('noGeneratedStories')}</p>;
  const story = stories.find((item) => item.dayNumber === selectedDay) ?? stories[0] ?? null;

  return (
    <div className="history-layout">
      <div className="history-list" role="list">
        {stories.map((item) => (
          <button
            type="button"
            className={`history-day ${item.dayNumber === story?.dayNumber ? 'active' : ''}`}
            onClick={() => onSelectDay(item.dayNumber)}
            key={item.dayNumber}
          >
            <strong>Day {item.dayNumber}</strong>
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      {story ? <StoryItem story={story} beatIndex={selectedBeatIndex} t={t} /> : null}
    </div>
  );
}

function StoryItem({ story, beatIndex, t }: { story: StoryRecord; beatIndex: number; t: Translator }): ReactElement {
  const beats = story.beats ?? [];
  const beat = beats[Math.min(Math.max(beatIndex, 0), Math.max(beats.length - 1, 0))];

  return (
    <article className="story-item">
      <div>
        <span>
          Day {story.dayNumber} · {story.model}
        </span>
        <h3>{story.title}</h3>
      </div>
      {beat ? (
        <section className="beat-player">
          <div className="beat-header">
            <div>
              <strong>{beat.timeSlot}</strong>
              <span>
                {beat.location}
                {beat.mood ? ` · ${beat.mood}` : ''}
              </span>
            </div>
            <div className="beat-count">
              {beatIndex + 1}/{beats.length}
            </div>
          </div>
          <p>{beat.event}</p>
          {beat.dialogue.length > 0 ? (
            <ul>
              {beat.dialogue.map((line, index) => (
                <li key={`${line}-${index}`}>{line}</li>
              ))}
            </ul>
          ) : null}
          {beat.participatingCharacters.length > 0 ? <p className="fine-print">{beat.participatingCharacters.join(', ')}</p> : null}
          {beat.memoryImpact ? <p className="memory-impact">{beat.memoryImpact}</p> : null}
        </section>
      ) : (
        <p>{t('noBeats')}</p>
      )}
      <details className="full-story">
        <summary>{t('fullStory')}</summary>
        <p>{story.content}</p>
      </details>
    </article>
  );
}
