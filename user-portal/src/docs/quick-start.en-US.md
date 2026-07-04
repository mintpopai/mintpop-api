# Getting Started · Claude Code or Claude Desktop (about 5 minutes)

> Two options — **pick either one**:
> - **Option A · Claude Code (command line)** — for people who write code and live in the terminal.
> - **Option B · Claude Desktop (desktop app)** — for people who want a GUI and never touch a terminal.
>
> Whichever you choose, complete Step 0 first to get your credentials.

---

## Step 0 · Sign up and get your Key and gateway URL

1. Open the sign-up page **{{SIGNUP_URL}}**, register and log in.
2. Go to the **API Keys** page → click **Create Key** → **copy and save it** (it is shown only once).
3. Note down your gateway URL: **`{{BASE_URL}}`**

---

# Option A · Claude Code (command line)

> 📺 Prefer video? [Claude Code setup video tutorial](https://www.bilibili.com/video/BV1KjoxBoEQJ/) (in Chinese)

## A1 · Install

Copy the **one-line command** for your OS and paste it into a terminal:

- **Windows** (open PowerShell):
  ```powershell
  irm https://claude.ai/install.ps1 | iex
  ```
- **macOS** (open Terminal):
  ```bash
  curl -fsSL https://claude.ai/install.sh | bash
  ```

After installing, **close the terminal and open a new one**. Run `claude --version` — if you see a version number, you're good.

## A2 · Configure (gateway URL + Key)

Run the commands below in your terminal (**replace with your own Key**) so Claude Code goes through our gateway:

- **macOS:**
  ```bash
  export ANTHROPIC_BASE_URL="{{BASE_URL}}"
  export ANTHROPIC_AUTH_TOKEN="paste-your-API-Key-here"
  export ANTHROPIC_MODEL="claude-sonnet-4-6"
  ```
- **Windows (PowerShell):**
  ```powershell
  $env:ANTHROPIC_BASE_URL="{{BASE_URL}}"
  $env:ANTHROPIC_AUTH_TOKEN="paste-your-API-Key-here"
  $env:ANTHROPIC_MODEL="claude-sonnet-4-6"
  ```

> ⚠️ It's `ANTHROPIC_AUTH_TOKEN`, **not** `ANTHROPIC_API_KEY` — the wrong name will fail authentication.
>
> Set this way, the variables **only last for the current terminal session**. To make them permanent:
> - **macOS**: append those three `export` lines to the end of `~/.zshrc`, save, then run `source ~/.zshrc`.
> - **Windows**: replace each `$env:` line with `setx`, e.g. `setx ANTHROPIC_BASE_URL "{{BASE_URL}}"` (one per variable), then open a new PowerShell.

## A3 · Run it

1. `cd` into your project folder in the terminal.
2. Type `claude` and press Enter; on first run it asks whether to trust the folder, pick a theme, etc. — just follow the prompts.
3. Type what you need in plain language, e.g. "Translate this project's README into French".

Once it starts reading files and responding — you're all set 🎉

---

# Option B · Claude Desktop (desktop app, zero terminal)

> 📺 Prefer video? [Claude Desktop setup video tutorial](https://www.bilibili.com/video/BV1YNR4BKE17/) (in Chinese)

## B1 · Download and install

Download Claude Desktop from **https://claude.com/download** and install it.

> On Windows, the first run may ask you to enable "Virtual Machine Platform" and reboot once — just follow the prompt.
> If the download page won't open on your network, try the way you normally access Claude.

## B2 · Enable Developer mode

Open the app and **do not log in** (stay on the login screen):

- **macOS**: top menu `Help → Troubleshooting → Enable Developer mode`
- **Windows**: click the hamburger menu (top-left) and follow the same path

## B3 · Configure third-party inference

Top menu `Developer → Configure third-party inference`, then fill in:

- **Connection**: choose `Gateway` (the default)
- **Gateway base URL**: `{{BASE_URL}}`
- **Gateway API key**: your API Key
- **Models**: enter `claude-sonnet-4-6` (plus any other claude models you want) — they will appear in the model menu
- Leave everything else at defaults

## B4 · Apply and use

After saving, **fully quit Claude Desktop and reopen it** (on macOS use `Cmd + Q` or the Quit menu — don't just close the window). After the restart, pick your model in the model menu and chat as usual.

> Want to switch back to your official account? Just **Sign out** in the app.

---

## Troubleshooting

- **`claude: command not found` (Option A)** — the install didn't finish or the terminal wasn't reopened. Open a new terminal first; if it persists, rerun A1.
- **401 / authentication failed** — the Key was copied wrong or has extra spaces. Paste it again, and remember Option A uses `ANTHROPIC_AUTH_TOKEN`.
- **Claude Desktop does nothing after configuring (Option B)** — check the Base URL has **no trailing slash**, the Key has no spaces, then **fully quit and reopen**.
- **How do I know it works?** — send any message; a normal reply means you're live.

Still stuck? Contact us — we usually reply **within 15 minutes**:

- Email: **support@mintpop.ai**
<!-- Telegram contact pending; restore this line once we have the handle:
- Telegram: **@xxx**
-->
