# 上游更新指南

本仓库 fork 自
[ZHANGTIANYAO1/teamspeak-music-bot](https://github.com/ZHANGTIANYAO1/teamspeak-music-bot)，
在上游版本之上维护三个自有功能：AI 对话、加入欢迎、播放错误诊断。
本文档描述把上游更新同步进本仓库的标准流程、必须的校验，以及发布版本的步骤。

## 分支模型

| 分支 | 角色 | README.md 内容 | 规则 |
|---|---|---|---|
| `main` | 上游镜像 | **必须与作者逐字一致** | 只做 `--ff-only` 对齐 `upstream/main`；不得含任何 fork 内容 |
| `feat/ai-chat` | AI 对话功能 | 该功能专属片段（"一、…"） | 从 main 分叉，定期 merge main |
| `feat/welcome` | 加入欢迎功能 | 该功能专属片段（"二、…"） | 同上 |
| `feat/playback-error-diagnostic` | 播放诊断 | 该功能专属片段（"三、…"） | 同上 |
| `Complete` | 三功能合集 | 三合一综合版 | 合并三个 feat 分支 |

远端：

- `origin` = 本 fork
- `upstream` = 作者仓库。若本地不存在：

```bash
git remote add upstream https://github.com/ZHANGTIANYAO1/teamspeak-music-bot.git
```

首次操作时若本地只有 `Complete`，其余分支需从 origin 建立跟踪。
`main` 在 `origin` 和 `upstream` 下同名，直接 `git switch main` 会以
"匹配多个远程跟踪分支"失败，必须用显式形式：

```bash
git switch -c main origin/main
git switch -c feat/ai-chat origin/feat/ai-chat
git switch -c feat/welcome origin/feat/welcome
git switch -c feat/playback-error-diagnostic origin/feat/playback-error-diagnostic
```

## README 保护机制

`feat/*` 与 `Complete` 分支各有一个 `.gitattributes`：

```
README.md merge=keepours
```

外加本地一次性配置：

```bash
git config merge.keepours.driver true
```

这样这些分支合并任何内容时，`README.md` 自动保留自己那一份，永不冲突。

三个注意点：

1. **`main` 上绝不能有 `.gitattributes`**，否则 main 合并上游时 README 会被保护住，偏离作者。
2. `merge.keepours.driver` 是**本地**配置，不随仓库传播；换机器或重新 clone 后需重新执行一次。
3. 各 feature 分支的 README 是功能片段、Complete 的是综合版，内容不同是**设计如此**，不要试图"统一"它们。

## 标准更新流程

```bash
git fetch upstream main

# 1) main 对齐上游（README 一并更新）
git switch main
git merge --ff-only upstream/main        # fork/main 从不领先上游，必定成功

# 2) 三个功能分支吸收上游（各自的 README 自动保留）
for b in feat/ai-chat feat/welcome feat/playback-error-diagnostic; do
  git switch "$b" && git merge main
done

# 3) Complete 重新合并三个功能分支（README 保留三合一版）
git switch Complete
git merge feat/ai-chat feat/welcome feat/playback-error-diagnostic

# 4) 合并后校验（见下一节），然后推送
git push origin main Complete \
  feat/ai-chat feat/welcome feat/playback-error-diagnostic
```

冲突处理：

- `README.md`：由 merge driver 自动保留本分支版本，无需手工处理。
- `package-lock.json`：保留本仓库已校验过的一份（见下节），不要直接接受上游/远端版本。
- 其他文件按语义手动解决；合并前可用
  `git merge-tree --write-tree --name-only <ours> <theirs>` 预览冲突文件。

## 合并后必做校验

### 1. lockfile 与 package.json 必须一致

**不要等冲突出现才检查。** 每个分支都跑一遍：

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

`npm ci --dry-run` 几秒出结果，且不碰 `node_modules`。

发现不一致时**不要手工编辑 lock**：

```bash
# package.json 相同的分支应共用同一份已验证的 lock
git checkout <已验证正确的分支> -- package-lock.json
npm ci --dry-run                    # 复核

# 没有可复用的正确版本时，才重新生成（只重算 lock，不动 node_modules）
npm install --package-lock-only
```

### 2. 构建

```bash
npm run build        # 后端 tsc + 前端 Vite 构建
```

### 3. 测试

```bash
npm test             # vitest
```

注意基线：上游自身偶有失败测试（例如 v1.15.4 的播放淡出改动没有同步更新测试里
的 fake player，导致 `setTransportRamp is not a function`）。判断是否为 fork 回归时，
**先在干净的 `main` 上跑同一个测试复现**；clean main 上也失败的属于上游基线问题。

### 4. 推送

所有分支对 origin 应为快进；若远端有新提交，先 `git fetch origin` 并合并
`origin/<分支>` 回来（远端可能带有 README/.gitattributes 等仓库维护提交），
冲突按上一节规则解决后再推送。

## 发布版本

1. 在 `Complete` 上打 annotated tag，沿用 `complete-vX.Y.Z` 命名：

```bash
git tag -a complete-v1.4.0 -m "完整版 complete-v1.4.0 (上游 v1.15.4)" Complete
git push origin complete-v1.4.0
```

2. 用 `gh` 创建 GitHub Release，标题与 tag 对应（如「完整版 complete-v1.4.0」），
   正文建议包含：基于哪个上游版本、三个自有功能的说明、按上游版本分段的变更摘要、
   本仓库维护项、升级提示（Node 版本、需要重新构建、数据库表变化等）。

```bash
gh release create complete-v1.4.0 --title "完整版 complete-v1.4.0" \
  --notes-file release-notes.md --latest
```

## 已知陷阱

### package-lock.json 绝不能手工编辑

git 对 lock 的行级三方合并不可靠：即使没有报冲突，也可能产出与 `package.json`
不一致的 lock。历史案例：AI 功能提交曾把 lock 重写成基于旧分叉点的版本，
丢掉 `bcryptjs` / `cookie-parser` / `supertest` 等条目，`npm ci` 直接失败。
lock 变更应与功能变更分开提交，混在一起时极难排查。

### docker 相关文件刻意保留

`.dockerignore`、`.github/workflows/docker-publish.yml`、`scripts/docker/` 继承自上游，
与安装脚本零耦合。保留原因：`main` 必须与上游逐字一致；且上游会修改 `Dockerfile`，
删掉会让每次 merge 报 `modify/delete` 冲突。`docker-publish.yml` 只在推 `v*.*.*`
tag 时触发，其镜像名指向作者的 GHCR 命名空间，发布镜像用不到它。

### Node 版本

上游要求 Node 22.12+（better-sqlite3 12.10+ 不再为 Node 20 的 ABI 发布预编译包）。
合并上游时 `package.json` 的 engines 行会自动接受上游变更，不产生冲突。

## 部署副本

部署副本以 `Complete` 分支构建运行：合并 → 校验 lock → `npm run build` →
重启服务。部署副本中可能存在未提交的本地补丁（如日志脱敏），合并与构建时保留，
不要提交到任何分支。
