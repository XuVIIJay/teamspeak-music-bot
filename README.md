# TSMusicBot 国内用户安装教程（功能介绍请往下浏览）

## 第一步：下载项目

```
git clone https://gitee.com/XuVIIJay/teamspeak-music-bot（或git clone https://github.com/XuVIIJay/teamspeak-music-bot)
```

或直接下载 ZIP 压缩包（https://gitee.com/XuVIIJay/teamspeak-music-bot → 克隆/下载 → 下载 ZIP），解压。

## 第二步：进入项目目录

```
cd teamspeak-music-bot
```

后续所有命令都要在这个目录下执行。

---

## Windows 用户

### 1. 安装 Node.js

从 https://nodejs.cn 下载 Node.js 22 LTS 版本并安装(24或其他版本可能不适配安装脚本，可选择降级或手动安装)。

### 2. 安装

确保在 `teamspeak-music-bot` 目录下，双击 `scripts\setup.bat`，或在地址栏输入 cmd 回车后运行：

```
scripts\setup.bat
```

一直等到出现 "Setup Complete!"。

### 3. 启动

双击 `scripts\start.bat`，或在 cmd 中运行：

```
scripts\start.bat
```

### 4. 打开管理页面

浏览器访问 `http://localhost:3000`

---

## Linux / macOS 用户

### 1. 安装 Node.js

从 https://nodejs.cn 下载，或用包管理器安装 Node.js 20+。


### 2. 安装

确保在 `teamspeak-music-bot` 目录下，运行：

```
chmod +x scripts/setup.sh
./scripts/setup.sh
```

一直等到出现（5步安装全部执行结束）

```
============================================
  Setup Complete!
============================================
```

### 3. 启动

```
npm start
```

### 4. 打开管理页面

浏览器访问 `http://localhost:3000`

---

## 安装后

- 首次打开 WebUI（`http://localhost:3000`）会引导你配置 TeamSpeak 服务器和 bot 名称
- 如需播放网易云歌曲，在 WebUI 中扫码登录
- 在 TeamSpeak 语音频道输入 `ai 播放歌曲名` 即可播歌

---

# 作者自用版新添功能介绍

此fork项目基于https://github.com/ZHANGTIANYAO1/teamspeak-music-bot开发
  
