import { newId, sha256 } from './crypto';
import type { Env } from './types';

type Language = 'en' | 'zh';

interface WorldRow {
  id: string;
  user_id: string;
  name: string;
  language: Language;
  story_day: number;
}

interface CharacterRow {
  name: string;
  gender: string;
  personality: string;
  appearance: string;
  backstory: string;
}

interface MemoryRow {
  content: string;
  source: string;
  importance: number;
}

interface LexiconRow {
  term: string;
  description: string;
  language: 'en' | 'zh' | 'both';
}

interface StoryRow {
  id?: string;
  day_number: number;
  title: string;
  content: string;
  language?: Language;
  model?: string;
  created_at?: string;
}

interface BeatRow {
  beat_index: number;
  time_slot: string;
  location: string;
  mood: string;
  event: string;
  dialogue: string;
  participating_characters: string;
  memory_impact: string;
}

export interface GeneratedStory {
  dayNumber: number;
  title: string;
  content: string;
  language: Language;
  model: string;
  memory: string;
  beats: StoryBeat[];
}

export interface StoryHistoryItem {
  id: string;
  dayNumber: number;
  title: string;
  content: string;
  language: Language;
  model: string;
  createdAt: string;
  beats: StoryBeat[];
}

export interface StoryBeat {
  timeSlot: string;
  location: string;
  mood: string;
  event: string;
  dialogue: string[];
  participatingCharacters: string[];
  memoryImpact: string;
}

