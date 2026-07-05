# Codex CLI 配置

> 全程约 **5 分钟**，四步完成：安装 → 创建 API Key → 写入配置 → 开始使用。

## 第 1 步 · 安装 Codex CLI

按你的系统，复制对应的**一行命令**，粘贴到终端回车：

- **Windows**（打开「PowerShell」）：
  ```powershell
  $env:CODEX_NON_INTERACTIVE=1; irm https://chatgpt.com/codex/install.ps1 | iex
  ```
- **macOS**（打开「终端」）：
  ```bash
  curl -fsSL https://chatgpt.com/codex/install.sh | sh
  ```

装完后**关掉终端、重新打开一次**。输入 `codex --version`，看到版本号即安装成功。

## 第 2 步 · 创建 API Key

1. 打开 [创建 API Key]({{APIKEY_CREATE_URL}}) 页面，分组选择 **ChatGpt**，点击创建。
2. 在刚创建的 Key 条目里点击「**使用**」按钮：

   ![如何使用 API Key]({{USE_CODEX_CLI_API_KEY_IMG}})

3. 弹窗里会给出**两段配置文本**，下一步要用，先别关掉。

## 第 3 步 · 写入配置文件

先打开 Codex 的配置文件夹 `.codex`（在你的用户文件夹下）：

- **Windows**：按 `Win + R`，输入 `%USERPROFILE%\.codex` 回车。
- **macOS / Linux**：位于 `~/.codex`（`~` 就是你的用户文件夹；macOS 可在访达中按 `Command + Shift + .` 显示隐藏文件）。

然后把上一步弹窗里的两段文本分别存成两个文件（**已有同名文件就整体替换内容，没有就新建**）：

1. 弹窗**第一段**文本 → 保存为 `config.toml`
2. 弹窗**第二段**文本 → 保存为 `auth.json`

## 第 4 步 · 开始使用

1. 打开新的终端，进入你的项目文件夹：`cd 你的项目路径`
2. 输入 `codex` 回车；第一次会问是否信任此文件夹、选主题等，按提示选即可。
3. 直接**打出你的需求**，例如：「帮我把这个项目的 README 翻译成英文」。

看到它开始读文件、回应你 —— 就成功了 🎉

---

还搞不定？[联系我们]({{CONTACT_URL}})，通常 **15 分钟内**回复。
