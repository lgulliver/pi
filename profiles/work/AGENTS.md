# MaxContact Profile

Confirmed facts below are sourced directly from real per-repo agent definitions (`.claude/agents/*.md` in conversational-ai, crucible, speech-transcription, and others) discovered while surveying `~/repos` — not invented. Sections still marked TODO are genuinely unconfirmed; don't fill them from guesswork.

Rule for whoever adds to this (human or agent): only write down what's been verified. If it's a guess, don't put it here — ask, or leave the section marked TODO.

## Environment Topology & Deployment (confirmed)

MaxContact's Kubernetes platform is **Crucible**, an AKS cluster. Services deploy via a consistent three-repo pattern:

| Repo | Owns |
|---|---|
| the service's own repo | `.crucible/` Kustomize manifests, `.github/workflows/` CI, image builds |
| `crucible` | `tenant-manifests/` ArgoCD ApplicationSets, `pr-environments/`, Kyverno policies, Crossplane platform APIs |
| `kargo-config` | Kargo Warehouses/Stages — the promotion pipeline between environments |

**Delivery mechanics**: CI pushes `ghcr.io/maxcontact/<repo>/<service>:sha-<sha>` (some services use ACR instead). A Kargo Warehouse subscribes to that tag pattern; a Stage's promotion template force-pushes the rendered overlay to an `env/<env>` branch, which ArgoCD tracks. **The `sha-` prefix vs. a bare PR SHA is a deliberate safety boundary** — it's what stops unmerged PR code from ever being selected as promotable Freight. Never hand-edit an `env/*` branch directly.

Not every service runs in every environment — several are deliberately dev-only on Crucible today. Adding an environment is a multi-part change across all three repos (overlay + tenant-manifest entry + Kargo Stage + approver RBAC), not just adding a Kustomize overlay.

`stereo-api` is the house reference implementation across the platform for manifest layout, ExternalSecrets, Crossplane claims, and HTTPRoutes — check it before inventing a new shape for anything Crucible-related.

## Infrastructure Conventions (confirmed)

- **Namespacing**: `tenant-shared-<service>-<env>`. The `-prod` suffix is load-bearing — a Kyverno ClusterPolicy schedules it onto a dedicated prod nodepool, and schedules every other `tenant-*` namespace onto a shared non-prod nodepool with spot tolerations auto-injected. Don't hand-write `nodeSelector`/`tolerations` in a manifest — the policy does it, and hand-writing it fights the policy on every sync.
- **Registry auth**: a pull secret (GHCR or ACR) is cloned into tenant/PR namespaces automatically by a Kyverno policy — the secret itself is never committed, just referenced via `imagePullSecrets`.
- **Secrets**: External Secrets Operator (`provider-azure-keyvault` + ESO) is the only path from Key Vault to a running pod. Raw Secrets in git are not the pattern anywhere in this platform.
- **Crossplane**: Azure infra (Postgres, blob storage, workload identity confirmed live; Cosmos DB/Service Bus/AI Search seen as planned/spike work in some repos, not assumed universally available) is provisioned via Composite Resource Definitions under a `platform-manifests/crossplane-apis/` path in the `crucible` repo, claimed by tenant repos. A provider must be installed and Healthy before its XRD can be authored.
- **Cluster-scoped resources** (ClusterRole, CRDs, Namespaces) belong only in the `crucible` platform repo — an application repo's `.crucible/` will get its sync rejected by the `tenant-workloads` AppProject if it tries.

## CI/CD Conventions (confirmed)

GitHub Actions is the standard CI, using a shared `MaxContact/github-actions` reusable action for Docker build/push. Trivy SCA and license-check gates are typically hard gates ahead of the build/test jobs. The image-tagging contract above (`sha-` vs bare SHA) is the load-bearing part of CI to preserve in any workflow change.

## Security Constraints (confirmed pattern, not a complete policy)

- No secrets in manifests, ConfigMaps, Dockerfiles, or workflow logs/artifacts — flow through External Secrets/Key Vault instead.
- No customer data, call transcripts, prompts, or PII in manifests, example values, logs, or spans, at any log level (UK GDPR / PCI relevant).
- Untrusted input (e.g. a webhook body) that gets fetched with a credential attached must be pinned against an exact configured host allowlist first — a real prior incident (forged webhook → credential exfiltration risk) makes this a hard rule, not a suggestion.
- SAS URLs, join tokens, and similar bearer-style credentials must never be logged or placed on a trace span.

## Architecture Conventions
TODO — service boundaries and inter-service communication conventions beyond the Crucible/deployment layer above weren't confirmed by this survey; don't assume a specific pattern (REST vs events vs gRPC) applies platform-wide.

## Operational Safety Rules
TODO — on-call/escalation process not confirmed from repo content; ask rather than assume.

## Important Documentation Locations
The Crucible SSOT Confluence page (id `2020638721`, per prior session memory) reconciles built state vs. rollout plan for platform leadership — a real, previously-confirmed reference, not sourced from this survey. Beyond that: TODO.

---

Sections above are accurate as of the repo survey that produced them (2026-08-14) — re-verify anything load-bearing against the actual repo before relying on it for a production change, since platform conventions evolve.