interface DeepSeekResponse {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string;
      reasoning_content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface StoryJson {
  title?: string;
  content?: string;
  memory?: string;
  beats?: Array<Partial<StoryBeat>>;
  possibleNewCharacter?: {
    name?: string;
    gender?: string;
    personality?: string;
    appearance?: string;
    backstory?: string;
    reason?: string;
  } | null;
}

const canonicalLocations = [
  'Town Square',
  'Town Archive',
  'Workshop',
  'Garden',
  'Bridge',
  'Bakery',
  'Market',
  'Bell Station',
] as const;

const locationAliases: Record<string, readonly string[]> = {
  'Town Square': ['square', 'plaza', 'center', 'fountain', '广场', '喷泉'],
  'Town Archive': ['archive', 'library', 'records', '档案', '图书馆'],
  Workshop: ['workshop', 'repair', 'machine', 'clock', '工坊', '机器', '钟表'],
  Garden: ['garden', 'greenhouse', 'flowers', 'herb', '花园', '温室'],
  Bridge: ['bridge', 'river', 'canal', '桥', '河', '运河'],
  Bakery: ['bakery', 'bread', 'kitchen', '面包', '厨房'],
  Market: ['market', 'shop', 'stall', '集市', '商店', '摊位'],
  'Bell Station': ['station', 'bell', 'clocktower', 'tower', '钟铃', '钟塔', '塔'],
};

export async function generateNextStoryForUserWorld(
  env: Env,
  userId: string,
  worldId: string,
  options: { language?: Language } = {},
): Promise<GeneratedStory | null> {
  const world = await env.DB.prepare(
    `SELECT id, user_id, name, language, story_day
     FROM worlds
     WHERE id = ? AND user_id = ?
     LIMIT 1`,
  )
    .bind(worldId, userId)
    .first<WorldRow>();
  if (!world) return null;

  const generationWorld = options.language ? { ...world, language: options.language } : world;
  return generateForWorld(env, generationWorld);
}

export async function generateDailyStoriesForCron(env: Env): Promise<void> {
  if (!env.DEEPSEEK_API_KEY || env.DEEPSEEK_API_KEY.startsWith('replace-')) {
    console.log(JSON.stringify({ event: 'daily_story_skipped', reason: 'missing_deepseek_key' }));
    return;
  }

  const worlds = await env.DB.prepare(
    `SELECT id, user_id, name, language, story_day
     FROM worlds
     WHERE auto_advance_enabled = 1
     ORDER BY updated_at DESC
     LIMIT 20`,
  ).all<WorldRow>();

  for (const world of worlds.results) {
    try {
      await generateForWorld(env, world);
    } catch (error) {
      console.error(
        JSON.stringify({
          event: 'daily_story_failed',
          worldId: world.id,
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
      );
    }
  }
}

export async function listStoryHistory(
  env: Env,
  userId: string,
  worldId: string,
): Promise<StoryHistoryItem[] | null> {
  if (!(await ownsWorld(env, userId, worldId))) return null;

  const stories = await env.DB.prepare(
    `SELECT id, day_number, title, content, language, model, created_at
     FROM stories
     WHERE world_id = ? AND user_id = ?
     ORDER BY day_number DESC
     LIMIT 100`,
  )
    .bind(worldId, userId)
    .all<Required<StoryRow>>();

  return Promise.all(
    stories.results.map(async (story) => ({
      id: story.id,
      dayNumber: story.day_number,
      title: story.title,
      content: story.content,
      language: story.language,
      model: story.model,
      createdAt: story.created_at,
      beats: await getStoryBeats(env, userId, worldId, story.id),
    })),
  );
}

export async function getStoryByDay(
  env: Env,
  userId: string,
  worldId: string,
  dayNumber: number,
): Promise<StoryHistoryItem | null> {
  if (!(await ownsWorld(env, userId, worldId))) return null;

  const story = await env.DB.prepare(
    `SELECT id, day_number, title, content, language, model, created_at
     FROM stories
     WHERE world_id = ? AND user_id = ? AND day_number = ?
     LIMIT 1`,
  )
    .bind(worldId, userId, dayNumber)
    .first<Required<StoryRow>>();
  if (!story) return null;

  return {
    id: story.id,
    dayNumber: story.day_number,
    title: story.title,
    content: story.content,
    language: story.language,
    model: story.model,
    createdAt: story.created_at,
    beats: await getStoryBeats(env, userId, worldId, story.id),
  };
}

async function generateForWorld(env: Env, world: WorldRow): Promise<GeneratedStory> {
  const [characters, memories, lexiconEntries, previousStories] = await Promise.all([
    env.DB.prepare(
      `SELECT name, gender, personality, appearance, backstory
       FROM characters
       WHERE world_id = ? AND user_id = ?
       ORDER BY created_at ASC
       LIMIT 32`,
    )
      .bind(world.id, world.user_id)
      .all<CharacterRow>(),
    env.DB.prepare(
      `SELECT content, source, importance
       FROM memories
       WHERE world_id = ? AND user_id = ?
       ORDER BY importance DESC, created_at DESC
       LIMIT 20`,
    )
      .bind(world.id, world.user_id)
      .all<MemoryRow>(),
    env.DB.prepare(
      `SELECT term, description, language
       FROM lexicon_entries
       WHERE world_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 30`,
    )
      .bind(world.id, world.user_id)
      .all<LexiconRow>(),
    env.DB.prepare(
      `SELECT day_number, title, content
       FROM stories
       WHERE world_id = ? AND user_id = ?
       ORDER BY day_number DESC
       LIMIT 5`,
    )
      .bind(world.id, world.user_id)
      .all<StoryRow>(),
  ]);

  const prompt = buildPrompt({
    world,
    characters: characters.results,
    memories: memories.results,
    lexiconEntries: lexiconEntries.results,
    previousStories: previousStories.results.reverse(),
  });
  const promptHash = await sha256(prompt);
  let json: StoryJson;
  try {
    json = await callDeepSeek(env, prompt);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'DeepSeek returned unusable JSON content.') {
      throw error;
    }
    console.warn(
      JSON.stringify({
        event: 'deepseek_json_fallback',
        reason: 'unusable_json_content',
        worldId: world.id,
      }),
    );
    json = buildFallbackStory(world, characters.results);
  }
  const title = clamp(json.title, world.language === 'zh' ? '\u65b0\u7684\u4e00\u5929' : 'A New Day', 120);
  const content = clamp(json.content, '', 4000);
  if (!content) throw new Error('DeepSeek returned an empty story.');
  const memory = clamp(json.memory, title, 500);
  const model = env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
  const beats = normalizeBeats(json.beats);
  const storyId = newId('sty');
  const statements: D1PreparedStatement[] = [
    env.DB.prepare(
      `INSERT INTO stories (id, world_id, user_id, day_number, title, content, language, model, prompt_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(storyId, world.id, world.user_id, world.story_day, title, content, world.language, model, promptHash),
  ];

  for (let i = 0; i < beats.length; i += 1) {
    const beat = beats[i]!;
    statements.push(
      env.DB.prepare(
        `INSERT INTO story_beats
          (id, story_id, world_id, user_id, beat_index, time_slot, location, mood, event, dialogue, participating_characters, memory_impact)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        newId('bea'),
        storyId,
        world.id,
        world.user_id,
        i,
        beat.timeSlot,
        beat.location,
        beat.mood,
        beat.event,
        JSON.stringify(beat.dialogue),
        JSON.stringify(beat.participatingCharacters),
        beat.memoryImpact,
      ),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO memories (id, world_id, user_id, character_id, content, source, importance)
       VALUES (?, ?, ?, NULL, ?, ?, ?)`,
    ).bind(newId('mem'), world.id, world.user_id, memory, 'story', 4),
    env.DB.prepare(
      `UPDATE worlds
       SET story_day = story_day + 1, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).bind(world.id, world.user_id),
  );
  await env.DB.batch(statements);

  return {
    dayNumber: world.story_day,
    title,
    content,
    language: world.language,
    model,
    memory,
    beats,
  };
}

async function callDeepSeek(env: Env, prompt: string): Promise<StoryJson> {
  const firstContent = await requestDeepSeekJson(env, prompt, {
    temperature: 0.55,
    maxTokens: 1800,
    strictRepair: false,
  });
  const firstParsed = parseStoryJson(firstContent);
  if (firstParsed) return firstParsed;

  console.warn(
    JSON.stringify({
      event: 'deepseek_json_retry',
      reason: 'invalid_json',
      contentLength: firstContent.length,
    }),
  );

  const repairPrompt = `
The previous response was not valid JSON.

Return a fresh, valid, minified JSON object for the same story request.
Do not include markdown, code fences, comments, or text outside the JSON object.
Keep string values compact. Escape all quotes and newlines inside strings.

Original request:
${prompt}
`.trim();
  const secondContent = await requestDeepSeekJson(env, repairPrompt, {
    temperature: 0.2,
    maxTokens: 1400,
    strictRepair: true,
  });
  const secondParsed = parseStoryJson(secondContent);
  if (secondParsed) return secondParsed;

  throw new Error('DeepSeek returned unusable JSON content.');
}

async function requestDeepSeekJson(
  env: Env,
  prompt: string,
  options: { temperature: number; maxTokens: number; strictRepair: boolean },
): Promise<string> {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: options.strictRepair
            ? 'You repair model output by returning valid JSON only. No markdown. No prose outside JSON.'
            : 'You write compact, character-driven slice-of-life fiction for an AI town simulation. Always return valid JSON only. Escape quotes and newlines inside string values.',
        },
        { role: 'user', content: prompt },
      ],
      response_format: { type: 'json_object' },
      thinking: { type: 'disabled' },
      temperature: options.temperature,
      max_tokens: options.maxTokens,
      stream: false,
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepSeek request failed with ${response.status}: ${await response.text()}`);
  }

  const body = (await response.json()) as DeepSeekResponse;
  const content = body.choices?.[0]?.message?.content;
  const reasoningContent = body.choices?.[0]?.message?.reasoning_content;
  logDeepSeekResponse(env, {
    strictRepair: options.strictRepair,
    status: response.status,
    finishReason: body.choices?.[0]?.finish_reason ?? null,
    content: content ?? '',
    reasoningContentLength: reasoningContent?.length ?? 0,
    usage: body.usage ?? null,
  });
  return content ?? '';
}

function parseStoryJson(content: string): StoryJson | null {
  const trimmed = content.trim();
  const candidates = [
    trimmed,
    trimmed.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim(),
    extractJsonObject(trimmed),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as StoryJson;
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function logDeepSeekResponse(
  env: Env,
  detail: {
    strictRepair: boolean;
    status: number;
    finishReason: string | null;
    content: string;
    reasoningContentLength: number;
    usage: DeepSeekResponse['usage'] | null;
  },
): void {
  const debugEnabled = env.DEEPSEEK_DEBUG_LOGS === 'true';
  console.log(
    JSON.stringify({
      event: 'deepseek_response_summary',
      model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      strictRepair: detail.strictRepair,
      status: detail.status,
      finishReason: detail.finishReason,
      contentLength: detail.content.length,
      reasoningContentLength: detail.reasoningContentLength,
      usage: detail.usage,
      debugBodyLogged: debugEnabled,
    }),
  );

  if (!debugEnabled) return;
  console.log(
    JSON.stringify({
      event: 'deepseek_response_body',
      model: env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      strictRepair: detail.strictRepair,
      contentLength: detail.content.length,
      content: truncateForLog(detail.content, 12000),
    }),
  );
}

function truncateForLog(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...[truncated ${value.length - maxLength} chars]`;
}

