# Auto-pause on empty channel — design

**Issue:** [#79](https://github.com/ZHANGTIANYAO1/teamspeak-music-bot/issues/79) item 3
**Date:** 2026-05-30
**Status:** Approved (brainstorm), pending implementation plan

## Problem

When everyone leaves the bot's voice channel, music keeps playing to an empty room.
The maintainer wants an option to **auto-pause when the channel is empty** (no disconnect)
and resume when someone returns.

## Decisions (from brainstorm)

- **Global toggle**, reusing the **already-declared but currently dead** `config.autoPauseOnEmpty`
  (`src/data/config.ts`, default `true`). No per-bot granularity (YAGNI).
- **Event-driven, near-instant** reaction (not the 30s poll alone) — subscribe to TS client
  enter/leave/move events; keep the existing 30s idle poll as a fallback.
- **Auto-resume only what we auto-paused** — a user-paused track is never auto-resumed.
- Independent of the existing **idle-disconnect** (`idleTimeoutMinutes`): both share the same
  emptiness signal but act independently (pause immediately; disconnect after N minutes).

## Current state (verified)

- `client.ts` `getClientsInChannel()` returns all clients in the bot's channel *including the
  bot*; callers compute "others" as `length - 1`. No persistent roster.
- The library emits `clientEnter` / `clientLeave` / `clientMoved`; `client.ts` currently only
  *logs* `clientEnter` and does not re-emit leave/moved.
- The idle poller in `instance.ts` (`_startIdlePoller`, every 30s) already computes
  `userCount = getClientsInChannel().length - 1` and, when `<= 0`, schedules an
  idle-disconnect after `idleTimeoutMinutes`.
- `player.pause()` / `player.resume()` already pause/resume **without disconnecting** (ffmpeg
  stays alive, no voice sent). The player only knows `idle|playing|paused` — there is **no**
  auto-vs-user-pause distinction today.
- `BotConfig.autoPauseOnEmpty` exists (default true) but is **read nowhere**.

## Design

### Occupancy signal (shared)
Extract the idle poller's count into one method on `BotInstance`:
`checkChannelOccupancy()` → queries `getClientsInChannel()`, computes `userCount = length - 1`,
and drives **both** the existing idle-disconnect timer (unchanged behavior) **and** the new
auto-pause logic below. It is called by:
1. the existing 30s poll (fallback), and
2. new TS event handlers.

### Event subscription
`client.ts`: subscribe to and **re-emit** `clientEnter`, `clientLeave`, `clientMoved` up to
`BotInstance`. `BotInstance.setupTsEvents()` calls `checkChannelOccupancy()` on each (a re-query
is simplest, since `clientLeave` carries no channel id). This gives near-instant pause/resume;
the poll remains as a safety net.

### Auto-pause logic (inside `checkChannelOccupancy`)
Add a private `autoPaused = false` flag to `BotInstance`.
- **Empty** (`userCount <= 0`): if `config.autoPauseOnEmpty` **and** `player.getState() === "playing"`
  → `player.pause()`, `autoPaused = true`, emit `stateChange`. (Idle-disconnect timer still
  scheduled as today.)
- **Re-populated** (`userCount > 0`): if `autoPaused` **and** `player.getState() === "paused"`
  → `player.resume()`, `autoPaused = false`, emit `stateChange`. (Idle timer cancelled as today.)

### `autoPaused` bookkeeping (so user pauses are respected)
Clear `autoPaused = false` in `cmdPause`, `cmdResume`, `cmdStop`, `cmdPlay`, and on
connect/disconnect (the `disconnected` handler calls `player.stop()` → idle). Net effect: only a
track *we* auto-paused gets auto-resumed; a user-paused track stays paused when someone returns.

### Config wiring
- `GET /api/bot/settings`: include `autoPauseOnEmpty` in the payload (alongside `idleTimeoutMinutes`).
- `POST /api/bot/settings`: accept + validate a boolean `autoPauseOnEmpty`, `saveConfig`, and
  propagate to live bots via a new `BotInstance.updateAutoPause(enabled)` (mirrors
  `updateIdleTimeout`). Since the instance reads `this.config.autoPauseOnEmpty` live, propagation
  can be as simple as updating the stored config reference / a field the check reads.
- Frontend `Settings.vue` → the **行为设置** section (already `bot.manage`-gated): add a toggle
  for `autoPauseOnEmpty` next to the idle-timeout control; load it in the settings fetch and send
  it on save.

## Components / files

- `src/ts-protocol/client.ts` — subscribe + re-emit `clientEnter`/`clientLeave`/`clientMoved`.
- `src/bot/instance.ts` — `autoPaused` field; `checkChannelOccupancy()` (refactored from the
  idle poller, drives idle + auto-pause); event handlers; clear `autoPaused` in user commands +
  connect/disconnect; `updateAutoPause(enabled)`.
- `src/web/api/bot.ts` — `GET`/`POST /settings` handle `autoPauseOnEmpty`.
- `web/src/views/Settings.vue` (+ player store settings load/save) — the toggle.
- `src/data/config.ts` — field already exists (no change beyond confirming default).

## Testing

- **Decision unit test (TDD):** extract the pause/resume decision into a testable method, e.g.
  `applyOccupancy(userCount)` operating on an injected fake player (`getState`/`pause`/`resume`)
  + the `autoPaused` flag + the config flag. Cases: empty+playing+enabled → pause + `autoPaused`;
  re-populated+`autoPaused`+paused → resume + clear; re-populated when NOT `autoPaused` (user
  pause) → no resume; flag disabled → no pause; empty while idle (not playing) → no-op.
- **API test:** `GET`/`POST /api/bot/settings` round-trips `autoPauseOnEmpty` (validates boolean,
  persists, propagates).
- Live TS event wiring is verified by code review + a manual run (can't unit-test a real server).

## Non-goals

- No per-bot toggle (global only). No change to idle-disconnect behavior. No new dependency.
- Reaction relies on events the bot can already see (same-channel members are always in view);
  no extra channel subscription needed.

---

## Update (2026-06): occupancy is event-driven & server-wide, not channel-filtered

Live testing against a real TS3 server (with `@honeybbq/teamspeak-client` 0.2.2)
invalidated two assumptions above. Recording the corrected model here so nobody
reintroduces the old design:

- **Default is OFF**, not on. See `getDefaultConfig()` in `src/data/config.ts`
  and the rationale comment there.
- **Query commands are unusable when others are present.** `clientlist`,
  `channellist`, and `channelclientlist` ALL time out (~5–10s) whenever ≥2
  clients are connected to the **server** (verified even when the two clients
  are in *different* channels). They succeed only when the bot is the sole
  client on the whole server. So `getClientsInChannel()` returns `[]` exactly
  when occupancy matters, and `occupancyFromClientList(0)` returns `null`
  ("unknown") so callers skip the decision rather than mis-reading it as empty.
- **PAUSE** therefore only ever fires when the bot becomes alone on the server
  (the one state where the query works). This is reliable and stays on the
  query path (`refreshOccupancy()` + the 30s idle poller).
- **RESUME** is armed directly from the `clientEnter` push event
  (`shouldResumeOnReturn()` + `_resumeIfReturning()` in `instance.ts`), NOT from
  a query. Because the bot only auto-pauses while alone, the sole way occupancy
  can return while `autoPaused` is set is a fresh connection — delivered as
  `clientEnter`. The resume branch never pauses (userCount is always > 0).
- **Net semantics:** "pause when the server is empty (bot alone), resume when
  someone connects." Channel granularity is **impossible** with this library:
  `clientEnter`'s channel field is always `0` (library reads notify param `cid`
  but enter-view carries `ctid`), and `clientMoved` delivery is flaky. Do NOT
  attempt to layer `clientMoved.targetChannelID` channel-accuracy on top — it is
  systematically wrong for direct-connect clients and reintroduces unreliability.
  The correct path to true channel scoping is an upstream library fix.
- **Knock-on:** idle-disconnect shares the same signal and is likewise
  server-wide. UI copy in `web/src/views/Settings.vue` was updated to say
  "服务器" rather than "频道" to match. `cmdVote` was intentionally left on the
  query path (out of scope; switching it would inherit the same timeout).
