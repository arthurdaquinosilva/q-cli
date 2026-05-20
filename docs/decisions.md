# Decision Log

<!--
  A running log, updated across every phase of the framework. Capture decisions
  that were non-obvious or hard to reverse — the ones future-you (or the agent)
  would otherwise have to reverse-engineer. Newest entry on top.
  Lightweight ADR style. See FRAMEWORK.md → Cross-cutting principles.
-->

## YYYY-MM-DD — <!-- short title of the decision -->

- **Context.** <!-- what situation forced a decision -->
- **Decision.** <!-- what we chose -->
- **Why.** <!-- the reasoning, and the main alternative we rejected -->
- **Consequences.** <!-- what this makes easier, harder, or locks us into -->

---

<!-- Copy the block above for each new decision. Example:

## 2026-05-14 — Use SQLite for the MVP data store

- **Context.** MVP is single-user and runs locally; no concurrent writers.
- **Decision.** SQLite, with a thin data-access layer to allow swapping later.
- **Why.** Zero infra, zero ops. Postgres was the alternative but adds a service
  to run for no MVP benefit. The data-access layer keeps the door open.
- **Consequences.** Trivial local setup; will need a migration path if we add
  multi-user sync (a known Phase 11 candidate).

-->
