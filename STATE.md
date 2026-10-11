# STATE.md — 256-wiki build ledger

> Mission: public front end for the 256 Foundation's Public Mining Brain.
> Site: `wiki.256foundation.org` · Repo: `256foundation/256-wiki`
> Plan: `~/.opencode/plan/256-wiki-front-end.md` (approved 2026-10-11) · Agent loop updates this file constantly.

## Current status

**Phase 0 in progress.** Next queue below.

## Done

| Date | Task | Commit/PR | Notes |
|---|---|---|---|
| 2026-10-11 | Repo scaffold: git init, remote, README, LICENSE (MIT+note), .gitignore, .env.example, STATE.md | (this commit) | public-mining-brain has no LICENSE file → MIT for code, provenance note for content |

## In progress

- Phase 0.2 — PR into public-mining-brain: `scripts/build_export.py` + pack-release GitHub Action + content-gap-report issue template.

## Next queue (plan §7)

1. Phase 0.2 — build_export.py PR into public-mining-brain (scripts + CI release + issue template)
2. Phase 0.3 — `infra/` Terraform: S3, CloudFront+ACM, Lambda, DynamoDB ×3, alarms→SNS, Budgets $10, Makefile (plan default / apply explicit)
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

Secrets to provision (exact names; `.env.example` has placeholders):

| Secret | Used by | Notes |
|---|---|---|
| `OPENROUTER_API_KEY` (env `LLM_API_KEY`) | Lambda `ask` | Dedicated OpenRouter key, per-key spend monitoring |
| `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | ask + suggest forms | Cloudflare Turnstile, free |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `AUTHENTIK_CLIENT_ID/SECRET`, `AUTHENTIK_ISSUER` | sign-in (25/day tier) | GitHub/Google OAuth apps; Authentik OIDC client incl. team group claim |
| `SESSION_SECRET` | session cookie | openssl rand -hex 32 |
| `GITHUB_TOKEN` | suggest→issue, weekly gap report | repo scope on 256foundation, filed from Lambda |

Infra agent handoff (apply steps, DNS row, secrets list, alarm destination) — built out as Phase 0.3 lands; final copy in section below before launch.

## Infra-agent handoff (draft → finalize at launch)

_(pending Phase 0.3)_

## PR log

| Repo | PR | Status |
|---|---|---|
| public-mining-brain | _(pending Phase 0.2)_ | |