function extractJsonObject(value: string): string | null {
  const start = value.indexOf('{');
  const end = value.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  return value.slice(start, end + 1);
}

function buildFallbackStory(world: WorldRow, characters: CharacterRow[]): StoryJson {
  const names = characters.slice(0, 3).map((character) => character.name);
  const primary = names[0] ?? 'Mira';
  const secondary = names[1] ?? 'Jun';
  const title =
    world.language === 'zh'
      ? `\u7b2c ${world.story_day} \u5929\u7684\u5c0f\u9547\u56de\u58f0`
      : `Town Echoes, Day ${world.story_day}`;
  const content =
    world.language === 'zh'
      ? `${primary} \u5728\u5c0f\u9547\u5e7f\u573a\u53d1\u73b0\u4e86\u4e00\u4e2a\u65b0\u7684\u7ebf\u7d22\uff0c${secondary} \u5f88\u5feb\u5e26\u7740\u81ea\u5df1\u7684\u60f3\u6cd5\u8d76\u6765\u3002\u4ed6\u4eec\u6cbf\u7740\u6865\u8fb9\u3001\u82b1\u56ed\u548c\u949f\u697c\u6162\u6162\u63a8\u8fdb\uff0c\u628a\u4e00\u5929\u62c6\u6210\u4e86\u51e0\u4e2a\u5c0f\u5c0f\u7684\u53d1\u73b0\u3002\n\n\u5230\u4e86\u591c\u91cc\uff0c\u5c0f\u9547\u53d8\u5f97\u5b89\u9759\uff0c\u4f46\u4ed6\u4eec\u90fd\u611f\u89c9\u4eca\u5929\u7559\u4e0b\u7684\u4e8b\u4f1a\u6539\u53d8\u660e\u5929\u7684\u5bf9\u8bdd\u3002`
      : `${primary} finds a new clue in the town square, and ${secondary} arrives with a theory before the bell finishes ringing. They move between the bridge, garden, and clocktower, turning the day into a chain of small discoveries.\n\nBy night, the town grows quiet, but everyone can feel that today's detail will change tomorrow's conversation.`;
  return {
    title,
    content,
    memory:
      world.language === 'zh'
        ? `${primary} \u548c ${secondary} \u8bb0\u5f97\u4eca\u5929\u7684\u7ebf\u7d22\u4f1a\u5f71\u54cd\u660e\u5929\u3002`
        : `${primary} and ${secondary} remember that today's clue may shape tomorrow.`,
    beats: fallbackBeats(world.language, names),
    possibleNewCharacter: null,
  };
}

