import type { Language, MapPlace, StoryBeat } from './types';

export const mapPlaces: MapPlace[] = [
  { key: 'square', label: 'Town Square', labelZh: '小镇广场', x: 50, y: 52, aliases: ['square', 'plaza', 'center', 'fountain', '广场', '喷泉'] },
  { key: 'archive', label: 'Town Archive', labelZh: '小镇档案馆', x: 22, y: 30, aliases: ['archive', 'library', 'records', '档案', '图书馆'] },
  { key: 'workshop', label: 'Workshop', labelZh: '修理工坊', x: 78, y: 31, aliases: ['workshop', 'repair', 'machine', 'clock', '工坊', '机器', '钟表'] },
  { key: 'garden', label: 'Garden', labelZh: '中央花园', x: 27, y: 73, aliases: ['garden', 'greenhouse', 'flowers', 'herb', '花园', '温室'] },
  { key: 'bridge', label: 'Bridge', labelZh: '河桥', x: 70, y: 76, aliases: ['bridge', 'river', 'canal', '桥', '河', '运河'] },
  { key: 'bakery', label: 'Bakery', labelZh: '面包店', x: 44, y: 24, aliases: ['bakery', 'bread', 'kitchen', '面包', '厨房'] },
  { key: 'market', label: 'Market', labelZh: '集市', x: 60, y: 37, aliases: ['market', 'shop', 'stall', '集市', '商店', '摊位'] },
  { key: 'station', label: 'Bell Station', labelZh: '钟铃站', x: 38, y: 61, aliases: ['station', 'bell', 'clocktower', 'tower', '钟铃', '钟塔', '塔'] },
];

export function placeLabel(place: MapPlace, language: Language): string {
  return language === 'zh' ? place.labelZh : place.label;
}

export function getBeatPlace(beat: StoryBeat | null): MapPlace {
  if (!beat) return mapPlaces[0]!;
  const location = beat.location.toLowerCase();
  const matched = mapPlaces.find((place) => place.aliases.some((alias) => location.includes(alias.toLowerCase()) || beat.location.includes(alias)));
  if (matched) return matched;
  const code = Array.from(location).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return mapPlaces[code % mapPlaces.length]!;
}

export function activeCharacterNames(beat: StoryBeat | null): string[] {
  if (!beat) return [];
  const names = new Set<string>();
  for (const name of beat.participatingCharacters) {
    if (name.trim()) names.add(name.trim());
  }
  for (const line of beat.dialogue) {
    const speaker = line.split(/[:：]/)[0]?.trim();
    if (speaker) names.add(speaker);
  }
  return Array.from(names).slice(0, 8);
}

export function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '');
}

export function isCharacterActive(name: string, activeNames: Set<string>): boolean {
  const normalized = normalizeName(name);
  return activeNames.has(normalized) || Array.from(activeNames).some((active) => normalized.includes(active) || active.includes(normalized));
}

export function characterPosition(
  index: number,
  count: number,
  active: boolean,
  activePlace: MapPlace,
  timeSlot: string,
): { x: number; y: number } {
  if (active) {
    const offsets = [
      { x: -4, y: -6 },
      { x: 5, y: 6 },
      { x: 7, y: -5 },
      { x: -7, y: 5 },
      { x: 0, y: 9 },
      { x: 9, y: 0 },
      { x: -9, y: 0 },
      { x: -5, y: -8 },
    ];
    const offset = offsets[index % offsets.length]!;
    return {
      x: clampNumber(activePlace.x + offset.x, 8, 92),
      y: clampNumber(activePlace.y + offset.y, 12, 88),
    };
  }

  const nightShift = /night/i.test(timeSlot) ? 5 : 0;
  const angle = (Math.PI * 2 * index) / Math.max(count, 1);
  return {
    x: clampNumber(50 + Math.cos(angle) * 31, 9, 91),
    y: clampNumber(52 + Math.sin(angle) * (22 + nightShift), 13, 87),
  };
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