## 一、AI 对话功能

  通过 `!ai <内容>` 命令与 DeepSeek Chat 对话，AI 能识别播放指令并自动控制机器人。

  ### 配置

  1. 打开 WebUI → **设置 → AI 设置**
  2. 输入 DeepSeek API Key 并保存
  3. 没有 Key 前往 [platform.deepseek.com](https://platform.deepseek.com) 获取

  ### 功能说明

  **1. 智能播放控制**

  AI 能理解自然语言点歌需求并自动选择正确的命令：

  | 你说 | AI 自动执行 | 效果 |
  |------|-------------|------|
  | `!ai 放一首周杰伦的晴天` | `!play -q 晴天` | QQ音乐播放单曲 |
  | `!ai 播放周杰伦的歌` | `!artist -q 周杰伦` | 循环播放多首 |
  | `!ai 暂停` | `!pause` | 暂停 |
  | `!ai 声音大点` | `!vol 70` | 调音量 |

  AI 会自动识别版权情况：周杰伦、王力宏、S.H.E 的歌自动使用 QQ 音乐（`-q`），无需手动指定。

  **2. AI 记忆**

  AI 会记住你告诉它的偏好和要求，下次对话自动应用：

  | 你说 | AI 记住 |
  |------|---------|
  | `!ai 我喜欢听周杰伦` | 以后播放周杰伦自动用 QQ 音乐 |
  | `!ai 以后称我大人` | 以后默认称呼用户为“大人” |
  | `!ai 以后音量默认 50` | 以后调音量默认 50 |
  | `!ai 清空记忆` | 清除所有记忆（需二次确认） |

  也可以在 **设置 → AI 设置 → 清空记忆** 中一键清除。

  **3. 音源提示**

  默认使用网易云音乐播放，当播放具体歌曲时会提示"目前是网易云音源，如果不是您想要的歌曲，告诉我要不要帮您切换到QQ音乐音源"。

  ## 二、加入欢迎功能

  用户进入机器人所在频道时自动发送频道欢迎，进入服务器默认频道时发送全局服务器欢迎。可在网页设置中独立开关。

  ### 配置方法

  1. **设置页开启**：WebUI → 设置 → 机器人 Profile → **加入欢迎**，打开 toggle 开关
  2. **重启机器人** 使配置生效
  3. **给机器人 ServerAdmin 权限**（重要）：在 TeamSpeak 客户端中右键机器人 → `编辑权限` → 搜索 `b_client_is_sticky`，勾选并设为 `True`（或直接右键机器人 → `ServerGroup` → 加入 `Server Admin` ServerGroup），否则机器人无法收到客户进出频道的事件

  ### 功能说明

  - **频道欢迎**：用户进入机器人所在频道时发送欢迎消息
  - **服务器欢迎**：用户进入服务器默认频道时发送全局服务器欢迎
  - **防打扰**：机器人自己切换频道后 3 秒内不发送欢迎
  - **开关独立**：每个机器人可独立开启/关闭，默认开启

  ## 三、播放错误信息输出

  ### 1.播放错误诊断

  播放失败时自动检测平台登录状态和 VIP 状态，给出具体原因和解决提示，而非简单显示"Cannot play"。

  - `!play`、`!artist`、`!playlist`、`!album`、`!fm` 全部播放路径
  - 检测网易云和 QQ 音乐的登录状态
  - 检测网易云黑胶 VIP / 音乐包状态

  **提示示例**
  - 网易云未登录 → `请在WebUI设置页扫码登录网易云`
  - 网易云已登录但无VIP → `请检查是否开通黑胶VIP`
  - QQ音乐未登录 → `请在WebUI设置页扫码登录QQ音乐`

  ---

  ### 2.VIP 歌曲试听检测

  播放网易云 VIP 歌曲（fee=1）时，自动检查登录和 VIP 状态：

  | 状态 | 提示 |
  |------|------|
  | 未登录 | `⚠️ 试听中，完整版请在WebUI登录网易云` |
  | 已登录但无VIP | `⚠️ 试听中，完整版请开通黑胶VIP` |
  | 已登录且有VIP | 不提示 |

  > 注意：仅对 fee=1（VIP 歌曲）提示。fee=8（付费单曲）通常可完整播放，不提示。

  ## 四、将!help内容改为中文

  ### 音乐机器人控制命令
- `!play <song>` — 搜索歌曲并播放（网易云）
- `!play -q <song>` — 搜索歌曲并播放（QQ音乐）
- `!play -b <song>` — 搜索并播放（bilibili）
- `!play -y <song>` — 搜索并播放（YouTube）
- `!add <song>` — 添加歌曲到队尾
- `!playnext <song>` — 插队下一首播放
- `!pn <song>` — 插队下一首播放（简化命令）
- `!pause` / `!resume` — 暂停/恢复播放
- `!next` / `!prev` — 下一曲/上一曲
- `!stop` — 暂停播放并清空播放队列
- `!vol <0-100>` — 设置音量
- `!queue` — 查看播放队列
- `!mode <seq|loop|random|rloop>` — 播放模式（顺序|循环|随机|随机循环）
- `!playlist <name or id>` — 通过名称或者歌单id加载歌单（网易云）
- `!playlist -q <name or id>` — 通过名称或者歌单id加载歌单（QQ音乐）
- `!album <id>` — 加载专辑
- `!fm` — 个人电台（网易云）
- `!artist <name>` — 循环播放歌手的歌曲（网易云）
- `!artist -q <name>` — 循环播放歌手的歌曲（QQ音乐）
- `!vote` — 投票跳过当前歌曲
- `!lyrics` — 显示歌词
- `!now` — 显示当前歌曲信息
- `!ai <内容>` — 与AI对话
- `!help` — 帮助信息

## 五、网易云添加歌手歌曲上限优化

网易云官方api一次性搜索获得歌曲最多可以有100首，qq音乐最多只能有50首

原本作者给二者都限制在50首，这里把网易云上限添加到了100首

## 六、新添适配国内环境的安装脚本
