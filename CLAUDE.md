# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — run from source with `tsx watch` (no build step)
- `npm run build` — type-check + compile backend (`tsc`) then build the web SPA (`npm run build:web`)
- `npm start` — run the compiled bot (`node dist/index.js`); a `prestart` hook runs `scripts/check-native.mjs`
- `npm test` — run all unit tests once (`vitest run`); `npm run test:watch` for watch mode
- `npx vitest run <path>` — run a single test file (tests are `*.test.ts` co-located with source)
- `cd web && npm run dev` — Vite dev server for the SPA (proxy to the backend API)

Node version matters: engines are `^20.19.0 || ^22.12.0 || >=24.0.0` (see below for native modules).

## Architecture

Single-process monolith (TypeScript, ESM — `"type": "module"` in package.json, so relative imports in `src/` use `.js` extensions even though files are `.ts`). Everything is composed in `src/index.ts`:

- **Config + data** — `src/data/config.ts` (schema/defaults for `data/config.json`) and `src/data/database.ts` (better-sqlite3 at `data/tsmusicbot.db`: bot instances, users, sessions, audit log, permissions, avatars, favorites, saved queues). Runtime state that must survive restarts lives under `data/` (config.json, cookies/, logs/, avatars/, spotify/).
- **Music providers** — `src/music/provider.ts` defines the `MusicProvider` interface (search, getSongUrl, getSongDetail, getPlaylistSongs, getLyrics, getQrCode/checkQrCodeStatus auth flow, getAuthStatus, optional personal FM). One class per platform: `netease`, `qq`, `bilibili`, `local`, `kugou`, `spotify/`, `jellyfin`, plus `youtube`. NetEase and QQ delegate to in-process sidecar HTTP APIs started by `src/music/api-server.ts` (NeteaseCloudMusicApi on port 3001, qq-music-api on port 3200, both gated by `enabledProviders`). Providers are shared process-wide across all bots; per-bot playback never owns a provider.
- **Bot layer** — `src/bot/manager.ts` (`BotManager`) owns the lifecycle of any number of `BotInstance`s (create/start/stop/remove, persist + auto-connect on boot). `src/bot/instance.ts` is the heart (~2500 lines): one TeamSpeak connection, one `AudioPlayer`, one `PlayQueue`, and all chat-command logic. Incoming text messages are parsed by `src/bot/commands.ts` (`parseCommand` → `ParsedCommand`, with `PUBLIC_COMMANDS` / `ADMIN_COMMANDS` sets) and dispatched by `executeCommand`'s switch to `cmd*` methods.
- **TeamSpeak protocol** — `src/ts-protocol/client.ts` wraps `@honeybbq/teamspeak-client` and auto-detects TS3 vs TS6 (`protocol-detect.ts`). TS3 uses raw-TCP ServerQuery (port 10011, `connection.ts`); TS6 uses HTTP query (ports 10080/10443, `http-query.ts`). Voice audio is sent through a managed voice client (`managed-voice-clients.ts`, `voice-endpoint.ts`).
- **Audio pipeline** — `src/audio/player.ts` (`AudioPlayer`): spawns ffmpeg (from `ffmpeg-static` or a system `ffmpeg` on PATH) → decodes to s16le PCM → Opus-encodes (`src/audio/encoder.ts`) → emits `frame` events that `BotInstance` forwards to the TS voice client. Emits `trackEnd` to advance the queue. `src/audio/queue.ts` (`PlayQueue`) is the play queue: modes (`seq`/`loop`/`random`/`rloop`), prev/next history, and queue snapshots for restart restore. Player features that layer on top: voice ducking (`voice-ducking.ts`), auto-pause on empty channel (`auto-pause.ts`), idle timeout.
- **Web layer** — `src/web/server.ts` (Express) serves the REST API (routers in `src/web/api/`), a WebSocket at `/ws` for live player state (`websocket.ts`), and the built SPA from `web/dist`. Auth is cookie-session based (`src/web/api/auth.ts`, `src/web/api/session.ts`, `src/data/sessions.ts`) with CSRF-origin and permission middleware (`src/web/middleware/`). The SPA (`web/`) is Vue 3 + Pinia + Vue Router + Vite; it talks to the API through `web/src/api/http.ts` and a WS composable (`web/src/composables/useWebSocket.ts`).
- **Fork-specific features** (this repo is an "作者自用版" fork of ZHANGTIANYAO1/teamspeak-music-bot): AI chat command `!ai` (`src/bot/ai.ts` + `cmdAi` in instance.ts, DeepSeek API key in config), join-welcome messages (clientEnter/clientMoved handlers in instance.ts, per-bot toggle in the bot profile config), and playback-error diagnostics that check NetEase/QQ login + VIP state before reporting a failed play.

### Common change flows

- **New music source**: implement `MusicProvider` in `src/music/`, register it in `src/index.ts` (provider creation, cookie load, quality restore) and thread it through `BotManager`/`BotInstance`/`createWebServer`.
- **New chat command**: add a case in `executeCommand` (instance.ts), a `cmd*` method, and register the name in `PUBLIC_COMMANDS` or `ADMIN_COMMANDS` (commands.ts). `ADMIN_COMMANDS` are permission-gated by `adminGroups`.
- **Queue/playback changes**: touch `PlayQueue` and/or `AudioPlayer`; `BotInstance` orchestrates `resolveAndPlay` / `playNext` and rebuilds ffmpeg args with `buildFfmpegArgs` (URL → output-side `-ss` seek).

## Gotchas

- **Native modules are ABI-locked.** `@discordjs/opus` and `better-sqlite3` compile against one Node major; launching under another dies with a `NODE_MODULE_VERSION` error. `npm start` runs `scripts/check-native.mjs` as a preflight to catch this. Fix by re-running `scripts/setup.sh` (or `scripts/download-binaries.mjs`), which rebuilds/downloads binaries for the current Node. When working in this repo, install with the same Node major you run with.
- **Do not rebuild node_modules across Node majors casually** — `npm install` under a different Node ABI makes the installed binaries unusable until setup runs again.
- `npm install` may bump in-range versions in package-lock.json; keep lockfile churn minimal and avoid committing unrelated dependency bumps.
- Web UI changes require `npm run build:web` (or `cd web && npm run dev`) to take effect; the backend serves `web/dist`.
- First-run setup generates `data/config.json` (the old root-level `config.json` is migrated automatically).
