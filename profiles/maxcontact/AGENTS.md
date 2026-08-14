# MaxContact Profile

Placeholder. This is where real, confirmed MaxContact architecture and conventions go — not invented ones. Nothing below is a fact yet; each section is a prompt for what to document, filled in as it's actually confirmed (from real docs, real conversations, or reading the actual infra/code).

Rule for whoever fills this in (human or agent): only write down what's been verified. If it's a guess, don't put it here — ask, or leave the section marked TODO.

## Architecture Conventions
TODO — e.g. service boundaries, how services communicate, monorepo vs polyrepo conventions.

## Environment Topology
TODO — e.g. what environments exist (prod, nonprod, dev), what's on Crucible vs elsewhere, which cloud subscriptions/accounts map to which environment.

## Infrastructure Conventions
TODO — e.g. Terraform module conventions, Crossplane usage, naming conventions for cloud resources.

## Deployment Assumptions
TODO — e.g. how deploys happen (ArgoCD, Kargo, GitHub Actions), what "done" looks like for a deploy.

## Security Constraints
TODO — e.g. what's never allowed (secrets in code, direct prod DB access), what needs sign-off, data classification rules.

## CI/CD Conventions
TODO — e.g. which GitHub Actions org action to use, required checks, branch protection expectations.

## Operational Safety Rules
TODO — e.g. what always needs a human in the loop, escalation paths, on-call expectations.

## Important Documentation Locations
TODO — e.g. Confluence spaces, runbooks, the Crucible SSOT page, ADR locations.

---

Until this is filled in, agents operating under the `work` hat should say "MaxContact profile is still a placeholder" rather than inventing answers to these questions.
