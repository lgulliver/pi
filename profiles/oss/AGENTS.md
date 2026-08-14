# OSS Profile

Placeholder, same rule as the MaxContact profile: only real, confirmed conventions go here. This one is inherently more per-repo than the MaxContact profile (every OSS project has its own contribution style) — treat this as defaults to override per-project via that repo's own `AGENTS.md`/`CONTRIBUTING.md`, not a universal standard to impose.

## Default Assumptions (override per repo)
- Conventional commits unless the repo's own history says otherwise.
- Check for a `CONTRIBUTING.md` / issue templates / PR template before assuming process — use them if present.
- Semver for version bumps unless the repo states otherwise.

## Release Conventions
TODO — fill in per-project if you maintain releases for it (changelog format, tagging convention, where releases get announced).

## Review Standards
TODO — fill in what "mergeable" means for projects you maintain (required checks, review count, who can merge).

---

Until project-specific detail is added here, agents operating under the `oss` hat should default to whatever the target repo's own docs say, and ask rather than assume when they don't say anything.
