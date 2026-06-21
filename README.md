# AI Town Lite on Cloudflare + DeepSeek

A lightweight AI town inspired by AI Town. The project is designed for Cloudflare Workers, Cloudflare D1, and DeepSeek.

## Current Version

Current version: `v0.8.5`, released on `2026-06-21`.

The current version includes:

- Vite frontend shell with English and Chinese language switching.
- React front-end architecture split into API, i18n, map, sidebar, editor, and story history modules.
- Overlay story sidebar that does not resize or stretch the map.
- Asset-based AI Town-inspired top-down RPG tilemap using local tileset and spritesheet files.
- Tiled flip support, same-tileset landmarks, varied resident sprites, and smoother map movement.
- Viewport-aware drag bounds, map-scale landmark anchors, and slower orthogonal RPG-style walking.
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

Next planned version: `v0.9.0`, focused on a purpose-built town tilemap with enough native buildings for all story locations.

## Scripts

```bash
npm install
npm run build
npm run dev:worker
```

## Asset Credits

The pixel map renderer uses local copies of public AI Town demo assets under `public/assets/ai-town/`, including RPG tiles, object layers, the source Tiled map JSON, and character sprites. Keep these credits with the project when redistributing or publishing the app:

- AI Town by a16z-infra: https://github.com/a16z-infra/ai-town
- Original AI Town README credits include PixiJS rendering, OpenGameArt 16x16 tilesets, ansimuz assets, and Mounir Tohami UI assets.

Deployment guides:

- [Chinese deployment guide](docs/DEPLOYMENT.zh-CN.md)
- [English deployment guide](docs/DEPLOYMENT.en.md)
