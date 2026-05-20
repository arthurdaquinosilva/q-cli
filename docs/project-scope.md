# Project Scope

## Problem

Existing SQL CLI tools (mysql, psql) have functional but ugly interfaces. The
outputs — especially table results — are visually poor. There is no alias
system, no AI assistance, and no modern UX.

## Solution

A beautiful, modern SQL CLI tool with a UI/UX inspired by Claude Code and
Gemini CLI. It supports multiple databases and connections, slash-command
driven interaction, AI-powered features via local models, and clean table
rendering.

## Users

Developers who live in the command line.

## Features

### Connections
- Support multiple database engines: MySQL, PostgreSQL, SQLite, and others
- `/add connection` — guided prompt to configure and save a named connection
  (e.g., `local-mysql`, `staging-pg`)
- `/connect [name]` — connect to a saved connection; if no name given, shows
  a list of available connections to pick from
- Connections can also be passed as a CLI argument at startup:
  `sql-cli --connection local-mysql`
- Connection configs saved locally (e.g., `~/.sql-cli/connections.json`)
- Multi-connection support: switch between connections in a session

### Aliases (saved queries)
- Aliases are scoped to the database they were created in (mirrors how stored
  procedures/functions work in MySQL and PostgreSQL)
- Aliases support parameters (e.g., `/get_user id=42`)
- `/create alias` — guided prompt: enter alias name, query, and parameter
  definitions
- Aliases are invoked with a leading `/` (e.g., `/get_users_by_age`)
- Aliases stored locally per-database

### Output & tables
- All query results displayed as beautiful, well-formatted tables
- Responsive column layout: switches to expanded (vertical) mode
  automatically for wide result sets (like `\x auto` in psql)
- Large row counts: paginated display (press any key to advance)
- `/export csv` or `/export json` — exports the last result set to a file

### AI integration
- Supports any OpenAI-compatible local endpoint (e.g., Ollama) — no API key
  required for MVP
- `/explain <query or alias>` — explains what a query does in plain language
- `/generate <description>` — generates a SQL query from a natural-language
  description
- AI features are opt-in, triggered explicitly via slash commands

### Shell-like UX
- Query history with up-arrow recall and search
- Nice introductory/welcome screen on startup
- Slash-command system for all tool actions
- Vim mode for the prompt input (normal/insert mode toggle, navigation, standard
  vim motions — `dd`, `yy`, `w`, `b`, `0`, `$`, etc.)

## Out of scope

- Cloud sync for aliases or connections
- GUI or web interface
- Multi-user or team collaboration features
- Query plan visualization (at least for MVP)
- Authentication beyond storing credentials locally

## Open questions

None.

## Decisions

- **Credential storage:** OS keychain via a cross-platform library (e.g.,
  `keyring` for Python or `keytar` for Node). Passwords never written to disk;
  OS manages access control.
