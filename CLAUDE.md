# teamspeak-music-bot — XuVIIJay fork

TeamSpeak 3/5/6 音乐机器人，fork 自
[ZHANGTIANYAO1/teamspeak-music-bot](https://github.com/ZHANGTIANYAO1/teamspeak-music-bot)。
在作者版本之上添加了三大自有功能（详见 Complete 分支的 README.md）：AI 对话、加入欢迎、播放错误诊断。

## 分支模型 — 动手前必读

| 分支 | 角色 | README.md 内容 | 规则 |
|---|---|---|---|
| `main` | 上游镜像 | **必须与作者逐字一致** | 只能 fast-forward 到 `upstream/main`；不得含任何 fork 内容（包括本文件） |
| `feat/ai-chat` | AI 对话功能 | 该功能专属片段（"一、…"） | 从 main 分叉，定期 merge main |
| `feat/welcome` | 加入欢迎功能 | 该功能专属片段（"二、…"） | 同上 |
| `feat/playback-error-diagnostic` | 播放诊断 | 该功能专属片段（"三、…"） | 同上 |
| `Complete` | 三功能合集 | 三合一综合版 | 合并三个 feat 分支 |

remote：
- `origin` = fork 自己（SSH: `git@github.com:XuVIIJay/teamspeak-music-bot.git`）
- `upstream` = 作者仓库（HTTPS）。若本地不存在：
  `git remote add upstream https://github.com/ZHANGTIANYAO1/teamspeak-music-bot.git`

本文件在 `Complete` 分支维护；`main` 上不存在（main 必须与上游一致）。

## README 保护机制

`feat/*` 和 `Complete` 分支各有一个 `.gitattributes`：

```
README.md merge=keepours
```

外加本地一次性配置：

```bash
git config merge.keepours.driver true
```

这样这些分支合并任何东西时，`README.md` 自动保留自己那一份，永不冲突。

三个注意点：

1. **`main` 上绝不能有 `.gitattributes`**，否则 main 合并上游时 README 会被保护住，偏离作者。
2. `merge.keepours.driver` 是**本地**配置，不随仓库传播；换机器或重新 clone 后需重新执行一次。
3. 各 feature 分支的 README 是功能片段、Complete 的是综合版，内容不同是**设计如此**，不要试图"统一"它们。

## 更新上游的标准流程

```bash
git fetch upstream main

# 1) main 对齐上游（README 一并更新）
git switch main
git merge --ff-only upstream/main          # fork/main 从不领先上游，必定成功

# 2) 三个功能分支吸收上游（各自的 README 自动保留）
for b in feat/ai-chat feat/welcome feat/playback-error-diagnostic; do
  git switch "$b" && git merge main
done

# 3) Complete 重新合并三个功能分支（README 保留三合一版）
git switch Complete
git merge feat/ai-chat feat/welcome feat/playback-error-diagnostic

# 4) 推送
git push origin main Complete \
  feat/ai-chat feat/welcome feat/playback-error-diagnostic
```

首次操作时本地可能只有 `Complete`，其余分支需从 origin 建立跟踪：
`git switch feat/ai-chat`（会自动跟踪 `origin/feat/ai-chat`）。

## 陷阱

### package-lock.json 冲突绝不能手工解决

解决 `package.json` 后重新生成：

```bash
git checkout --theirs package-lock.json   # 或 --ours，任取一边
npm install                                # 让 npm 重算出一份一致的
git add package-lock.json
```

历史教训：commit `b357450`（引入 AI 功能时）把 lock 重写成基于旧分叉点的版本，
丢掉 `bcryptjs` / `cookie-parser` / `supertest` 等条目，且多个包版本低于 `package.json` 的 range。
后果是 `Dockerfile` 里的 `npm ci` 直接以 EUSAGE 失败，直到 `52446ba` 才修复。
**lock 变更要和功能变更分开提交**，混在一起时极难排查。

### Node 版本

上游 #152 已要求 Node 22.12+（better-sqlite3 12.10+ 不再为 Node 20 的 ABI 115 发布预编译包）。
fork 的 `package.json` 目前仍写着 `^20.19.0 || ...`，但 Node 20 实际上已装不上。
合并上游时 `package.json` 会**自动**接受这个变更（engines 行会变成上游的版本，不产生冲突）。

## 项目速览

入口 `src/index.ts`：装配音源 provider → `BotManager` → 启动 Web 服务，并拉起网易云/QQ 的 sidecar API（端口 3001 / 3200）。

```
src/ts-protocol/   自研 TeamSpeak 客户端协议（identity / voice / commands / http-query）
src/music/         音源适配器，统一 MusicProvider 接口（provider.ts）
                   netease / qq / kugou / bilibili / jellyfin / youtube / local / spotify/
src/audio/         player.ts（ffmpeg 解码 → Opus 编码 → 帧发送）、queue.ts、encoder.ts
src/bot/           manager.ts（多机器人）、instance.ts（单实例核心，最大的文件）
                   commands.ts（命令解析 + 权限门控）、profile.ts、ai.ts、voice-ducking.ts
src/web/           server.ts + api/*.ts（REST 路由）+ websocket.ts
src/data/          database.ts(SQLite) / config.ts / users.ts / permissions.ts / sessions.ts / audit.ts
web/               Vue 3 + Vite 前端，构建产物进 web/dist
data/              运行时持久化：config.json、tsmusicbot.db、cookies/、avatars/、logs/、local-audio/
```

聊天命令前缀 `!`：

- 公开：`play add queue list now lyrics vote help playlist album fm prev next skip pause resume artist ai`
- 管理员（受 `adminGroups` 门控，见 `src/bot/commands.ts` 的 `canRunCommand`）：`stop clear remove move vol mode`

## 常用命令

```bash
npm run dev     # tsx watch 开发
npm run build   # tsc + 前端构建
npm start       # 跑 dist/index.js
npm test        # vitest
```

WebUI 默认 http://localhost:3000，配置在 `data/config.json`。
