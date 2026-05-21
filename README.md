# Q CLI

A beautiful terminal SQL client with vim keybindings and AI-powered query explanation.

![Q CLI](./readme-cover.png)

## Features

- **Beautiful tables** — clean, aligned output with automatic expanded mode for wide results
- **Vim mode** — full normal/insert mode with motions, operators, yank/paste
- **Query history** — persisted across sessions, navigate with ↑↓
- **AI explanation** — explain any SQL query in plain English via Groq or Ollama
- **Slash commands** — with Tab autocomplete and ↑↓ suggestion navigation
- **Responsive layout** — auto-switches to vertical key=value mode when the table is wider than the terminal
- **Connection wizard** — interactive form on startup if no connection string is provided
- **Multiple drivers** — PostgreSQL, MySQL, and SQLite
- **Credential storage** — passwords saved to OS keychain automatically
- **Pagination** — navigate large result sets with `/next` and `/prev`
- **Export** — save results to CSV or JSON

---

## Requirements

- Node.js 18+
- pnpm

---

## Install

```bash
git clone https://github.com/arthurdaquinosilva/q-cli.git
cd q-cli
pnpm install
pnpm build
pnpm install -g .
```

After that, `q-cli` is available globally.

---

## Connecting

### With a connection string

```bash
# PostgreSQL
q-cli --connection postgresql://user:pass@localhost/mydb
q-cli -c postgresql://user:pass@localhost/mydb

# MySQL
q-cli -c mysql://user:pass@localhost/mydb

# SQLite
q-cli -c sqlite:///path/to/database.db
```

### With the interactive wizard

Run `q-cli` with no arguments and fill in the form:

```bash
q-cli
```

Use **Tab** or **↑↓** to move between fields, **←→** to cycle the driver, **Enter** to connect. Passwords are saved to the OS keychain after a successful connection and pre-filled on the next run.

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
| `/export csv` | Export last result to a CSV file |
| `/export json` | Export last result to a JSON file |
| `/next` | Next page of results |
| `/prev` | Previous page of results |
| `/toggle-vim-mode` | Toggle vim keybindings on/off |

Type `/` and use **Tab** or **↑↓** to navigate and complete commands.

---

## psql Aliases

Users coming from `psql` can use familiar meta-commands:

| Command | Equivalent |
|---|---|
| `\l` | List databases |
| `\d` or `\dt` | List tables |
| `\du` | List users |
| `\c` | Show current database |
| `\c <dbname>` | Switch to a different database |

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

Disable vim mode with `/toggle-vim-mode` or pass `--no-vim` for plain input.

---

## All Flags

| Flag | Default | Description |
|---|---|---|
| `--connection`, `-c` | — | Connection string (optional — wizard shown if omitted) |
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
