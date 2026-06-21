# AI Town Lite on Cloudflare + DeepSeek

A lightweight AI town inspired by AI Town. The project is designed for Cloudflare Workers, Cloudflare D1, and DeepSeek.

## Current Version

Current version: `v0.7.2`, released on `2026-06-20`.

The current version includes:

- Vite frontend shell with English and Chinese language switching.
- React front-end architecture split into API, i18n, map, sidebar, editor, and story history modules.
- Overlay story sidebar that does not resize or stretch the map.
- AI Town-inspired top-down RPG tilemap with grass tiles, paths, water, buildings, and sprite-like characters.
- Fixed-ratio draggable town map viewport.
- Cloudflare Worker API skeleton.
- D1 schema for users, sessions, worlds, characters, memories, lexicon entries, and stories.
- Security headers and configuration checks.
- GitHub and Google OAuth foundations.
- Multiple story saves per user.
- Encrypted binary `.aitown` export/import packages.
- Editable story characters.
- Editable story lexicon entries.
- DeepSeek-powered daily story generation.
- Manual next-day story generation by default.
- Story history per save.
- Seven scene beats per generated day.
- Beat-driven town map.
- Characters move to the active beat location when they participate in a scene.
- Per-story Cron eligibility, with Cron disabled by default in `wrangler.jsonc`.
- Local and Cloudflare deployment documentation draft.

Next planned version: `v0.8.0`, focused on deeper story presentation, richer scene details, and automatic recurring character generation.

## Scripts

```bash
npm install
npm run build
npm run dev:worker
```

Deployment guides:

- [Chinese deployment guide](docs/DEPLOYMENT.zh-CN.md)
- [English deployment guide](docs/DEPLOYMENT.en.md)