function fallbackBeats(language: Language, names: string[]): StoryBeat[] {
  const primary = names[0] ?? 'Mira';
  const secondary = names[1] ?? 'Jun';
  const pairs = [
    ['Dawn', 'Town Square'],
    ['Morning', 'Town Archive'],
    ['Noon', 'Workshop'],
    ['Afternoon', 'Garden'],
    ['Evening', 'Bridge'],
    ['Night', 'Bell Station'],
    ['Late Night', 'Town Square'],
  ] as const;
  return pairs.map(([timeSlot, location], index) => ({
    timeSlot,
    location,
    mood: language === 'zh' ? '\u5b89\u9759' : 'quiet',
    event:
      language === 'zh'
        ? `${primary} \u548c ${secondary} \u5728${location}\u68b3\u7406\u4eca\u5929\u7684\u7b2c ${index + 1} \u4e2a\u7ebf\u7d22\u3002`
        : `${primary} and ${secondary} follow clue ${index + 1} at ${location}.`,
    dialogue: [
      language === 'zh'
        ? `${primary}: \u6211\u4eec\u5148\u628a\u8fd9\u4e2a\u8bb0\u4e0b\u6765\u3002`
        : `${primary}: Let's write this down before it changes.`,
    ],
    participatingCharacters: [primary, secondary],
    memoryImpact:
      language === 'zh'
        ? '\u8fd9\u4e2a\u7247\u6bb5\u4f1a\u6210\u4e3a\u660e\u5929\u5bf9\u8bdd\u7684\u80cc\u666f\u3002'
        : 'This beat becomes context for tomorrow.',
  }));
}

