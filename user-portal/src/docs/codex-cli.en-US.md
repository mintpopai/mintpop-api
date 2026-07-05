# Codex CLI Setup

> Takes about **5 minutes**, four steps: install → create an API Key → write the config → start using.

## Step 1 · Install Codex CLI

Copy the **one-line command** for your OS and paste it into a terminal:

- **Windows** (open PowerShell):
  ```powershell
  $env:CODEX_NON_INTERACTIVE=1; irm https://chatgpt.com/codex/install.ps1 | iex
  ```
- **macOS** (open Terminal):
  ```bash
  curl -fsSL https://chatgpt.com/codex/install.sh | sh
  ```

After installing, **close the terminal and open a new one**. Run `codex --version` — if you see a version number, the install succeeded.

## Step 2 · Create an API Key

1. Open the [Create API Key]({{APIKEY_CREATE_URL}}) page, pick the **ChatGpt** group, and click Create.
2. Click the **Use** button on the newly created key:

   ![How to use the API Key]({{USE_CODEX_CLI_API_KEY_IMG}})

3. The dialog shows **two blocks of config text** — you'll need them in the next step, so keep it open.

## Step 3 · Write the config files

First, open Codex's config folder `.codex` (inside your home folder):

- **Windows**: press `Win + R`, type `%USERPROFILE%\.codex` and press Enter.
- **macOS / Linux**: it's at `~/.codex` (`~` is your home folder; on macOS press `Command + Shift + .` in Finder to show hidden files).

Then save the two blocks from the dialog as two files (**replace the whole content if the file already exists, or create it if not**):

1. The **first block** → save as `config.toml`
2. The **second block** → save as `auth.json`

## Step 4 · Start using it

1. Open a new terminal and go to your project folder: `cd path/to/your/project`
2. Type `codex` and press Enter; on first run it asks whether to trust the folder, pick a theme, etc. — just follow the prompts.
3. Type **what you need** in plain language, e.g. "Translate this project's README into French".

Once it starts reading files and responding — you're all set 🎉

---

Still stuck? [Contact us]({{CONTACT_URL}}) — we usually reply **within 15 minutes**.
