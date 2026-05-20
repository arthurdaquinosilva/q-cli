# Implementation Plan

## Legend

- `[ ]` not started · `[~]` in progress · `[x]` done
- **Depends on:** which task(s) must land first
- **Done when:** the verifiable check that closes the task

---

## Phase A: Walking skeleton — something that runs end-to-end

### A.1 — Project scaffold
- [x] Init `pnpm` project, `tsconfig.json`, `eslint`, `prettier`, `vitest`, `tsup`. Create `src/index.ts` entry point that prints "Hello from sql-cli" and exits cleanly.
- **Depends on:** none
- **Done when:** `pnpm dev` prints the message; `pnpm lint` and `pnpm test` run without errors

### A.2 — Minimal Ink app
- [x] Replace the entry point with a basic Ink app: renders a static welcome message in the terminal and exits on `q` or `Ctrl+C`.
- **Depends on:** A.1
- **Done when:** `pnpm dev` renders an Ink component in the terminal; process exits cleanly on quit

### A.3 — PostgreSQL connection
- [ ] Accept a `--connection <dsn>` CLI argument. On startup, attempt to connect to PostgreSQL using `pg`. Show a success or error message in the Ink UI.
- **Depends on:** A.2
- **Done when:** `pnpm dev --connection postgresql://user:pass@localhost/db` connects and displays connection status; wrong DSN shows a readable error

### A.4 — Run a query, display raw output
- [ ] Add a basic single-line text input (no vim mode yet). On Enter, execute the query against the connected DB and display the raw JSON result in the terminal.
- **Depends on:** A.3
- **Done when:** `SELECT 1` runs and the result appears in the terminal

---

## Phase B: Core UX — input, tables, history

### B.1 — Beautiful table rendering
- [ ] Replace raw JSON output with a formatted table using a Rich-style Ink component. Handle empty results, single-row results, and multi-row results.
- **Depends on:** A.4
- **Done when:** `SELECT id, name FROM users` renders as a clean, aligned table with headers

### B.2 — Responsive column layout
- [ ] Detect terminal width. If the table is wider than the terminal, automatically switch to expanded (vertical key=value) layout. Switch back when the terminal is wide enough.
- **Depends on:** B.1
- **Done when:** a wide query auto-switches to expanded mode; resizing the terminal re-evaluates layout

### B.3 — Large result set truncation
- [ ] If a result set exceeds 500 rows, display the first 500 and show a visible warning: "Showing 500 of N rows."
- **Depends on:** B.1
- **Done when:** a query returning 1000+ rows shows the warning and exactly 500 rows

### B.4 — Query history
- [ ] Persist query history to `~/.sql-cli/history.json`. Up-arrow navigates backward through history; down-arrow navigates forward. History persists across sessions.
- **Depends on:** A.4
- **Done when:** after restarting the CLI, up-arrow recalls queries from the previous session

### B.5 — Vim mode in the prompt
- [ ] Implement vim normal/insert mode for the prompt input, adapted from Gemini CLI's `vim-buffer-actions.ts`. Support: mode toggle (`Escape` / `i`), navigation (`h`, `j`, `k`, `l`, `w`, `b`, `0`, `$`), deletion (`dd`, `x`), yank (`yy`). Display current mode (INSERT / NORMAL) as a status indicator.
- **Depends on:** A.4
- **Done when:** all listed motions work correctly; mode indicator updates on toggle; existing text input still works in INSERT mode

---

## Phase C: Slash commands and AI

### C.1 — Slash command router
- [ ] Detect when input starts with `/`. Parse the command name and arguments. Return a "unknown command" message for unrecognized commands. This is the foundation all slash commands build on.
- **Depends on:** B.5
- **Done when:** `/foo` shows "Unknown command: foo"; `/explain` is routed correctly (even if not implemented yet)

### C.2 — Ollama client
- [ ] Create a thin client that sends a prompt to any OpenAI-compatible local endpoint (default: `http://localhost:11434/v1`). Configurable via `--ai-url` flag or config file. Handle connection errors gracefully.
- **Depends on:** A.1
- **Done when:** the client sends a request to a running Ollama instance and returns the response text; a missing Ollama shows a clear error, not a crash

### C.3 — `/explain` command
- [ ] `/explain` sends the last executed query (or a query passed as argument) to the Ollama client with a prompt asking for a plain-language explanation. Stream the response to the terminal.
- **Depends on:** C.1, C.2
- **Done when:** after running `SELECT * FROM users WHERE age > 30`, `/explain` returns a readable explanation of the query

---

## Phase D: Welcome screen and connection UX

### D.1 — Welcome screen
- [ ] On startup (before a query is run), display a welcome screen: tool name, version, connected database name, and a short hint about available slash commands.
- **Depends on:** A.3
- **Done when:** startup shows the welcome screen with correct connection info; it clears when the first query is submitted

### D.2 — Credential storage via keytar
- [ ] When a connection DSN contains a password, strip it and store it in the OS keychain via `keytar`. On reconnect, retrieve the password from the keychain. Fall back to prompting if not found.
- **Depends on:** A.3
- **Done when:** after first connect with a password, subsequent connects without the password in the DSN succeed by reading from the keychain

---

## Phase E: Polish and ship

### E.1 — Error handling audit
- [ ] Review all database errors, connection errors, and AI errors. Ensure every error path shows a user-readable message and never crashes the process.
- **Depends on:** all of Phase D
- **Done when:** killing the DB mid-session, sending a malformed query, and disconnecting Ollama all show errors without crashing

### E.2 — README
- [ ] Write `README.md`: what the tool does, install steps, how to connect, available slash commands, how to configure Ollama.
- **Depends on:** E.1
- **Done when:** a fresh clone + README produces a running CLI with a real DB connection in under 5 minutes

### E.3 — Package for local install
- [ ] Configure `tsup` to bundle the CLI. Add a `bin` entry to `package.json` so `pnpm install -g .` makes `sql-cli` available globally.
- **Depends on:** E.2
- **Done when:** after global install, `sql-cli --connection <dsn>` works from any directory

---

## Deviations from plan

- None yet.
