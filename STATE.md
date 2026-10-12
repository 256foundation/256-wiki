# STATE.md — 256-wiki build ledger

> Mission: public front end for the 256 Foundation's Public Mining Brain.
> Site: `wiki.256foundation.org` · Repo: `256foundation/256-wiki`
> Plan: `~/.opencode/plan/256-wiki-front-end.md` (approved 2026-10-11) · Agent loop updates this file constantly.

## Current status

**Phase 0 + 1 + 2 + 3 complete. Phase 4 loops complete in code + dev-verified: live gaps board (query-log clustering), weekly gap-report workflow, POD256 episode chips. All planned site phases now built — remaining work is the launch checklist (privacy page, alarms, load test, abuse review) which needs Tyler's AWS dev-environment pass.**

## Done

| Date | Task | Commit/PR | Notes |
|---|---|---|---|
| 2026-10-11 | Repo scaffold: git init, remote, README, LICENSE (MIT+note), .gitignore, .env.example, STATE.md | 318ca8f | public-mining-brain has no LICENSE file → MIT for code, provenance note for content |
| 2026-10-11 | `scripts/build_export.py` + pack-release CI + content-gap-report template | [public-mining-brain#1](https://github.com/256foundation/public-mining-brain/pull/1) | Schema v1 verified on live wiki: 127 pages, 11 topics, 0 lint errors; `--check` deterministic; release tag `pack-v<date>.<shorthash>`; awaiting human review/merge |
| 2026-10-11 | `infra/` Terraform module complete | 17809c3 | `terraform fmt -check` + `validate` green. **`make plan` blocked: no AWS creds on this machine** — Tyler explicitly defers AWS until he can test in a dev environment |
| 2026-10-11 | Next.js scaffold + CI | (this commit) | Static export builds 146 pages from the pack; Pagefind index (21k words); lint+typecheck+12 tests green; verified in browser desktop+mobile (docs/screens/); /api/live.json proxy serves real pool+mempool data |
| 2026-10-11 | Phase 1: Pagefind search UI + OG meta + header Search nav + RSS + static API routes | 5221394 | search verified on static export (79 hits "hydro hashrate"); live strip verified w/ real pool+mempool data |
| 2026-10-11 | Phase 2 slice A — BM25 retrieval + real `/api/search` | f2dc1bd | lib/retrieval.ts (chunked BM25 + boosts + snippets, pure TS); pack bundled into Lambda (772KB zip); verified vs 127-page pack; 11 retrieval tests |
| 2026-10-11 | Phase 2 slice B — ask pipeline: LLM adapter, store (Dynamo+memory), quotas, cache, breaker, query log, `/a/<id>` permalinks, `/ask` chat UI | eff423b | Verified E2E in dev vs mock LLM (scripts/mock-llm.mjs): answer+citations, cache hit free, gap answers free + logged, quota 429, breaker 429, permalink HTML w/ OG + As-Of sources; 34/34 tests; browser-verified desktop+mobile (docs/screens/ask-*.jpg, permalink-desktop.jpg); CI green |
| 2026-10-11 | Phase 2 slice C — identity: HMAC-signed session cookies, OAuth2 GitHub + OIDC Google/Authentik (jose), NIP-98 Nostr (@noble), dev-login, signed-in quota tier + Turnstile skip | b70f8fa | Verified live: dev-login → cookie → /api/auth/me; identified ask draws 25/day bucket w/o captcha; real NIP-98 event signed w/ noble + accepted. Provider buttons render per configured credentials; `/api/auth/providers` self-describes; 44/44 tests; CI green |
| 2026-10-11 | Phase 3 — agent surface: MCP streamable HTTP (`/mcp`), `/SKILL.md`, `/llms.txt`, static `/api/list/topics.json` + `/api/pack.json`, README quickstarts | 6f0c01e | MCP: initialize/tools×4/resources/notifications per JSON-RPC 2.0 (session id on init); **real-client verified: `claude mcp list` → ✔ Connected**; full headless E2E deferred (Tyler's Claude auth expired). SKILL.md teaches the query→fetch→cite loop; llms.txt indexes the site. 53/53 tests incl. 9 protocol tests |
| 2026-10-11 | Phase 4 — loops: live `/gaps` board (query-log clustering, Lambda `/api/gaps.json` 60s cache, CF behavior flipped to lambda-api), POD256 episode chips on citing pages (18 parsed on hashrate-heating-economics), weekly gap-report workflow (`gap-report.yml` → content-repo issue) | 843f01f | Board verified live in dev (seeded 3 gaps through the real pipeline); empty + failure states handled; clustering = exact-normalized qhash (semantic clustering is a later upgrade). POD256 chips parsed from raw capture paths, link to foundation site pending canonical episode URLs. CROSS_REPO_TOKEN secret needed for the weekly issue filing |
| 2026-10-11 | Launch checklist — `/privacy` page (complete data inventory, footer link), MCP tests made pack-agnostic (CI runs the 6-page sample until pack-v* releases) | c41ba90 | Privacy page copy verified against actual code (ipHashOf, subjectKey HMAC, TTLs, Turnstile skip); browser-verified desktop. CI green after fix; the two red runs were the pack-size assumption |
| 2026-10-12 | Rebrand step 1 — 256F design tokens (light+dark auto), Barlow Condensed/Inter/Space Mono, wordmark chrome, nav cut to Ask·Library·About | 4aa3c25 | Both schemes verified in browser; class-name contract preserved (136 selectors re-valued, none renamed); CI green |
| 2026-10-12 | Rebrand step 2 — grok-shaped landing: pcb hero, MINING BRAIN landmark, ask box, 5 curated starter chips → `/ask?q=` prefill | d0efc96 | All 5 chips verified grounded (6 citations each) via live pipeline; chip→click→answer in browser; CI green |
| 2026-10-12 | Rebrand step 3 — LiveStrip + `/api/live.json` removed end to end (component, server module, CF behavior) | 0345b48 | live.json 404s on fresh bundle; health 200; terraform validate green; 57/57; CI green |
| 2026-10-12 | Rebrand step 5+6 — /library (search + topic grid, /topics + /search kept alive; pagefind retired) + /agents (MCP one-liners, REST table, SKILL.md paste) + contribute/gaps trims | 1836d2b / 86193b7 | firmware search ranked w/ As-Of; /agents one screen; 57/57; CI green x2 |
| 2026-10-12 | Rebrand step 7 — about trimmed to 3 blocks; permalink pages re-skinned standalone (inline 256F CSS — fixes latent prod /a.css 404 via CF /a/* prefix match; kicker/footer/title telegraphic) | (this commit) | Permalink verified styled+self-contained; article pages on-brand, provenance intact; build:lambda OK; 57/57 |
| 2026-10-12 | Rebrand step 8 — full verification: desktop 1440 + mobile 390, light+dark (13 screenshots in docs/screens/rebrand-*), all gates green (57/57 tests, typecheck, eslint, next build export, build:lambda, terraform fmt+validate, CI green on every push) | (this commit) | Rebrand complete: 256F tokens light+dark auto, grok landing w/ 5 grounded chips, LiveStrip gone, telegraphic ask console, /library merged, /agents live, about trimmed, permalinks standalone |
| 2026-10-12 | Rebrand step 4 — ask console diet: telegraphic meta (`signed in — 25/day · 24 left today · sign out`), minimal answer view (model/pack badges removed, `cache hit — free` state kept), one-line quota/breaker/error states, /ask page copy cut | (this commit) | Verified in browser: chip → prefill → ask → minimal answer; cache-hit path shows the single free badge; 57/57 tests |

## In progress

- (nothing — Phase 2 slice C next)

## Next queue (plan §7)

1. ~~Phase 0.2 — build_export.py PR into public-mining-brain~~ ✅ PR #1 open
2. ~~Phase 0.3 — `infra/` Terraform~~ ✅ validate green; apply deferred by Tyler (dev-env first)
3. ~~Phase 0.4 — Next.js scaffold + CI~~ ✅
4. ~~Phase 1 — read-only site depth~~ ✅
5. ~~Phase 2 slice A — retrieval + /api/search~~ ✅
6. ~~Phase 2 slice B — ask pipeline (LLM, quotas, cache, breaker, permalinks, chat UI)~~ ✅
7. ~~Phase 2 slice C — identity (GitHub/Google/Authentik OIDC + Nostr NIP-07, signed sessions, 25/day tier, Turnstile skip)~~ ✅ code+dev-verified; OAuth buttons light up when Tyler provisions credentials
8. ~~Phase 3 — agent surface (MCP streamable HTTP, SKILL.md, llms.txt, README quickstarts, permalink OG)~~ ✅
9. ~~Phase 4 — gaps board from query log (`/api/gaps.json` + /gaps client fetch), weekly gap-report automation wiring, POD256 integration~~ ✅ code+dev-verified; weekly issue filing needs CROSS_REPO_TOKEN secret
10. Launch checklist — ~~privacy page~~ ✅ · ~~CloudWatch alarms + budget alarm~~ ✅ (built in Phase 0, observability.tf) · load-test quota paths + suggestion-form abuse review + DNS/cert (all need Tyler's AWS dev-env pass)

## Decisions / deviations

| Decision | Reason |
|---|---|
| MIT license + content provenance note | public-mining-brain carries no LICENSE file; mission says match it, else MIT+note |
| Single Lambda app (Hono) serving `/api/*` + `/mcp` instead of per-route Lambdas | Cost/simplicity at v1 traffic; split later only if cold-start or error isolation demands it |
| Pure-JS BM25 planned for retrieval instead of SQLite FTS5 | No native deps in Lambda; `node:sqlite` absent on local Node 20; same `retrieve(q)` interface — embeddings stay a later drop-in (plan §3 allows) |
| `/a/<id>` permalinks will render from the Lambda (HTML template), not Next SSR | Static export can't SSR; Lambda behind CloudFront renders permalink HTML w/ OG tags — same URL space |
| Wiki-body renderer escapes lone `~` and digit`*`digit before marked | GFM strikethrough/emphasis was mangling verbatim spec values (`20~50 ℃`, `339*173*207 mm`) — grounding fidelity beats markdown cleverness |
| Knowledge pack bundled into the Lambda at build (esbuild JSON import) instead of S3 fetch at cold start | 772KB zip w/ full 127-page pack — no SDK round-trip, no S3 dependency for retrieval; 10× size still fits Lambda limits |
| `Store` interface w/ DynamoDB + in-memory impls; memory chosen when `QUOTAS_TABLE`/`AWS_REGION` unset | Tyler explicitly defers AWS until a dev-environment pass — the whole ask pipeline must be testable locally with zero AWS; prod flips to Dynamo by env alone |
| Ask pipeline order: cache → breaker → retrieve → (gap? free answer) → quota → LLM | Retrieval is free CPU; gaps must not burn quota or tokens (they're the product's honest "don't know" + gap log). Cache hits are always free (plan §3) |
| Ask retrieval uses `minScore: 1.0`; search uses 0 | One-common-word matches (score <1) would send the LLM context that can't ground an answer — asking must retrieve or admit a gap; browsing search stays permissive |
| AskConsole uses an uncontrolled textarea (DOM value read on submit) | Works for keyboard, paste, prefill, and agent form-drivers identically; controlled React state silently dropped programmatic input |
| Mock LLM (`scripts/mock-llm.mjs`, OpenAI-shaped) for local dev | Tyler tests the full pipeline with zero keys/spend before the OpenRouter key exists |
| (more recorded as made) | |

## Blockers / Needs Tyler

| # | What | Exact names | Status |
|---|---|---|---|
| 1 | **AWS dev environment + credentials** — Tyler: "i havent done anything on aws yet for deployment, and i wont until i get to test it out in a dev environment. so when you are ready (no rush), lets do that" | `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` in env, or `~/.aws` profile | Open by design — terraform validate green; `make plan` + `APPLY=1` wait for Tyler's dev-env pass. All app code runs locally without AWS (in-memory store fallback) |
| 2 | OpenRouter dedicated key | `OPENROUTER_API_KEY` (or `LLM_API_KEY`) | Provision before real ask answers; dev meanwhile uses `scripts/mock-llm.mjs` |
| 3 | Cloudflare Turnstile | `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET` (site+secret pair) | Provision for Phase 2 — until then ask runs with verification skipped (dev bypass, flagged in response) |
| 4 | Authentik OIDC client | `AUTHENTIK_CLIENT_ID/SECRET`, `AUTHENTIK_ISSUER_URL`, team group claim (plan §9.3) | Provision for Phase 2 slice C |
| 5 | GitHub OAuth app + Google OAuth client | `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | Provision for Phase 2 slice C |
| 6 | GitHub token (issue filing) | `CROSS_REPO_TOKEN` repo secret on 256-wiki (PAT with issues:write on public-mining-brain) | Needed for the weekly `content-gap-report` workflow (in repo, cron Mondays) |
| 7 | public-mining-brain PR #1 review/merge | https://github.com/256foundation/public-mining-brain/pull/1 | Blocks pack-release flow (site build falls back to a vendored pack meanwhile) |

Infra agent handoff (apply steps, DNS row, secrets list, alarm destination) — final copy in the section below before launch.

## Infra-agent handoff (draft → finalize at launch)

_(pending Phase 0.3 — module written, needs first `make plan` with credentials)_

## PR log

| Repo | PR | Status |
|---|---|---|
| public-mining-brain | [#1 — knowledge pack builder + release CI + gap-report template](https://github.com/256foundation/public-mining-brain/pull/1) | open, awaiting review |
