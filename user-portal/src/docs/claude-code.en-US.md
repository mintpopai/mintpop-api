# Claude Code Setup

> Takes about **5 minutes**, three steps: install → create an API Key → start using.

## Step 1 · Install Claude Code

Copy the **one-line command** for your OS and paste it into a terminal:

- **Windows** (open PowerShell):
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- **macOS** (open Terminal):
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

After installing, **close the terminal and open a new one**. Run `claude --version` — if you see a version number, the install succeeded.

## Step 2 · Create an API Key

1. Open the [Create API Key]({{APIKEY_CREATE_URL}}) page, pick the **Claude (Claude Code / Desktop)** group, and click Create.
2. Click the **Use** button on the newly created key:

   ![How to use the API Key]({{USE_CLAUDE_CODE_API_KEY_IMG}})

3. Follow the instructions and paste the commands into your terminal.

## Step 3 · Start using it

1. Right after the previous step, go to your project folder in the same terminal: `cd path/to/your/project`
2. Type `claude` and press Enter; on first run it asks whether to trust the folder, pick a theme, etc. — just follow the prompts.
3. Type **what you need** in plain language, e.g. "Translate this project's README into French".

Once it starts reading files and responding — you're all set 🎉

---

Still stuck? [Contact us]({{CONTACT_URL}}) — we usually reply **within 15 minutes**.
