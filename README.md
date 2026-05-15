## 六、新添适配国内环境的安装脚本

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

从 https://nodejs.cn 下载 Node.js 20 LTS 版本并安装。

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
