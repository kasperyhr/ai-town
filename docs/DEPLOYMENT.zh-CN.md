# AI Town Lite 部署文档

这份文档面向不熟悉代码的工程师，说明如何在 Windows、macOS 本地运行，以及如何部署到 Cloudflare。你说过会等应用准备好后再部署，所以本文会持续更新，最后会成为可直接照着操作的版本。

当前代码对应版本 `v0.8.3`：已包含 Cloudflare Worker、D1、GitHub/Google OAuth、用户隔离、多故事存档、加密 `.aitown` 导入导出、角色和词库编辑、DeepSeek 生成下一天、故事历史、一天 7 个 scene beat 的时间线、React 前端架构、浮层故事侧栏，以及使用本地 tileset 和 spritesheet 文件渲染的 AI Town 风格像素地图。0.8.3 移除了不匹配的假建筑，保留轻量地点标签，并加入角色行走 sprite 动画。自动生成新角色会在后续版本补上。

## 1. 本地部署和 Cloudflare 部署的区别

本地部署：

- 在你的电脑上运行，适合预览、测试和排错。
- 常用地址是 `http://127.0.0.1:8787`。
- 使用本地模拟的 Worker 和本地 D1 数据库。
- 不适合给真实用户使用。

Cloudflare 部署：

- 运行在 Cloudflare 全球网络上。
- 会得到线上地址，例如 `https://ai-town-cloudflare-deepseek.<你的账号>.workers.dev`。
- 使用真实 D1 数据库和 Cloudflare Secrets。
- 适合配置 GitHub/Google OAuth 回调地址，并给用户访问。

## 2. 需要准备

1. Node.js 20 或更新版本。
2. Cloudflare 账号。
3. DeepSeek API Key。
4. GitHub 账号，用来创建 GitHub OAuth App。
5. Google 账号，用来创建 Google OAuth Client。

## 3. 进入项目目录

Windows PowerShell：

```powershell
cd D:\CodexProjects\ai-town-cloudflare-deepseek
```

macOS Terminal：

```bash
cd /path/to/ai-town-cloudflare-deepseek
```

## 4. 安装依赖

Windows PowerShell 或 macOS Terminal：

```bash
npm install
```

如果失败，先不要删除项目。优先检查 Node.js 版本、npm 网络、公司代理、Windows 写入权限。

## 5. 本地配置

复制本地环境变量模板。

Windows PowerShell：

```powershell
Copy-Item .dev.vars.example .dev.vars
```

macOS Terminal：

```bash
cp .dev.vars.example .dev.vars
```

打开 `.dev.vars`，填入类似下面的内容：

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

生成 `SESSION_SECRET` 或导出主密钥：

Windows PowerShell：

```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

macOS Terminal：

```bash
openssl rand -base64 32
```

`EXPORT_MASTER_KEYS_JSON` 必须保密。它不会直接写进导出的故事文件，而是用于解密每次导出时自动生成的 data key。

## 6. 本地 D1 数据库迁移

第一次使用 Wrangler 时先登录 Cloudflare：

```bash
npx wrangler login
```

应用本地数据库迁移：

```bash
npm run db:migrate:local
```

当前迁移文件：

- `0001_initial.sql`：用户、会话、故事存档、角色、记忆、词库、故事。
- `0002_story_beats.sql`：自动推进开关和故事 scene beat。

## 7. 本地运行

```bash
npm run dev:worker
```

浏览器打开：

```text
http://127.0.0.1:8787
```

健康检查：

```text
http://127.0.0.1:8787/api/health
```

看到 `ok: true` 表示 Worker 已启动。看到 `configured: false` 表示某些 OAuth、DeepSeek 或密钥配置还没填完整。

## 8. Cloudflare 部署

### 8.1 创建 D1 数据库

```bash
npx wrangler d1 create ai-town-db
```

命令会返回 `database_id`。复制它，打开 `wrangler.jsonc`，替换：

```jsonc
"database_id": "replace-with-cloudflare-d1-database-id"
```

### 8.2 应用线上数据库迁移

```bash
npm run db:migrate:remote
```

### 8.3 设置 Cloudflare Secrets

```bash
npx wrangler secret put SESSION_SECRET
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put DEEPSEEK_API_KEY
npx wrangler secret put EXPORT_MASTER_KEYS_JSON
```

普通变量可以放在 `wrangler.jsonc` 的 `vars` 或 Cloudflare Dashboard：

```text
APP_ORIGIN
GITHUB_CLIENT_ID
GOOGLE_CLIENT_ID
DEEPSEEK_MODEL
```

不要把 `EXPORT_MASTER_KEYS_JSON`、OAuth Secret 或 DeepSeek Key 提交到 GitHub。

### 8.4 构建并部署

```bash
npm run deploy
```

成功后，终端会显示线上访问地址。

## 9. OAuth 配置

### 9.1 GitHub OAuth App

进入：

```text
GitHub -> Settings -> Developer settings -> OAuth Apps -> New OAuth App
```

本地测试：

```text
Homepage URL:
http://127.0.0.1:8787