function buildPrompt(input: {
  world: WorldRow;
  characters: CharacterRow[];
  memories: MemoryRow[];
  lexiconEntries: LexiconRow[];
  previousStories: StoryRow[];
}): string {
  const languageInstruction =
    input.world.language === 'zh'
      ? 'Write the title, content, and memory in Simplified Chinese.'
      : 'Write the title, content, and memory in English.';

  return `
Generate the next daily story for an AI town simulation.

Output one minified JSON object with these keys only:
{"title":"short title","content":"2 short paragraphs, under 700 chars total","memory":"one concise memory","beats":[{"timeSlot":"Dawn","location":"Town Square","mood":"quiet","event":"under 120 chars","dialogue":["Mira: under 80 chars"],"participatingCharacters":["Mira"],"memoryImpact":"under 100 chars"}],"possibleNewCharacter":null}

Rules:
- ${languageInstruction}
- Current story day: ${input.world.story_day}
- World name: ${input.world.name}
- Keep continuity with prior stories and memories.
- Create exactly 7 beats using these time slots in order: Dawn, Morning, Noon, Afternoon, Evening, Night, Late Night.
- Each beat.location must be exactly one of: ${canonicalLocations.join(', ')}.
- If the scene mentions another place, put the scene at the closest allowed location and mention the detail in event.
- Let character habits matter. Some characters can be morning buddies; some can be night owls.
- Use lexicon terms naturally when relevant.
- Do not include markdown, comments, code fences, or prose outside the JSON object.
- Escape all quotation marks inside strings.
- Do not put raw line breaks inside JSON string values.
- possibleNewCharacter is reserved for future use. Use null unless the story strongly implies a new recurring character.

Characters:
${input.characters
  .map(
    (character) =>
      `- ${character.name} (${character.gender}): ${character.personality}; appearance: ${character.appearance}; backstory: ${character.backstory}`,
  )
  .join('\n')}

Important memories:
${input.memories.map((memory) => `- [${memory.source}, ${memory.importance}/5] ${memory.content}`).join('\n')}

Lexicon:
${input.lexiconEntries
  .map((entry) => `- ${entry.term} (${entry.language}): ${entry.description || 'No description'}`)
  .join('\n')}

Previous stories:
${input.previousStories.map((story) => `- Day ${story.day_number}, ${story.title}: ${story.content}`).join('\n\n')}
`.trim();
}

function clamp(value: string | undefined, fallback: string, maxLength: number): string {
  const trimmed = (value ?? '').trim();
  return (trimmed || fallback).slice(0, maxLength);
}

function normalizeBeats(input: Array<Partial<StoryBeat>> | undefined): StoryBeat[] {
  const timeSlots = ['Dawn', 'Morning', 'Noon', 'Afternoon', 'Evening', 'Night', 'Late Night'];
  return timeSlots.map((timeSlot, index) => {
    const source = input?.[index] ?? {};
    return {
      timeSlot: clamp(source.timeSlot, timeSlot, 40),
      location: normalizeLocation(source.location, index),
      mood: clamp(source.mood, '', 80),
      event: clamp(source.event, 'The town changes quietly.', 800),
      dialogue: normalizeStringList(source.dialogue, 6, 180),
      participatingCharacters: normalizeStringList(source.participatingCharacters, 8, 80),
      memoryImpact: clamp(source.memoryImpact, '', 400),
    };
  });
}

function normalizeLocation(value: string | undefined, index: number): string {
  const raw = (value ?? '').trim();
  if (!raw) return canonicalLocations[index % canonicalLocations.length]!;
  const lowered = raw.toLowerCase();
  const direct = canonicalLocations.find((location) => location.toLowerCase() === lowered);
  if (direct) return direct;
  const matched = canonicalLocations.find((location) =>
    (locationAliases[location] ?? []).some((alias) => lowered.includes(alias.toLowerCase()) || raw.includes(alias)),
  );
  if (matched) return matched;
  return canonicalLocations[index % canonicalLocations.length]!;
}

function normalizeStringList(value: string[] | undefined, maxItems: number, maxLength: number): string[] {
  return (Array.isArray(value) ? value : [])
    .filter((item): item is string => typeof item === 'string')
    .slice(0, maxItems)
    .map((item) => clamp(item, '', maxLength))
    .filter(Boolean);
}

async function ownsWorld(env: Env, userId: string, worldId: string): Promise<boolean> {
  const row = await env.DB.prepare(`SELECT id FROM worlds WHERE id = ? AND user_id = ? LIMIT 1`)
    .bind(worldId, userId)
    .first<{ id: string }>();
  return row !== null;
}

async function getStoryBeats(env: Env, userId: string, worldId: string, storyId: string): Promise<StoryBeat[]> {
  const beats = await env.DB.prepare(
    `SELECT beat_index, time_slot, location, mood, event, dialogue, participating_characters, memory_impact
     FROM story_beats
     WHERE story_id = ? AND world_id = ? AND user_id = ?
     ORDER BY beat_index ASC`,
  )
    .bind(storyId, worldId, userId)
    .all<BeatRow>();

  return beats.results.map((beat) => ({
    timeSlot: beat.time_slot,
    location: beat.location,
    mood: beat.mood,
    event: beat.event,
    dialogue: parseJsonList(beat.dialogue),
    participatingCharacters: parseJsonList(beat.participating_characters),
    memoryImpact: beat.memory_impact,
  }));
}

function parseJsonList(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}
