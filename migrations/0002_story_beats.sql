PRAGMA foreign_keys = ON;

ALTER TABLE worlds ADD COLUMN auto_advance_enabled INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS story_beats (
  id TEXT PRIMARY KEY,
  story_id TEXT NOT NULL REFERENCES stories(id) ON DELETE CASCADE,
  world_id TEXT NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  beat_index INTEGER NOT NULL,
  time_slot TEXT NOT NULL,
  location TEXT NOT NULL,
  mood TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL,
  dialogue TEXT NOT NULL DEFAULT '[]',
  participating_characters TEXT NOT NULL DEFAULT '[]',
  memory_impact TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (story_id, beat_index)
);

CREATE INDEX IF NOT EXISTS idx_story_beats_story ON story_beats(story_id, beat_index);
CREATE INDEX IF NOT EXISTS idx_story_beats_user_world ON story_beats(user_id, world_id);
