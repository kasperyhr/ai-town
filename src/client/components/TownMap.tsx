import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactElement,
} from 'react';
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

type Direction = 'north' | 'south' | 'east' | 'west';

const renderedTileSize = 48;
const mapPixelWidth = assetMap.width * renderedTileSize;
const mapPixelHeight = assetMap.height * renderedTileSize;

export function TownMap({ language, world, characters, beat }: Props): ReactElement {
  const activePlace = getBeatPlace(beat);
  const period = (beat?.timeSlot ?? 'day').toLowerCase().replace(/\s+/g, '-');
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [pan, setPan] = useState({ x: -180, y: -120 });
  const dragRef = useRef<{ id: number; startX: number; startY: number; panX: number; panY: number } | null>(null);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const updateSize = (): void => setViewportSize({ width: viewport.clientWidth, height: viewport.clientHeight });
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  const clampViewportPan = (nextPan: { x: number; y: number }): { x: number; y: number } => ({
    x: clampAxis(nextPan.x, viewportSize.width, mapPixelWidth),
    y: clampAxis(nextPan.y, viewportSize.height, mapPixelHeight),
  });

  const beginDrag = (event: PointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
  };

  const dragMap = (event: PointerEvent<HTMLDivElement>): void => {
    const drag = dragRef.current;
    if (!drag || drag.id !== event.pointerId) return;
    setPan(clampViewportPan({ x: drag.panX + event.clientX - drag.startX, y: drag.panY + event.clientY - drag.startY }));
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    if (dragRef.current?.id === event.pointerId) dragRef.current = null;
  };

  return (
    <div
      className="town-viewport asset-town-viewport"
      ref={viewportRef}
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
              className={`asset-place asset-place-${place.key} ${place.key === activePlace.key ? 'active' : ''}`}
              style={{ '--x': `${place.x}%`, '--y': `${place.y}%` } as CSSProperties}
              key={place.key}
            >
              <span className="asset-place-building" />
              <span className="asset-place-pin" />
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
                '--tile-transform': tile.transform,
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
  const positions = rendered.slice(0, 12).map((character, index) => {
    const active = isCharacterActive(character.name, activeNames) || (!hasMatchedActive && Boolean(beat) && index < 2);
    const position = characterPosition(index, rendered.length, active, activePlace, beat?.timeSlot ?? '');
    return { character, index, active, position };
  });

  return (
    <>
      {positions.map(({ character, active, position }) => {
        return (
          <TownCharacter
            character={character}
            active={active}
            position={position}
            key={character.id}
          />
        );
      })}
    </>
  );
}

function TownCharacter({
  character,
  active,
  position,
}: {
  character: CharacterRecord;
  active: boolean;
  position: { x: number; y: number };
}): ReactElement {
  const previousPositionRef = useRef(position);
  const timerRef = useRef<number[]>([]);
  const visualPositionRef = useRef(position);
  const [visualPosition, setVisualPosition] = useState(position);
  const [walking, setWalking] = useState(false);
  const [direction, setDirection] = useState<Direction>('south');
  const [moveMs, setMoveMs] = useState(0);
  const sprite = spritePosition(character, direction);

  const setVisual = (nextPosition: { x: number; y: number }): void => {
    visualPositionRef.current = nextPosition;
    setVisualPosition(nextPosition);
  };

  useEffect(() => {
    for (const timer of timerRef.current) window.clearTimeout(timer);
    timerRef.current = [];

    const start = visualPositionRef.current;
    const dx = position.x - start.x;
    const dy = position.y - start.y;
    const moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
    previousPositionRef.current = position;
    if (!moved) {
      setWalking(false);
      setMoveMs(0);
      return undefined;
    }

    let elapsed = 0;
    const queueSegment = (nextPosition: { x: number; y: number }, segmentMs: number, nextDirection: Direction): void => {
      const startTimer = window.setTimeout(() => {
        setDirection(nextDirection);
        setMoveMs(segmentMs);
        setWalking(true);
        setVisual(nextPosition);
      }, elapsed);
      timerRef.current.push(startTimer);
      elapsed += segmentMs;
    };

    if (Math.abs(dx) > 0.1) {
      queueSegment({ x: position.x, y: start.y }, movementDuration(Math.abs(dx) * mapPixelWidth / 100), dx > 0 ? 'east' : 'west');
    }
    if (Math.abs(dy) > 0.1) {
      queueSegment({ x: position.x, y: position.y }, movementDuration(Math.abs(dy) * mapPixelHeight / 100), dy > 0 ? 'south' : 'north');
    }

    const finishTimer = window.setTimeout(() => {
      setWalking(false);
      setMoveMs(0);
    }, elapsed + 80);
    timerRef.current.push(finishTimer);

    return () => {
      for (const timer of timerRef.current) window.clearTimeout(timer);
      timerRef.current = [];
    };
  }, [position.x, position.y]);

  return (
    <div
      className={`asset-character ${active ? 'active' : ''} ${walking ? 'walking' : ''}`}
      style={
        {
          '--x': `${visualPosition.x}%`,
          '--y': `${visualPosition.y}%`,
          '--sprite-x': `${sprite.x}px`,
          '--sprite-x-left': `${sprite.leftX}px`,
          '--sprite-x-right': `${sprite.rightX}px`,
          '--sprite-y': `${sprite.y}px`,
          '--move-ms': `${moveMs}ms`,
        } as CSSProperties
      }
      title={character.name}
    >
      <span className="asset-character-shadow" />
      <span className="asset-character-sprite" />
      <small>{character.name}</small>
    </div>
  );
}

function resolveTile(rawGid: number): { x: number; y: number; transform: string } | null {
  const flippedHorizontally = Boolean(rawGid & 0x80000000);
  const flippedVertically = Boolean(rawGid & 0x40000000);
  const flippedDiagonally = Boolean(rawGid & 0x20000000);
  const gid = rawGid & 0x1fffffff;
  if (!gid) return null;
  const tileIndex = gid - 1;
  const col = tileIndex % assetMap.columns;
  const row = Math.floor(tileIndex / assetMap.columns);
  return {
    x: -col * renderedTileSize,
    y: -row * renderedTileSize,
    transform: tileTransform(flippedHorizontally, flippedVertically, flippedDiagonally),
  };
}

function tileTransform(horizontal: boolean, vertical: boolean, diagonal: boolean): string {
  const transforms: string[] = [];
  if (diagonal) transforms.push('rotate(90deg)');
  if (horizontal) transforms.push('scaleX(-1)');
  if (vertical) transforms.push('scaleY(-1)');
  return transforms.length > 0 ? transforms.join(' ') : 'none';
}

function spritePosition(character: CharacterRecord, direction: Direction): { x: number; leftX: number; rightX: number; y: number } {
  const seed = `${character.name}|${character.personality}|${character.gender}|${character.appearance}`;
  const code = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const actor = code % 8;
  const group = actor % 4;
  const bank = Math.floor(actor / 4);
  const directionRow: Record<Direction, number> = {
    south: 0,
    west: 1,
    east: 2,
    north: 3,
  };
  const row = bank * 4 + directionRow[direction];
  const baseCol = group * 3;
  return {
    x: -(baseCol + 1) * 64,
    leftX: -baseCol * 64,
    rightX: -(baseCol + 2) * 64,
    y: -row * 64,
  };
}

function movementDuration(pixelDistance: number): number {
  return Math.round(Math.min(4200, Math.max(900, pixelDistance * 18)));
}

function clampAxis(value: number, viewportLength: number, mapLength: number): number {
  if (viewportLength <= 0 || mapLength <= viewportLength) return Math.max(0, (viewportLength - mapLength) / 2);
  return Math.min(0, Math.max(viewportLength - mapLength, value));
}