Authorization callback URL:
http://127.0.0.1:8787/api/auth/github/callback
```

线上部署：

```text
Homepage URL:
https://你的线上域名

Authorization callback URL:
https://你的线上域名/api/auth/github/callback
```

创建后复制：

- `Client ID` -> `GITHUB_CLIENT_ID`
- `Client Secret` -> `GITHUB_CLIENT_SECRET`

### 9.2 Google OAuth Client

进入 Google Cloud Console：

```text
APIs & Services -> Credentials -> Create Credentials -> OAuth client ID
```

应用类型选择 `Web application`。

本地测试：

```text
Authorized JavaScript origins:
http://127.0.0.1:8787

Authorized redirect URIs:
http://127.0.0.1:8787/api/auth/google/callback
```

线上部署：

```text
Authorized JavaScript origins:
https://你的线上域名

Authorized redirect URIs:
https://你的线上域名/api/auth/google/callback
```

创建后复制：

- `Client ID` -> `GOOGLE_CLIENT_ID`
- `Client Secret` -> `GOOGLE_CLIENT_SECRET`

注意：同一个人用 GitHub 登录和用 Google 登录，会被视为两个独立账号，因此会看到不同的故事。这是当前设计。

## 10. DeepSeek 配置

DeepSeek Key 必须作为 Secret：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

默认模型：

```text
deepseek-v4-flash
```

如果以后要换模型，只改 `DEEPSEEK_MODEL`。

本地排查 DeepSeek JSON 问题时，可以在 `.dev.vars` 中临时设置：

```text
DEEPSEEK_DEBUG_LOGS=true
```

开启后，Worker 日志会打印 `deepseek_response_summary` 和 `deepseek_response_body`，用于审计模型返回内容。注意：这些日志可能包含故事文本、角色设定和用户输入上下文，线上环境默认应保持 `false`。

点击页面里的 `Generate next day / 生成下一天` 后，系统会读取当前故事的角色、记忆、词库和最近剧情，调用 DeepSeek 生成当天故事，并写入：

- `stories`
- `story_beats`
- 新的 story memory
- 更新后的 `worlds.story_day`

生成语言会跟随当前界面语言。也就是说，界面切换到中文后再点击生成，Worker 会要求 DeepSeek 直接输出中文故事，而不是先生成英文再额外调用一次翻译 API。内置默认角色的性别、性格、样貌和背景使用本地双语词典显示，也不会产生额外 API 调用。

## 11. 手动推进、Cron 和历史

当前默认是手动推进。`wrangler.jsonc` 默认没有启用 Cron trigger。

前端提供一个 `Auto advance by Cron / Cron 自动推进` 开关。这个开关只决定某个故事是否允许被 Cron 推进。由于项目默认没有配置 Cron，所以即使打开开关，也不会自动生成，除非你额外在 `wrangler.jsonc` 加上：

```jsonc
"triggers": {
  "crons": ["0 2 * * *"]
}
```

设计原因：

- 新手更容易控制成本和剧情节奏。
- 用户几天没登录，也不会被自动推进很多天。
- 如果以后打开 Cron，只有开启了自动推进的故事会被处理。

故事历史：

- 每次手动生成都会保存一条历史 day。
- 用户可以回看之前的 day。
- 每个 day 会保存 7 个 scene beat：Dawn、Morning、Noon、Afternoon、Evening、Night、Late Night。
- 前端 5B 已加入地图演示层。切换当前 beat 时，参与该 beat 的角色会移动到对应地点附近。

## 12. 加密导出和导入

用户导出时会下载 `.aitown` 文件。这个文件不是 JSON，也不是明文文本，而是二进制加密包：

- 外层只保留最小 magic/version 信息。
- master key id、data key、导出时间等 metadata 在 encrypted header 内。
- 故事、角色、记忆、词库、剧情和 scene beat 在 encrypted payload 内。
- 每次导出都会自动生成新的随机 data key。
- Worker 使用服务端 master key 加密/解密 data key。

用户 A 在时间点 1 导出后，可以给用户 B 导入。用户 B 看到的是时间点 1 的独立快照；用户 A 后来发展到时间点 2 不会影响用户 B。

如果删除旧 master key，依赖旧 master key 的旧 `.aitown` 文件将无法再导入。

## 13. 当前 API

主要 API：

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

## 14. 当前完成和未完成

已完成：

- GitHub/Google OAuth。
- HttpOnly session cookie。
- CSRF 校验。
- 多用户数据隔离。
- 每用户多个故事。
- 默认 3 个角色、10 条记忆。
- 角色新增、编辑、删除。
- 词库新增、删除。
- DeepSeek 手动生成下一天。
- 故事历史和 7 个 scene beat。
- 随 scene beat 变化的小镇地图和角色移动。
- `.aitown` 加密导入导出。
- Cron 默认关闭，可按故事开启资格。
- Windows/macOS 本地部署说明。
- Cloudflare 部署说明。

后续版本计划：

- 故事发展中自动生成新角色。
