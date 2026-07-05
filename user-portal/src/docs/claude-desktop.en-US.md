# Claude Desktop Setup

> Takes about **5 minutes**, four steps: install → create an API Key → configure → start using.

## Step 1 · Install Claude Desktop

Go to [claude.com/download](https://claude.com/download), download the installer for your OS, and double-click to install.

## Step 2 · Create an API Key

1. Open the [Create API Key]({{APIKEY_CREATE_URL}}) page, pick the **Claude (Claude Code / Desktop)** group, and click Create.
2. Copy the generated **API Key** — you'll need it in the next step.

## Step 3 · Configure Claude Desktop

First, enable Developer mode:

- **macOS**: top menu `Help → Troubleshooting → Enable Developer mode`
- **Windows**: click the ☰ (hamburger) menu in the top-left corner, then follow the same path

Then open the top menu `Developer → Configure third-party inference` and fill in the dialog:

| Field | What to enter |
| --- | --- |
| **Connection** | Select `Gateway` (the default) |
| **Gateway base URL** | `{{BASE_URL}}` |
| **Gateway API key** | The API Key you copied in the previous step |

When done, click **Test connection** — a green icon means it's connected. Finally, click **Apply Changes** in the bottom-right corner to save.

## Step 4 · Start using it

Back in the Claude Desktop main window, pick the model you want and ask away. Once it responds — you're all set 🎉

---

Still stuck? [Contact us]({{CONTACT_URL}}) — we usually reply **within 15 minutes**.
