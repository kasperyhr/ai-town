# AI Town Lite Deployment Guide

This guide is written for engineers who may not be familiar with code. It explains how to run the project locally on Windows and macOS, and how to deploy it on Cloudflare. You said you will deploy only after the app is ready, so this document will keep evolving into a final step-by-step manual.

The current code is version `v0.7.1`: Cloudflare Worker, D1, GitHub/Google OAuth, user isolation, multiple story saves, encrypted `.aitown` import/export, character and lexicon editing, DeepSeek next-day generation, story history, a 7-beat daily timeline, a React front-end architecture, and an AI Town-inspired top-down RPG tilemap with sprite-like character presentation. Automatic new character generation is planned for a later version.

## 1. Local Deployment vs Cloudflare Deployment

Local deployment:

- Runs on your own computer for preview, testing, and debugging.
- Usually available at `http://127.0.0.1:8787`.
- Uses local Worker simulation and a local D1 database.
- Not suitable for real users.

Cloudflare deployment:

- Runs on Cloudflare's global network.
- Gives you a public URL such as `https://ai-town-cloudflare-deepseek.<your-account>.workers.dev`.
- Uses real D1 databases and Cloudflare Secrets.
- Suitable for GitHub/Google OAuth callback URLs and real user access.

## 2. Prerequisites

1. Node.js 20 or newer.
2. A Cloudflare account.
3. A DeepSeek API key.
4. A GitHub account for creating a GitHub OAuth App.
5. A Google account for creating a Google OAuth Client.

## 3. Enter the Project Directory

Windows PowerShell:

```powershell
cd D:\CodexProjects\ai-town-cloudflare-deepseek
```

macOS Terminal:

```bash
cd /path/to/ai-town-cloudflare-deepseek
```

## 4. Install Dependencies

Windows PowerShell or macOS Terminal:

```bash
npm install
```

If installation fails, do not delete the project first. Check the Node.js version, npm network access, company proxy settings, and Windows write permissions.

## 5. Local Configuration

Copy the local environment template.

Windows PowerShell:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

macOS Terminal:

```bash
cp .dev.vars.example .dev.vars
```

Open `.dev.vars` and fill values like these:

```text
APP_ORIGIN=http://127.0.0.1:8787
SESSION_SECRET=replace-with-a-long-random-string
GITHUB_CLIENT_ID=replace-me
GITHUB_CLIENT_SECRET=replace-me
GOOGLE_CLIENT_ID=replace-me
GOOGLE_CLIENT_SECRET=replace-me
DEEPSEEK_API_KEY=replace-me
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_DEBUG_LOGS=false
EXPORT_MASTER_KEYS_JSON={"main":"replace-with-a-32-byte-random-master-secret"}
```

Generate `SESSION_SECRET` or an export master key.

Windows PowerShell:

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

macOS Terminal:

```bash
openssl rand -base64 32
```

`EXPORT_MASTER_KEYS_JSON` must stay secret. It is not written directly into exported stories. It is used to decrypt the data key generated for each export.

## 6. Local D1 Migrations

Log in to Cloudflare the first time you use Wrangler:

```bash
npx wrangler login
```

Apply local database migrations:

```bash
npm run db:migrate:local
```

Current migration files:

- `0001_initial.sql`: users, sessions, story saves, characters, memories, lexicon, and stories.
- `0002_story_beats.sql`: auto-advance setting and story scene beats.

## 7. Run Locally

```bash
npm run dev:worker
```

Open:

```text
http://127.0.0.1:8787
```

Health check:

```text
http://127.0.0.1:8787/api/health
```

`ok: true` means the Worker started. `configured: false` means some OAuth, DeepSeek, or key configuration is still missing.

## 8. Cloudflare Deployment

### 8.1 Create a D1 Database

```bash
npx wrangler d1 create ai-town-db
```

The command returns a `database_id`. Copy it, open `wrangler.jsonc`, and replace:

```jsonc
"database_id": "replace-with-cloudflare-d1-database-id"
```

### 8.2 Apply Remote Migrations

```bash
npm run db:migrate:remote
```

### 8.3 Set Cloudflare Secrets

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put EXPORT_MASTER_KEYS_JSON
```

Non-secret variables can be configured in `wrangler.jsonc` under `vars`, or in the Cloudflare Dashboard:

```text
APP_ORIGIN
GITHUB_CLIENT_ID
GOOGLE_CLIENT_ID
DEEPSEEK_MODEL
```

Do not commit `EXPORT_MASTER_KEYS_JSON`, OAuth secrets, or the DeepSeek key to GitHub.

### 8.4 Build and Deploy

```bash
npm run deploy
```

After deployment succeeds, the terminal will show the public URL.

## 9. OAuth Configuration

### 9.1 GitHub OAuth App

Go to:

```text
GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

Local testing:

```text
Homepage URL:
http://127.0.0.1:8787

Authorization callback URL:
http://127.0.0.1:8787/api/auth/github/callback
```

Production:

```text
Homepage URL:
https://your-production-domain

Authorization callback URL:
https://your-production-domain/api/auth/github/callback
```

After creation, copy:

- `Client ID` -> `GITHUB_CLIENT_ID`
- `Client Secret` -> `GITHUB_CLIENT_SECRET`

### 9.2 Google OAuth Client

Go to Google Cloud Console:

```text
APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
```

Choose `Web application`.

Local testing:

```text
Authorized JavaScript origins:
http://127.0.0.1:8787

Authorized redirect URIs:
http://127.0.0.1:8787/api/auth/google/callback
```

Production:

```text
Authorized JavaScript origins:
https://your-production-domain

Authorized redirect URIs:
https://your-production-domain/api/auth/google/callback
```

After creation, copy:

- `Client ID` -> `GOOGLE_CLIENT_ID`
- `Client Secret` -> `GOOGLE_CLIENT_SECRET`

Important: the same person signing in with GitHub and Google is treated as two separate accounts and will see different stories. This is intentional.

## 10. DeepSeek Configuration

Set the DeepSeek key as a Secret:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

Default model:

```text
deepseek-v4-flash
```

To use another model later, change `DEEPSEEK_MODEL`.

When debugging DeepSeek JSON issues locally, you can temporarily set this in `.dev.vars`:

```text
DEEPSEEK_DEBUG_LOGS=true
```

When enabled, the Worker logs `deepseek_response_summary` and `deepseek_response_body` for audit. These logs may contain story text, character settings, and user-provided context, so production should normally keep this value `false`.

When the user clicks `Generate next day`, the system reads the current story's characters, memories, lexicon, and recent plots, calls DeepSeek, and writes:

- `stories`
- `story_beats`
- a new story memory
- the updated `worlds.story_day`

The generation language follows the current UI language. If the UI is switched to Chinese before generation, the Worker asks DeepSeek to write the story directly in Chinese instead of generating English first and calling a separate translation API. Built-in default character gender, personality, appearance, and backstory are displayed through a local bilingual dictionary, so they do not create extra API calls either.

## 11. Manual Progression, Cron, and History

The default mode is manual progression. `wrangler.jsonc` does not enable a Cron trigger by default.

The frontend includes an `Auto advance by Cron` toggle. This toggle only marks a story as eligible for Cron progression. Since Cron is not configured by default, enabling it does nothing unless you also add this to `wrangler.jsonc`:

```jsonc
"triggers": {
  "crons": ["0 2 * * *"]
}
```

Reasoning:

- Easier for beginners to control cost and story pacing.
- Users who do not log in for several days will not automatically skip ahead.
- If Cron is enabled later, only stories with auto advance enabled will be processed.

Story history:

- Every manual generation creates one historical day.
- Users can revisit previous days.
- Each day stores 7 scene beats: Dawn, Morning, Noon, Afternoon, Evening, Night, Late Night.
- Version v0.5.0 added the map demo layer. When the selected beat changes, characters participating in that beat move toward the beat location.

## 12. Encrypted Export and Import

Export downloads a `.aitown` file. It is not JSON and not plaintext. It is a binary encrypted package:

- The outer file keeps only minimal magic/version information.
- Master key id, data key, export time, and metadata live inside the encrypted header.
- Stories, characters, memories, lexicon, plots, and scene beats live inside the encrypted payload.
- Every export generates a fresh random data key.
- The Worker uses the server-side master key to encrypt/decrypt that data key.

User A can export at time point 1 and send the file to user B. User B imports an independent snapshot at time point 1. If user A later reaches time point 2, user B is not affected.

If you delete an old master key, old `.aitown` files depending on that master key can no longer be imported.

## 13. Current API

Main API routes:

- `GET /api/health`
- `GET /api/bootstrap`
- `GET /api/me`
- `POST /api/logout`
- `GET /api/auth/github/start`
- `GET /api/auth/github/callback`
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `GET /api/worlds`
- `POST /api/worlds`
- `GET /api/worlds/:id`
- `DELETE /api/worlds/:id`
- `PATCH /api/worlds/:id/settings`
- `GET /api/worlds/:id/content`
- `POST /api/worlds/:id/export`
- `POST /api/worlds/import`
- `POST /api/worlds/:id/generate-day`
- `GET /api/worlds/:id/stories`
- `GET /api/worlds/:id/stories/:day`
- `POST /api/worlds/:id/characters`
- `PATCH /api/worlds/:id/characters/:characterId`
- `DELETE /api/worlds/:id/characters/:characterId`
- `POST /api/worlds/:id/lexicon`
- `DELETE /api/worlds/:id/lexicon/:lexiconId`

## 14. Current Completion

Completed:

- GitHub/Google OAuth.
- HttpOnly session cookie.
- CSRF checks.
- Multi-user data isolation.
- Multiple stories per user.
- Default 3 characters and 10 memories.
- Character create, edit, delete.
- Lexicon create and delete.
- Manual DeepSeek next-day generation.
- Story history and 7 scene beats.
- Beat-driven town map and character movement.
- Encrypted `.aitown` import/export.
- Cron disabled by default, with per-story eligibility.
- Windows/macOS local deployment instructions.
- Cloudflare deployment instructions.

Planned later versions:

- Later: automatic new character generation as stories develop.
