# CLAUDE.md

`q-cli` is a beautiful terminal SQL client built with TypeScript + React Ink.
It targets PostgreSQL (MVP), renders results as clean tables, supports vim mode
in the prompt, and integrates with local Ollama for AI query explanation.

## Run & test

```bash
pnpm install       # install deps
pnpm dev           # run in dev mode
pnpm test          # run test suite
pnpm lint          # lint
pnpm format        # format
pnpm build         # bundle to dist/
```

## Where things live

- Planning artifacts: `docs/` (scope, MVP, tech stack, implementation plan)
- Source: `src/` — entry point is `src/index.tsx`
- UI components: `src/ui/components/`
- DB layer: `src/db/`
- AI client: `src/ai/`
- Slash commands: `src/commands/`
- Config + keychain: `src/config/`
- Full conventions and guardrails: `AGENTS.md`
- Current build progress: `docs/implementation-plan.md`

## Key decisions

- Vim mode is implemented as a custom input layer (adapted from Gemini CLI)
- Credentials stored via OS keychain (`keytar`), never plaintext
- AI features use any OpenAI-compatible local endpoint (Ollama default)
- Named exports only, no default exports
- No comments unless the WHY is non-obvious
