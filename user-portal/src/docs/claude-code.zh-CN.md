# Claude Code 配置

> 全程约 **5 分钟**，三步完成：安装 → 创建 API Key → 开始使用。

## 第 1 步 · 安装 Claude Code

按你的系统，复制对应的**一行命令**，粘贴到终端回车：

- **Windows**（打开「PowerShell」）：
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- **macOS**（打开「终端」）：
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

装完后**关掉终端、重新打开一次**。输入 `claude --version`，看到版本号即安装成功。

## 第 2 步 · 创建 API Key

1. 打开 [创建 API Key]({{APIKEY_CREATE_URL}}) 页面，分组选择 **Claude（Claude Code / Desktop）**，点击创建。
2. 在刚创建的 Key 条目里点击「**使用**」按钮：

   ![如何使用 API Key]({{USE_API_KEY_IMG}})

3. 按照弹窗指引，把命令复制到终端中执行。

## 第 3 步 · 开始使用

1. 紧接着上一步，在终端中进入你的项目文件夹：`cd 你的项目路径`
2. 输入 `claude` 回车；第一次会问是否信任此文件夹、选主题等，按提示选即可。
3. 直接**打出你的需求**，例如：「帮我把这个项目的 README 翻译成英文」。

看到它开始读文件、回应你 —— 就成功了 🎉

---

还搞不定？[联系我们]({{CONTACT_URL}})，通常 **15 分钟内**回复。
