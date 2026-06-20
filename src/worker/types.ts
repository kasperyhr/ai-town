export interface Env {
  APP_ENV: string;
  APP_ORIGIN: string;
  COOKIE_SECURE?: string;
  SESSION_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  DEEPSEEK_API_KEY: string;
  DEEPSEEK_MODEL: string;
  DEEPSEEK_DEBUG_LOGS?: string;
  EXPORT_MASTER_KEYS_JSON: string;
  DB: D1Database;
  ASSETS: Fetcher;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

export interface TownBootstrap {
  authenticated: boolean;
  user: null | {
    id: string;
    displayName: string;
    provider: 'github' | 'google';
  };
  defaults: {
    language: 'en' | 'zh';
    characterCount: number;
  };
  security: {
    sessionCookie: 'HttpOnly';
    csrfProtection: 'planned';
    dataIsolation: 'user_id';
  };
}

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  provider: 'github' | 'google';
  email: string | null;
  avatarUrl: string | null;
}

export interface AuthContext {
  user: AuthenticatedUser;
  sessionId: string;
  csrfTokenHash: string;
}

export interface WorldSummary {
  id: string;
  name: string;
  language: 'en' | 'zh';
  storyDay: number;
  createdAt: string;
  updatedAt: string;
  characterCount: number;
  memoryCount: number;
  storyCount: number;
  autoAdvanceEnabled: boolean;
}
