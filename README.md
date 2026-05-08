  ## 1.新添ai对话控制功能

  1. 从 [platform.deepseek.com](https://platform.deepseek.com) 注册获取 API Key
  2. 在项目根目录创建 `.env` 文件：
     DEEPSEEK_API_KEY=sk-your-key-here
  3. 重启机器人

  ### 使用示例

  | 命令 | 效果 |
  |------|------|
  | `!ai 你好` | AI 回复问候语 |
  | `!ai 播放周杰伦的歌` | AI 解析指令 → 自动执行 `!play -q 周杰伦` |
  | `!ai 下一首` | AI 解析指令 → 执行 `!next` |
  | `!ai 怎么播放歌曲` | AI 文字回答使用方法（不执行命令） |


## 2.加入欢迎功能

  用户进入机器人所在频道或服务器默认频道时，自动发送欢迎消息。支持 per-bot 独立开关。

  ### 实现原理

  - **事件驱动**：通过底层库的 `clientEnter`（用户进入视野）和
  `clientMoved`（用户切换频道）两个事件触发，覆盖所有入场场景
  - **频道欢迎**：`sendTextMessage(msg, 2)` 发送到当前频道，消息格式 `欢迎{昵称}加入{频道名}，!help
  获取播放指令，玩的开心哦`
  - **服务器欢迎**：`sendTextMessage(msg, 3)` 服务器全局广播，消息格式 `欢迎{昵称}加入{服务器名}！使用 !ai
  与我对话聊天哦`
  - **去重抑制**：机器人自己切换频道后 3 秒内不发送欢迎（`suppressWelcomeUntil`），避免自旋
  - **开关持久化**：`welcomeEnabled` 存储在 SQLite `bot_instances.profile_welcome_enabled` 列，默认开启，可在 设置 →
  机器人 Profile → 加入欢迎 中独立开关

  ### 涉及文件

  | 文件 | 说明 |
  |------|------|
  | `src/ts-protocol/client.ts` | 5 个辅助方法（`getDefaultChannelId`、`getMyChannelId` 等）+ 3 个事件发射 |
  | `src/bot/instance.ts` | 4个处理方法（`_handleClientEnter`、`_handleClientMoved`、`_sendChannelWelcome`、`_sendServerWelcome`） |
  | `src/data/database.ts` | ProfileConfig 扩展 `welcomeEnabled` + DB 迁移 |
  | `web/src/views/Settings.vue` | 网页开关 |
