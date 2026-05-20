# Deployment

<!--
  Phase 10 of the framework. The goal is a REPEATABLE release, not a one-off.
  If a step only lives in your head, it isn't done. See FRAMEWORK.md → Phase 10.
-->

## Target environment

<!-- Where this runs in production: platform/host, region, runtime versions,
     any managed services it depends on. -->

## Release process

<!-- Step-by-step, from a commit to a live release. Numbered. If it's automated
     (CI/CD), describe the pipeline and what triggers it. -->

1.

## Environment variables & secrets

<!-- What config the app needs in production, and how secrets are stored and
     injected. Never commit actual secret values — list the names only. -->

| Variable | Purpose | Where it's set |
|----------|---------|----------------|
| | | |

## Health checks

<!-- How you confirm a deploy is good: the endpoint/command/signal to check,
     and what a healthy result looks like. -->

-

## Rollback

<!-- Exactly how to get back to the last known-good state, and how fast it can
     be done. Write this BEFORE you need it. -->

1.

## Known operational risks

<!-- What could go wrong in production, and the plan if it does. -->

-
