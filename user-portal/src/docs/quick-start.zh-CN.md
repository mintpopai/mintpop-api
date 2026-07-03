# 接入指南 · 用 Claude Code 或 Claude Desktop(约 5 分钟)

> 两种方式,**二选一**即可:
> - **方式 A · Claude Code(命令行)** —— 适合写代码、习惯用终端的人。
> - **方式 B · Claude Desktop(桌面 App)** —— 想要图形界面、全程不碰终端的人。
>
> 不管走哪种,先完成下面第 0 步拿到凭据。

<!-- 视频教程改为按方式 A / B 分别内嵌在各自章节开头 -->

---

## 第 0 步 · 注册,拿到你的 Key 和接入地址

1. 打开注册页 **{{注册链接}}**,注册并登录。
2. 进入「API Key」页面 → 点「创建 Key」→ **复制保存好**(只显示一次)。
3. 记下你的接入地址:**`{{BASE_URL}}`**

<!-- 截图位:Key 创建页面 -->

---

# 方式 A · Claude Code(命令行)

> 📺 看视频更直观:[Claude Code 安装配置视频教程](https://www.bilibili.com/video/BV1KjoxBoEQJ/)

## A1 · 安装

按你的系统,复制对应**一行命令**,粘到终端回车:

- **Windows**(打开「PowerShell」):
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- **macOS**(打开「终端」):
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

装完后**关掉终端、重新打开一次**。输入 `claude --version`,看到版本号即成功。

<!-- 截图位:claude --version 显示版本号 -->

## A2 · 配置(填地址 + Key)

在终端运行下面命令(**替换成你自己的 Key**),让 Claude Code 走我们的中转:

- **macOS:**
  ```bash
  export ANTHROPIC_BASE_URL="{{BASE_URL}}"
  export ANTHROPIC_AUTH_TOKEN="把你的-API-Key-粘到这里"
  export ANTHROPIC_MODEL="claude-sonnet-4-6"
  ```
- **Windows(PowerShell):**
  ```powershell
  $env:ANTHROPIC_BASE_URL="{{BASE_URL}}"
  $env:ANTHROPIC_AUTH_TOKEN="把你的-API-Key-粘到这里"
  $env:ANTHROPIC_MODEL="claude-sonnet-4-6"
  ```

> ⚠️ 是 `ANTHROPIC_AUTH_TOKEN`,**不是** `ANTHROPIC_API_KEY`——填错会认证失败。
>
> 上面这样设**只对当前终端有效**,关掉就没了。想**设一次永久生效**:
> - **macOS**:把那三行 `export` 追加到 `~/.zshrc` 末尾,保存后运行 `source ~/.zshrc`。
> - **Windows**:把每条 `$env:` 改成 `setx`,例如 `setx ANTHROPIC_BASE_URL "{{BASE_URL}}"`(三个变量各一条),然后重开 PowerShell。

## A3 · 跑起来

1. 用终端进入你的项目文件夹:`cd 你的项目路径`
2. 输入 `claude` 回车;第一次会问是否信任此文件夹、选主题等,按提示选即可。
3. 直接**用中文打出你的需求**,例如:「帮我把这个项目的 README 翻译成英文」。

看到它开始读文件、回应你 —— 就成功了 🎉

<!-- 截图/GIF 位:第一次对话 -->

---

# 方式 B · Claude Desktop(桌面 App,全程零终端)

> 📺 看视频更直观:[Claude Desktop 接入视频教程](https://www.bilibili.com/video/BV1YNR4BKE17/)

## B1 · 下载安装

到 **https://claude.com/download** 下载 Claude Desktop,双击安装。

> Windows 首次运行可能要求开启「虚拟机平台(Virtual Machine Platform)」并重启一次,按提示操作即可。
> 若所在网络打不开下载页,请用你平时访问 Claude 的方式再试。

<!-- 截图位:下载页面 -->

## B2 · 开启开发者模式

打开 App,**先不要登录**(停在登录页即可,不要点继续):

- **macOS**:顶部菜单 `Help → Troubleshooting → Enable Developer mode`
- **Windows**:点左上角三条横线,按同样路径开启开发者模式

## B3 · 配置第三方接入

顶部菜单 `Developer → Configure third-party inference`,在弹出的界面填写:

- **Connection**:选 `Gateway`(默认项)
- **Gateway base URL**:`{{BASE_URL}}`
- **Gateway API key**:你的 API Key
- **模型**:填 `claude-sonnet-4-6`(及你想用的其他 claude 模型),填进去的模型会出现在模型菜单里
- 其余保持默认

<!-- 截图位:第三方推理配置界面 + 模型设置 -->

## B4 · 应用并使用

保存后**完全退出 Claude Desktop 再重新打开**(macOS 用 `Cmd + Q` 或菜单「Quit」,不要只关窗口)。重启后在模型菜单里选到你填的模型,正常发消息即可。

> 想切回官方账号?在 App 里 **Sign out** 即可。

<!-- 截图位:运行实例 -->

---

## 遇到问题?

- **`claude: command not found`(方式 A)** —— 没装好或终端没重开。先重开终端;还不行重跑 A1。
- **提示 401 / 认证失败** —— Key 复制错了或带了多余空格。重新粘贴,注意方式 A 用的是 `ANTHROPIC_AUTH_TOKEN`。
- **Claude Desktop 配完没反应(方式 B)** —— 检查 Base URL **末尾没有多余斜杠**、Key 完整无空格,然后**完全退出再重开**。
- **怎么确认成功** —— 随便发一句,有正常回复就生效了。

还搞不定?联系我们,通常 **15 分钟内**回复:

- 邮箱:**support@mintpop.ai**
<!-- Telegram 联系方式尚无数据来源,拿到具体账号后恢复这一行:
- Telegram:**@xxx**
-->

