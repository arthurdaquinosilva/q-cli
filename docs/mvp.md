# MVP

## Core problem the MVP must solve

Existing SQL CLIs (psql, mysql) produce ugly output and have no modern UX —
this tool must make running queries and reading results visibly, meaningfully
better.

## In the MVP

- **Single engine:** PostgreSQL only
- **Connection:** passed as a CLI argument at startup (`q-cli --connection <dsn>`)
  or via a simple local config file; OS keychain for password storage
- **Query execution:** run any SQL query, display results as a beautiful table
- **Responsive layout:** auto-switch to expanded (vertical) mode for wide result
  sets (like `\x auto` in psql)
- **Large result sets:** display up to N rows (e.g., 500) with a visible warning
  if truncated
- **Vim mode:** full normal/insert mode in the prompt, standard motions
  (`dd`, `yy`, `w`, `b`, `0`, `$`, etc.)
- **Query history:** up-arrow recall and search across the session
- **Welcome screen:** clean introductory screen on startup
- **AI — `/explain`:** explain the last or a given query in plain language,
  via any OpenAI-compatible local endpoint (Ollama default)

## Deferred (not now, not never)

| Feature | Reason deferred |
|---|---|
| MySQL, SQLite, other engines | Testing across engines is expensive; abstraction can be added once core UX is proven |
| Multi-connection / `/add connection` | One connection is enough to validate the experience |
| Aliases (static and parameterized) | Useful but not the core value proposition |
| `/generate` AI command | `/explain` proves AI integration; generation can come later |
| `/export csv/json` | Nice to have; not a reason to switch tools |
| Pagination for large result sets | Simple truncation with a warning is sufficient for MVP |

## Success criteria

1. Can connect to a PostgreSQL database and run arbitrary SQL queries
2. Results are displayed as clean, readable tables — visibly better than raw psql output
3. Wide result sets automatically switch to expanded layout without user intervention
4. Vim normal/insert mode works in the prompt; common motions behave as expected
5. Query history is searchable and navigable with the up arrow
6. `/explain` returns a plain-language explanation of a query using a local Ollama model
7. A developer can clone the repo, follow the README, and be running queries within 5 minutes

## Assumptions & risks

- Ollama is available locally for testing AI features
- A terminal TUI library with solid vim mode support exists (to be confirmed in Phase 4)
- PostgreSQL is the right first engine (user's primary database)
