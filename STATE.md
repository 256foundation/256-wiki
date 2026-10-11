# STATE.md — 256-wiki build ledger

> Mission: public front end for the 256 Foundation's Public Mining Brain.
> Site: `wiki.256foundation.org` · Repo: `256foundation/256-wiki`
> Plan: `~/.opencode/plan/256-wiki-front-end.md` (approved 2026-10-11) · Agent loop updates this file constantly.

## Current status

**Phase 0.1 + 0.2 complete. 0.3 (infra) in progress.**

## Done

| Date | Task | Commit/PR | Notes |
|---|---|---|---|
| 2026-10-11 | Repo scaffold: git init, remote, README, LICENSE (MIT+note), .gitignore, .env.example, STATE.md | 318ca8f | public-mining-brain has no LICENSE file → MIT for code, provenance note for content |
| 2026-10-11 | `scripts/build_export.py` + pack-release CI + content-gap-report template | [public-mining-brain#1](https://github.com/256foundation/public-mining-brain/pull/1) | Schema v1 verified on live wiki: 127 pages, 11 topics, 0 lint errors; `--check` deterministic; release tag `pack-v<date>.<shorthash>`; awaiting human review/merge |
| 2026-10-11 | `infra/` Terraform module complete | 17809c3 | `terraform fmt -check` + `validate` green. **`make plan` blocked: no AWS creds on this machine** (no ~/.aws, no env) — needs Tyler |

## In progress

- Phase 0.4 — Next.js scaffold + CI.

## Next queue (plan §7)

1. ~~Phase 0.2 — build_export.py PR into public-mining-brain~~ ✅ PR #1 open
2. ~~Phase 0.3 — `infra/` Terraform~~ ✅ validate green; plan blocked on AWS creds
3. Phase 0.4 — Next.js scaffold: static export, pack fetch from GitHub release, CI (build/lint/test, no AWS secrets)
4. Phase 1 — read-only site (epistemics UI, Pagefind, live strip, RSS, about/contribute)
5. Phase 2 — ask pipeline (retrieval, LLM adapter, chat, Turnstile, identity, quotas, cache, permalinks, query log, breaker)
6. Phase 3 — agent surface (REST, MCP, SKILL.md, llms.txt, README quickstarts, OG tags)
7. Phase 4 — gap report automation, /gaps board, POD256 integration

## Decisions / deviations

| Decision | Reason |
|---|---|
| MIT license + content provenance note | public-mining-brain carries no LICENSE file; mission says match it, else MIT+note |
| Single Lambda app (Hono) serving `/api/*` + `/mcp` instead of per-route Lambdas | Cost/simplicity at v1 traffic; split later only if cold-start or error isolation demands it |
| (more recorded as made) | |

## Blockers / Needs Tyler

| # | What | Exact names | Status |
|---|---|---|---|
| 1 | **AWS credentials for `make plan`** (infra/) | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in env, or `~/.aws` profile | Open — terraform validate green; plan+apply is the infra agent's `APPLY=1` run |
| 2 | OpenRouter dedicated key | `OPENROUTER_API_KEY` | Provision for Phase 2 |
| 3 | Cloudflare Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` (site+secret pair) | Provision for Phase 2 |
| 4 | Authentik OIDC client | `AUTHENTIK_CLIENT_ID/SECRET`, `AUTHENTIK_ISSUER`, team group claim (plan §9.3) | Provision for Phase 2 |
| 5 | GitHub OAuth app + Google OAuth client | `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | Provision for Phase 2 |
| 6 | GitHub token (issue filing) | `GITHUB_TOKEN` (repo scope on public-mining-brain) | Needed for Phase 4 gap automation |
| 7 | public-mining-brain PR #1 review/merge | https://github.com/256foundation/public-mining-brain/pull/1 | Blocks pack-release flow (site build falls back to a vendored pack meanwhile) |

Infra agent handoff (apply steps, DNS row, secrets list, alarm destination) — final copy in the section below before launch.

## Infra-agent handoff (draft → finalize at launch)

_(pending Phase 0.3 — module written, needs first `make plan` with credentials)_

## PR log

| Repo | PR | Status |
|---|---|---|
| public-mining-brain | [#1 — knowledge pack builder + release CI + gap-report template](https://github.com/256foundation/public-mining-brain/pull/1) | open, awaiting review |
