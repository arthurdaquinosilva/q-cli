# Tech Stack

## Constraints

- Developer knows Python, TypeScript, and JavaScript well
- No budget for external APIs — local models only (Ollama)
- Solo project, MVP first
- Must support vim mode in the prompt input
- Target users: developers on Linux/macOS

## Stack

| Layer | Choice | Why | Alternative considered |
|---|---|---|---|
| Language | TypeScript | Type safety, matches aesthetic of Claude Code and Gemini CLI | Python (prompt_toolkit has native vim mode, faster to MVP) |
| TUI framework | React Ink | Same framework as Gemini CLI and Claude Code; component model maps well to the UI | blessed (older, less ergonomic) |
| Vim mode | Custom (adapted from Gemini CLI's `vim-buffer-actions.ts`) | Gemini CLI solved this problem in open source; no need to start from scratch | prompt_toolkit (Python only) |
| Table rendering | `ink-table` or custom Rich-style component | Clean table output in Ink | `cli-table3` (no Ink integration) |
| PostgreSQL driver | `pg` (node-postgres) + `@types/pg` | Mature, well-documented, widely used | `postgres.js` (newer, faster, but less ecosystem) |
| AI client | `openai` SDK (OpenAI-compatible) | Works with any local Ollama endpoint; no lock-in | Raw `fetch` to local endpoint |
| Credential storage | `keytar` | OS keychain on Linux/macOS/Windows; same lib used by Gemini CLI | Plaintext `~/.q-cli/config.json` with chmod 600 |
| Package manager | `pnpm` | Fast, efficient disk usage | npm, yarn |
| Bundler | `tsup` | Simple TypeScript bundler, zero config | esbuild directly |
| Linter / formatter | `eslint` + `prettier` | Standard TypeScript tooling | `biome` (faster but less adopted) |
| Test runner | `vitest` | Fast, native TypeScript, great DX | `jest` |
| Runtime | Node.js (via `tsx` for dev) | Required for Ink; `tsx` enables ts-first dev loop | Deno (ecosystem too different) |

## Hard-to-reverse decisions

- **TypeScript + React Ink** — the entire UI is built around Ink's component model; switching would mean rewriting all UI code
- **Custom vim mode implementation** — investing in this early means owning the implementation; switching to another input library would require a rewrite of the input layer
- **`pg` driver** — deeply tied to the query execution layer; swapping later requires touching every database call

## Deliberately kept out

- **ORM (Prisma, Drizzle)** — this tool runs user-supplied raw SQL; an ORM adds no value and obscures the query layer
- **Electron / GUI** — this is a terminal tool, not a desktop app
- **Docker** — no server to containerize; this is a local CLI
- **Database connection pooling** — single-user CLI, one connection at a time is fine for MVP
