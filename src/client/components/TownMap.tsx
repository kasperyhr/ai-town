import { useRef, useState, type CSSProperties, type PointerEvent, type ReactElement } from 'react';
import { assetMap } from '../assetMap';
import type { Translator } from '../i18n';
import { activeCharacterNames, characterPosition, getBeatPlace, isCharacterActive, mapPlaces, normalizeName, placeLabel } from '../mapData';
import type { CharacterRecord, Language, StoryBeat, WorldSummary } from '../types';

type Props = {
  language: Language;
  world: WorldSummary | null;
  characters: CharacterRecord[];
  beat: StoryBeat | null;
  t: Translator;
};

const renderedTileSize = 24;
const mapPixelWidth = assetMap.width * renderedTileSize;
const mapPixelHeight = assetMap.height * renderedTileSize;

export function TownMap({ language, world, characters, beat }: Props): ReactElement {
  const activePlace = getBeatPlace(beat);
  const period = (beat?.timeSlot ?? 'day').toLowerCase().replace(/\s+/g, '-');
  const [pan, setPan] = useState({ x: -180, y: -120 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  const beginDrag = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
  };

  const dragMap = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setPan({
      x: clampPan(drag.panX + event.clientX - drag.startX),
      y: clampPan(drag.panY + event.clientY - drag.startY),
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      className="town-viewport asset-town-viewport"
      onPointerDown={beginDrag}
      onPointerMove={dragMap}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="application"
      aria-label="Draggable town map"
    >
      <div
        className="town-drag-layer asset-town-drag-layer"
        style={
          {
            '--pan-x': `${pan.x}px`,
            '--pan-y': `${pan.y}px`,
            '--map-width': `${mapPixelWidth}px`,
            '--map-height': `${mapPixelHeight}px`,
          } as CSSProperties
        }
      >
        <div className="asset-town-scene" data-period={period}>
          <TileLayer name="terrain" tiles={assetMap.layers.terrain} zIndex={1} />
          <TileLayer name="bridge" tiles={assetMap.layers.bridge} zIndex={2} />
          <TileLayer name="deco" tiles={assetMap.layers.deco} zIndex={4} />
          {mapPlaces.map((place) => (
            <div
              className={`asset-map-place ${place.key === activePlace.key ? 'active' : ''}`}
              style={{ '--x': `${place.x}%`, '--y': `${place.y}%` } as CSSProperties}
              key={place.key}
            >
              <strong>{placeLabel(place, language)}</strong>
            </div>
          ))}
          <TownCharacters world={world} characters={characters} beat={beat} activePlace={activePlace} />
          <div className="asset-map-light" />
        </div>
      </div>
    </div>
  );
}

function TileLayer({ name, tiles, zIndex }: { name: string; tiles: readonly number[]; zIndex: number }): ReactElement {
  return (
    <div className={`asset-tile-layer asset-layer-${name}`} style={{ zIndex }}>
      {tiles.map((gid, index) => {
        const tile = resolveTile(gid);
        if (!tile) return null;
        const x = index % assetMap.width;
        const y = Math.floor(index / assetMap.width);
        return (
          <span
            className="asset-tile"
            style={
              {
                '--tile-left': `${x * renderedTileSize}px`,
                '--tile-top': `${y * renderedTileSize}px`,
                '--tile-bg-x': `${tile.x}px`,
                '--tile-bg-y': `${tile.y}px`,
              } as CSSProperties
            }
            key={`${name}-${index}`}
          />
        );
      })}
    </div>
  );
}

export function MapFocus({ language, beat, t }: { language: Language; beat: StoryBeat | null; t: Translator }): ReactElement {
  if (!beat) return <p className="map-focus">{t('quietTown')}</p>;
  const place = getBeatPlace(beat);
  const activeNames = activeCharacterNames(beat);
  return (
    <div className="map-focus">
      <div className="map-focus-title">
        <strong>
          {t('mapFocus')}: {beat.timeSlot} · {placeLabel(place, language)}
        </strong>
        {beat.location !== place.label ? <span>{beat.location}</span> : null}
      </div>
      <p>{activeNames.length > 0 ? `${t('activeResidents')}: ${activeNames.join(', ')}` : t('quietTown')}</p>
    </div>
  );
}

function TownCharacters({
  world,
  characters,
  beat,
  activePlace,
}: {
  world: WorldSummary | null;
  characters: CharacterRecord[];
  beat: StoryBeat | null;
  activePlace: ReturnType<typeof getBeatPlace>;
}): ReactElement {
  const rendered =
    characters.length > 0
      ? characters
      : Array.from({ length: Math.max(world?.characterCount ?? 3, 3) }).map((_, index) => ({
          id: `placeholder-${index}`,
          name: String(index + 1),
          gender: '',
          personality: '',
          appearance: '',
          backstory: '',
          isAutoGenerated: false,
        }));
  const activeNames = new Set(activeCharacterNames(beat).map(normalizeName));
  const hasMatchedActive = characters.some((character) => isCharacterActive(character.name, activeNames));

  return (
    <>
      {rendered.slice(0, 12).map((character, index) => {
        const active = isCharacterActive(character.name, activeNames) || (!hasMatchedActive && Boolean(beat) && index < 2);
        const position = characterPosition(index, rendered.length, active, activePlace, beat?.timeSlot ?? '');
        const sprite = spritePosition(index, active);
        return (
          <div
            className={`asset-character ${active ? 'active' : ''}`}
            style={
              {
                '--x': `${position.x}%`,
                '--y': `${position.y}%`,
                '--sprite-x': `${sprite.x}px`,
                '--sprite-y': `${sprite.y}px`,
              } as CSSProperties
            }
            title={character.name}
            key={character.id}
          >
            <span className="asset-character-shadow" />
            <span className="asset-character-sprite" />
            <small>{character.name}</small>
          </div>
        );
      })}
    </>
  );
}

function resolveTile(rawGid: number): { x: number; y: number } | null {
  const gid = rawGid & 0x1fffffff;
  if (!gid) return null;
  const tileIndex = gid - 1;
  const col = tileIndex % assetMap.columns;
  const row = Math.floor(tileIndex / assetMap.columns);
  return {
    x: -col * renderedTileSize,
    y: -row * renderedTileSize,
  };
}

function spritePosition(index: number, active: boolean): { x: number; y: number } {
  const col = active ? 1 : 0;
  const row = index % 8;
  return {
    x: -col * 48,
    y: -row * 48,
  };
}

function clampPan(value: number): number {
  return Math.min(24, Math.max(-420, value));
}
