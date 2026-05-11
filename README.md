## 播放优化：双向随机播放追溯

  ### 问题

  Random/RandomLoop 模式下，`!prev` 可以正确回退到上一首，但 `!prev` 后再
  `!next`，回到的是随机歌曲而不是之前的位置。连续多步 prev → next 无法恢复原播放次序。

  ### 优化内容

  新增 `forwardStack`（前进栈），与原有的 `history`（历史栈）对称工作：

  - **`!next`**：优先从 `forwardStack` 弹出，回到 `!prev` 退回前的位置
  - **`!prev`**：把当前位置压入 `forwardStack`，再从 `history` 弹出回到上一首

  效果：`!next × N → !prev × N → !next × N` 可以完全恢复原播放次序，N 最大 50 首。Random 和 RandomLoop
  两种随机模式均支持。

  ### 涉及文件

  `src/audio/queue.ts` — 约 20 行新增，无其他文件改动。
