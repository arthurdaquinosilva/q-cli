# Q CLI

A beautiful terminal SQL client with vim keybindings and AI-powered query explanation.

```
 ▗▄▄▄▄▖
▐░    ░▌  Q CLI v0.1.0
▐░    ░▌
▐░  ▗▟▌   Connected as  postgres
 ▀▀▀▝▀    Database      mydb
          Host          localhost
```

## Features

- **Beautiful tables** — clean, aligned output with automatic expanded mode for wide results
- **Vim mode** — full normal/insert mode with motions, operators, yank/paste
- **Query history** — persisted across sessions, navigate with ↑↓
- **AI explanation** — explain any SQL query in plain English via Groq or Ollama
- **Slash commands** — with Tab autocomplete and ↑↓ suggestion navigation
- **Responsive layout** — auto-switches to vertical key=value mode when the table is wider than the terminal

---

## Requirements

- Node.js 18+
- pnpm
- PostgreSQL database

---

## Install

```bash
git clone https://github.com/arthurdaquinosilva/q-cli.git
cd q-cli
pnpm install
pnpm build
pnpm install -g .
```

After that, `q-cli` is available globally:

```bash
q-cli --connection postgresql://user:pass@localhost/mydb
```

---

## Connecting

Pass your connection string via the `--connection` flag (or `-c` for short):

```bash
q-cli --connection postgresql://user:pass@localhost/mydb
q-cli -c postgresql://user:pass@localhost/mydb
```

---

## AI Setup

Q CLI can explain your queries using any OpenAI-compatible API.

### Groq (recommended — fast and free)

1. Get a free API key at [console.groq.com](https://console.groq.com)
2. Set the key in your shell:

```bash
# Add to ~/.zshrc or ~/.bashrc
export Q_CLI_API_KEY=gsk_...
```

3. Connect with Groq:

```bash
q-cli -c postgresql://... \
  --ai-url https://api.groq.com/openai/v1 \
  --ai-model llama-3.1-8b-instant
```

### Ollama (local, offline)

```bash
ollama pull llama3.2
ollama serve
```

```bash
q-cli -c postgresql://... --ai-model llama3.2
```

Ollama is the default endpoint (`http://localhost:11434/v1`).

---

## Slash Commands

| Command | Description |
|---|---|
| `/explain <SQL>` | Explain a SQL query in plain English |
| `/explain-previous` | Explain the last query you ran |
| `/databases` | List available databases |
| `/tables` | List tables in the current database |
| `/toggle-vim-mode` | Toggle vim keybindings on/off |

Type `/` and use **Tab** or **↑↓** to navigate and complete commands.

---

## Vim Mode

Q CLI starts in INSERT mode. Press `Escape` to enter NORMAL mode.

| Keys | Action |
|---|---|
| `i` / `a` / `A` | Enter INSERT mode |
| `h` / `l` | Move left/right |
| `w` / `b` / `e` | Word forward/backward/end |
| `0` / `$` | Start/end of line |
| `dd` / `cc` / `S` | Clear line |
| `dw` / `cw` | Delete/change word |
| `x` / `s` | Delete/substitute character |
| `D` / `C` | Delete/change to end of line |
| `yy` / `p` | Yank line / paste |

In INSERT mode, **↑↓** navigates query history.

Disable vim mode with `/toggle-vim-mode` or use `--no-vim` if you prefer plain input.

---

## All Flags

| Flag | Default | Description |
|---|---|---|
| `--connection`, `-c` | — | PostgreSQL DSN (required) |
| `--ai-url` | `http://localhost:11434/v1` | OpenAI-compatible API base URL |
| `--ai-model` | `llama3.2` | Model name |
| `--api-key` | `$Q_CLI_API_KEY` | API key for remote endpoints |

---

## Development

```bash
pnpm dev --connection postgresql://user:pass@localhost/mydb
pnpm test
pnpm lint
pnpm build
```
