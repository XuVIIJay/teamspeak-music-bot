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

本文件和 `.gitattributes` 在三个 `feat/*` 分支与 `Complete` 上维护（内容相同）；
`main` 上不存在，因为 main 必须与上游逐字一致。

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
git switch main                            # 首次需 git switch -c main origin/main，见文末说明
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

首次操作时本地可能只有 `Complete`，其余分支需从 origin 建立跟踪。
**注意 `main` 在 `origin` 和 `upstream` 下同名**，直接 `git switch main` 会以
"匹配多个（2 个）远程跟踪分支"失败，必须用显式形式：

```bash
git switch -c main origin/main
git switch -c feat/ai-chat origin/feat/ai-chat
git switch -c feat/welcome origin/feat/welcome
git switch -c feat/playback-error-diagnostic origin/feat/playback-error-diagnostic
```

本地分支建好之后，`git switch main` / `git switch feat/xxx` 就不再有歧义。

## 陷阱

### package-lock.json 绝不能手工编辑；merge 之后必须校验

**git 对 lock 的行级三方合并不可靠**：即使 merge 没有报冲突，也可能产出一个与
`package.json` 不一致的 lock。真实案例：`feat/ai-chat` merge `main` 之后，lock 仍是
`b357450` 破坏过的 492 条版本（另两个 feature 分支和 main 是 507 条），`npm ci` 直接失败。

所以**每次更新上游（上面流程的第 2、3 步）之后都要校验一遍**，不要等冲突出现：

```bash
for b in main feat/ai-chat feat/welcome feat/playback-error-diagnostic Complete; do
  d=$(mktemp -d)
  git show "$b:package.json"      > "$d/package.json"
  git show "$b:package-lock.json" > "$d/package-lock.json"
  (cd "$d" && npm ci --dry-run >/dev/null 2>&1) \
    && echo "$b ✓" || echo "$b ✗ lock 与 package.json 不一致"
  rm -rf "$d"
done
```

（`npm ci --dry-run` 几秒出结果，且不碰 `node_modules`。）

发现不一致时**不要手工编辑 lock**。`package.json` 相同的分支应共用同一份 lock：

```bash
git checkout <已验证正确的分支> -- package-lock.json
npm ci --dry-run                  # 复核
git commit -m "chore(deps): sync package-lock.json with package.json"
```

没有可复用的正确版本时，才重新生成（只重算 lock，不动 `node_modules`）：

```bash
npm install --package-lock-only
```

**各分支 lock 的预期条目数**（截至 2026-09-22）。`package.json` 相同的分支，
lock 应完全相同：

| 分支 | package.json | lock 条目数 |
|---|---|---|
| `main` / `feat/welcome` / `feat/playback-error-diagnostic` | 无 `dotenv` | 507 |
| `feat/ai-chat` / `Complete` | 含 `dotenv` | 510 |

历史教训：commit `b357450`（引入 AI 功能时）把 lock 重写成基于旧分叉点的版本，
丢掉 `bcryptjs` / `cookie-parser` / `supertest` 等条目，且多个包版本低于 `package.json` 的 range。
后果是 `Dockerfile` 里的 `npm ci` 以 EUSAGE 失败，直到 `52446ba` 修好 `Complete`，
但 `feat/ai-chat` 自己那份漏了，又过一轮才补上。
**lock 变更要和功能变更分开提交**，混在一起时极难排查。

### docker 相关文件（刻意保留，不要删）

`.dockerignore`、`.github/workflows/docker-publish.yml`、`scripts/docker/` 继承自上游，
与安装脚本（`scripts/setup.sh` / `setup.bat` / `install.sh`）**零耦合**——安装脚本用
`npm install`，完全不碰 docker。

刻意保留而不是删掉：`main` 必须与上游逐字一致；且上游会修改 `Dockerfile`
（#152 就把 `node:20` 改成了 `node:22`），fork 里删掉它会让每次 merge 报
`modify/delete` 冲突。`docker-publish.yml` 只在推 `v*.*.*` tag 时触发，其
`IMAGE_NAME` 指向作者的 GHCR 命名空间 —— fork 里打 tag 会因无权限而失败，
不发镜像就不用管。

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
