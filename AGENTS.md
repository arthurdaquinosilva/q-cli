# AGENTS.md

## Project overview

`q-cli` is a beautiful terminal SQL client for developers who live in the
command line. It targets PostgreSQL (MVP), renders query results as clean tables,
supports vim mode in the prompt, and integrates with local AI models (Ollama)
for query explanation. Built with TypeScript, React Ink, and node-postgres.

## Run & test

```bash
# install
pnpm install

# run (dev)
pnpm dev

# run with a connection
pnpm dev -- --connection postgresql://user:pass@localhost/dbname

# build
pnpm build

# test
pnpm test

# lint
pnpm lint

# format
pnpm format
```

## Project structure

```
src/
  index.tsx               # entry point
  ui/
    components/           # Ink React components
      App.tsx             # root component
  db/                     # PostgreSQL connection and query execution
  ai/                     # Ollama / OpenAI-compatible client
  commands/               # slash command handlers (/explain, etc.)
  config/                 # config file and keychain access
```

## Conventions

- TypeScript strict mode — no `any`, no `ts-ignore` without a comment explaining why
- React Ink components in `src/ui/components/`, one component per file
- File names: `PascalCase.tsx` for components, `camelCase.ts` for modules
- No default exports — named exports only
- Prettier handles formatting — do not hand-format
- No comments unless the WHY is non-obvious

## Versioning & commits

This project uses **Semver** and **Conventional Commits**. Every commit must
follow this format:

```
<type>(<scope>): <short description>

[optional body]
```

**Types:**
- `feat` — new feature (bumps MINOR: 0.x.0)
- `fix` — bug fix (bumps PATCH: 0.0.x)
- `chore` — tooling, deps, config (no version bump)
- `docs` — documentation only
- `refactor` — code change with no behavior change
- `test` — adding or updating tests
- `style` — formatting only
- `build` — build system changes

**Scopes** (use the relevant module):
`ui`, `db`, `ai`, `commands`, `config`, `vim`, `table`, `history`

**Rules:**
- One logical change per commit — never batch unrelated changes
- Description is lowercase, imperative, no period: `feat(db): add postgres connection`
- Breaking changes add `!` after type: `feat(db)!: change connection DSN format`
- Version in `package.json` is updated manually when cutting a release

**Current version:** `0.1.0` (pre-release, active development)

**Version bumping guide:**
- New user-facing feature → bump MINOR (`0.1.0` → `0.2.0`)
- Bug fix → bump PATCH (`0.1.0` → `0.1.1`)
- Breaking change → bump MAJOR (`0.x.x` → `1.0.0`) — only after MVP ships

**Implementation plan tracking:**
- Mark tasks `[~]` when starting, `[x]` immediately when done
- Never leave tasks in `[~]` state across sessions
- Update `docs/implementation-plan.md` as part of the same commit that finishes the task

## Guardrails

- Do not add dependencies without asking
- Do not touch `docs/` files unless specifically asked to update planning artifacts
- Do not store credentials in plaintext — use `keytar` for passwords
- Do not commit `.env` files or secrets
- Do not change `tsconfig.json` or `eslint.config.js` without asking

## Artifact map

- Scope & requirements — `docs/project-scope.md`
- MVP definition — `docs/mvp.md`
- Tech stack — `docs/tech-stack.md`
- Implementation plan — `docs/implementation-plan.md`
- Test plan — `docs/test-plan.md`
- Deployment — `docs/deployment.md`
- Decision log — `docs/decisions.md`
