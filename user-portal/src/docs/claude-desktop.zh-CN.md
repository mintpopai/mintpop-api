# Claude Desktop 配置

> 全程约 **5 分钟**，四步完成：安装 → 创建 API Key → 配置 → 开始使用。

## 第 1 步 · 安装 Claude Desktop

到 [claude.com/download](https://claude.com/download) 下载对应系统的安装包，双击完成安装。

## 第 2 步 · 创建 API Key

1. 打开 [创建 API Key]({{APIKEY_CREATE_URL}}) 页面，分组选择 **Claude（Claude Code / Desktop）**，点击创建。
2. 复制生成的 **API Key**，下一步配置时要用。

## 第 3 步 · 配置 Claude Desktop

先开启开发者模式：

- **macOS**：顶部菜单 `Help → Troubleshooting → Enable Developer mode`
- **Windows**：点击左上角 ☰（三条横线）菜单，按同样路径开启

然后打开顶部菜单 `Developer → Configure third-party inference`，在弹出的窗口中依次填写：

| 配置项 | 填写内容 |
| --- | --- |
| **Connection** | 选 `Gateway`（默认项） |
| **Gateway base URL** | `{{BASE_URL}}` |
| **Gateway API key** | 上一步复制的 API Key |

填完后点击 **Test connection**，图标变绿即连接成功；最后点击右下角 **Apply Changes** 保存。

## 第 4 步 · 开始使用

回到 Claude Desktop 主界面，选择想用的模型，直接提问。看到它回应你 —— 就成功了 🎉

---

还搞不定？[联系我们]({{CONTACT_URL}})，通常 **15 分钟内**回复。
