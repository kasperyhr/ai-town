import type { Language } from './types';

export type ReleaseNote = {
  version: string;
  date: string;
  title: Record<Language, string>;
  changes: Record<Language, string[]>;
};

export const currentVersion = 'v0.7.2';

export const releaseNotes: ReleaseNote[] = [
  {
    version: 'v0.7.2',
    date: '2026-06-20',
    title: {
      en: 'Overlay sidebar and draggable map viewport',
      zh: '浮层侧栏与可拖动地图视口',
    },
    changes: {
      en: [
        'Changed the story sidebar into an overlay layer so opening or closing it no longer stretches the town map.',
        'Added a fixed 16:9 town viewport so the map scales proportionally with the browser window.',
        'Added pointer dragging for the map layer so users can pan around the town without changing the page layout.',
      ],
      zh: [
        '将故事侧栏改成浮层，打开或关闭侧栏时不再拉伸小镇地图。',
        '加入固定 16:9 的小镇视口，浏览器窗口变化时地图按比例缩放。',
        '加入地图拖动能力，用户可以拖动查看小镇，而不会改变页面整体布局。',
      ],
    },
  },
  {
    version: 'v0.7.1',
    date: '2026-06-20',
    title: {
      en: 'AI Town-style map polish',
      zh: 'AI Town 风格地图优化',
    },
    changes: {
      en: [
        'Removed the empty left sidebar gutter from the signed-out screen.',
        'Reworked the town map toward an AI Town-inspired top-down RPG tilemap with grass tiles, dirt paths, water, trees, rocks, flowers, buildings, and sprite residents.',
        'Cleaned up corrupted Chinese map labels and dialogue speaker parsing.',
      ],
      zh: [
        '未登录页面不再预留空的左侧 sidebar 空间。',
        '将小镇地图改成更接近 AI Town 的俯视 RPG tilemap：草地格、泥路、水面、树、石头、花、建筑和 sprite 居民在同一张地图里呈现。',
        '修复损坏的中文地图地点名和对白说话人解析。',
      ],
    },
  },
  {
    version: 'v0.7.0',
    date: '2026-06-20',
    title: {
      en: 'Pixel town presentation',
      zh: '像素小镇展示版',
    },
    changes: {
      en: [
        'Redesigned the town map as a 2D pixel-style scene with tile texture, roads, water, plaza, sun, clouds, and vignette lighting.',
        'Replaced circular character markers with pixel sprite characters that include head, hair, body, legs, labels, shadows, and active walk animation.',
        'Added pixel-style buildings for each town location and an active scene pulse for the current beat location.',
      ],
      zh: [
        '将小镇地图重设计为 2D 像素风场景，加入 tile 纹理、道路、水面、广场、太阳、云和光影层次。',
        '将圆形角色标记替换为像素 sprite 角色，包含头部、头发、身体、腿、名字标签、阴影和活动行走动画。',
        '为每个地点加入像素建筑，并为当前 beat 地点加入活动脉冲效果。',
      ],
    },
  },
  {
    version: 'v0.6.0',
    date: '2026-06-20',
    title: {
      en: 'React front-end architecture',
      zh: 'React 前端架构版',
    },
    changes: {
      en: [
        'Rebuilt the client as a React + Vite app while keeping the Cloudflare Worker API unchanged.',
        'Split API calls, i18n, map logic, icons, sidebar, map, story history, and editors into focused modules.',
        'Kept the Cloudflare deployment model unchanged: Vite still builds static assets into dist/client.',
      ],
      zh: [
        '将前端重构为 React + Vite 应用，同时保持 Cloudflare Worker API 不变。',
        '拆分 API、双语文案、地图逻辑、图标、侧栏、地图、故事历史和编辑器模块。',
        '保持 Cloudflare 部署方式不变：Vite 仍然构建静态资源到 dist/client。',
      ],
    },
  },
  {
    version: 'v0.5.3',
    date: '2026-06-20',
    title: {
      en: 'Sidebar and map label polish',
      zh: '侧栏与地图标签优化',
    },
    changes: {
      en: [
        'Moved account actions into the left sidebar and removed provider details from the top bar.',
        'Pinned the sidebar to the left edge and cleaned up collapsed behavior.',
        'Made town character names visible by default instead of only on hover.',
      ],
      zh: [
        '将账户操作移入左侧侧栏，并从顶栏移除登录方式细节。',
        '让侧栏贴合网页最左侧，并优化收起状态。',
        '让地图上的角色名字默认显示，而不是只在 hover 时显示。',
      ],
    },
  },
  {
    version: 'v0.5.0',
    date: '2026-06-20',
    title: {
      en: 'Story history and beat-driven town map',
      zh: '故事历史与 beat 驱动地图',
    },
    changes: {
      en: [
        'Added story history so users can revisit previous generated days.',
        'Split each generated day into seven scene beats.',
        'Added a map demo layer where characters move toward the active beat location.',
      ],
      zh: [
        '加入故事历史，用户可以回看之前生成的日期。',
        '将每天剧情拆分为七个 scene beat。',
        '加入地图演示层，角色会移动到当前 beat 的地点。',
      ],
    },
  },
  {
    version: 'v0.4.0',
    date: '2026-06-20',
    title: {
      en: 'DeepSeek story generation',
      zh: 'DeepSeek 剧情生成',
    },
    changes: {
      en: [
        'Added manual next-day generation with DeepSeek.',
        'Hardened JSON parsing, retry, fallback story generation, and optional audit logs.',
        'Disabled thinking mode for structured JSON generation to avoid empty final content.',
      ],
      zh: [
        '加入手动生成下一天剧情。',
        '增强 JSON 解析、重试、兜底剧情和可选审计日志。',
        '为结构化 JSON 生成关闭 thinking mode，避免最终 content 为空。',
      ],
    },
  },
  {
    version: 'v0.3.0',
    date: '2026-06-20',
    title: {
      en: 'Character and lexicon editing',
      zh: '角色与词库编辑',
    },
    changes: {
      en: [
        'Added character creation, editing, and deletion.',
        'Added user-managed lexicon entries for story generation context.',
        'Localized seeded character attributes without extra model calls.',
      ],
      zh: [
        '加入角色创建、编辑和删除。',
        '加入用户可维护的词库，用于剧情生成上下文。',
        '对默认角色属性做本地双语显示，不额外调用模型。',
      ],
    },
  },
  {
    version: 'v0.2.5',
    date: '2026-06-20',
    title: {
      en: 'Multiple stories and encrypted transfer',
      zh: '多故事与加密迁移',
    },
    changes: {
      en: [
        'Allowed each user to keep multiple independent story saves.',
        'Added encrypted .aitown export and import.',
        'Designed exports so another user can import a snapshot and continue from that moment.',
      ],
      zh: [
        '允许每个用户拥有多个独立故事存档。',
        '加入加密 .aitown 导出和导入。',
        '支持其他用户导入某个时间点的故事快照并从那里继续。',
      ],
    },
  },
  {
    version: 'v0.2.0',
    date: '2026-06-20',
    title: {
      en: 'OAuth and user isolation',
      zh: 'OAuth 与用户隔离',
    },
    changes: {
      en: [
        'Added GitHub and Google OAuth flows.',
        'Separated user data by authenticated user and login provider.',
        'Added session cookies and CSRF checks for state-changing requests.',
      ],
      zh: [
        '加入 GitHub 和 Google OAuth 登录。',
        '按认证用户和登录 provider 隔离数据。',
        '为会话加入 Cookie，并为写操作加入 CSRF 校验。',
      ],
    },
  },
  {
    version: 'v0.1.0',
    date: '2026-06-20',
    title: {
      en: 'Cloudflare AI town foundation',
      zh: 'Cloudflare AI 小镇基础版',
    },
    changes: {
      en: [
        'Created the Cloudflare Worker + D1 + Vite foundation.',
        'Added the initial authenticated AI town shell.',
        'Added Chinese and English UI language switching.',
      ],
      zh: [
        '创建 Cloudflare Worker + D1 + Vite 基础架构。',
        '加入初始的登录后 AI 小镇界面。',
        '加入中英文界面切换。',
      ],
    },
  },
];
