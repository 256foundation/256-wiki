# 256-wiki

Public front end for the 256 Foundation's **Public Mining Brain** — an LLM-curated,
source-grounded bitcoin-mining knowledge base maintained in
[`256foundation/public-mining-brain`](https://github.com/256foundation/public-mining-brain).

**Site:** `wiki.256foundation.org`

## Mission

Deliver the brain's curation to two audiences:

1. **Humans** — browse and search free; ask the brain a few questions a day
   (foundation-funded tokens, rate-limited, no accounts).
2. **Agents** — connect via MCP / REST / `SKILL.md` and query with **their own LLM
   tokens**. Retrieval on this path costs the foundation ~$0 (static pack + search
   index + CDN).

Cost-separation principle: **the foundation only pays tokens for the web chat path.**
Everywhere a quota appears, the UI points to the unlimited path: *connect your own
agent and use your own usage*.

The wiki's epistemics are the brand: every claim is **As-Of stamped**, conflicts stay
visible as **Disputed/Outdated blocks**, and every load-bearing fact traces to a raw
capture. This site renders that honesty first-class.

## Architecture

```
public-mining-brain (content repo)          256-wiki (this repo)
─────────────────────────────────          ─────────────────────────────────
wiki/ + raw/ + sources/                    Next.js app (static export)
  │ merge to main                            ├─ SSG pages from knowledge pack
  ▼                                          ├─ /api/*  REST (search, pages, ask, …)
GitHub Actions CI                            ├─ /mcp    MCP server (streamable HTTP)
  ├─ python3 scripts/build_export.py         └─ /SKILL.md, /llms.txt
  ▼                                          │
export/knowledge-pack.json + MANIFEST        │
  ├─ attached to GitHub release              │
  └─ synced to S3 (pack bucket) ─────────────┤ pack fetched at build/deploy
                                             ▼
                  ┌────────────── AWS us-east-1 ──────────────────┐
                  │ S3 + CloudFront: site, pack, search index,    │
                  │   read-only API JSONs                         │
                  │ Lambda (Node): /api/ask · /mcp · /api/suggest │
                  │   · /api/search · /api/live                   │
                  │ DynamoDB (on-demand): quotas · answers-cache  │
                  │   (PITR) · query-log                          │
                  │ CloudWatch alarms + Budgets ($10/mo) → SNS    │
                  └───────────────────────────────────────────────┘
```

- **Content contract:** the knowledge pack (`knowledge-pack.json`) is the only
  interface between the repos. Versioned schema; `contentHash` recorded on every
  page render, answer, and permalink for provenance.
- **Hosting:** static-first. S3 + CloudFront serve every read path; a Node Lambda
  handles `ask` / `mcp` / `suggest` / `search` / `live`. Self-contained Terraform
  module in [`infra/`](infra/).
- **Quotas:** anonymous 5 answers/day/IP (Turnstile-gated) · signed-in 25/day ·
  Authentik team unlimited (config, not code). Cache hits are free. Global daily
  token budget circuit-breaker — when tripped, the chat UI flips to the
  "connect your own agent" pitch.
- **LLM:** OpenRouter dedicated key behind a thin OpenAI-compatible adapter
  (primary `anthropic/claude-haiku-5.5`, budget alt `z-ai/glm-flash-latest` —
  config, not code).
- **Budget:** ~$2–5/mo AWS cash. No EC2 load; no scraping of `dash.256f.org`.

## Repo layout

```
app/         Next.js (App Router, static export)
lib/         shared retrieval / pack / epistemics modules
server/      Node Lambda app (Hono): /api/*, /mcp
infra/       self-contained Terraform module
scripts/     build/fetch utilities
docs/        screenshots, runbooks, design notes
```

## Development quickstart

Requirements: Node 20+, Python not needed here (the pack is built in the
content repo's CI).

```bash
npm install
cp .env.example .env.local    # fill what you have; anonymous browsing needs none
npm run dev                   # site on :3000
```

The site fetches the latest knowledge-pack release from
`public-mining-brain` at build time (cached under `data/pack/`). To use a local
pack build instead:

```bash
# in ../public-mining-brain
python3 scripts/build_export.py
# then point WIKI_PACK_URL at file://../public-mining-brain/export/knowledge-pack.json
# (or copy it into data/pack/knowledge-pack.json)
```

API server for local development of ask/MCP paths:

```bash
npm run dev:api               # Hono on :8787, proxied from next dev
```

Verify everything:

```bash
npm run lint && npm test && npm run build
```

## Infrastructure

`infra/` is a self-contained Terraform module following the 256-infra
`APPLY=1` discipline:

```bash
cd infra && make plan    # default: plan only
cd infra && make apply   # explicit apply (infra agent only)
```

## Contributing to the *content*

This repo is only the front end. Content lives in
[`public-mining-brain`](https://github.com/256foundation/public-mining-brain) —
see its [CONTRIBUTING.md](https://github.com/256foundation/public-mining-brain/blob/main/CONTRIBUTING.md).
The `/contribute` page on the site mirrors that flow.

## License

MIT — see [LICENSE](LICENSE). Knowledge content is served from
`public-mining-brain` with full source provenance.
