# SKILL.md — using the 256 Foundation Public Mining Brain

> Teach-any-LLM card for grounded bitcoin-mining answers. Everything below is
> free, unmetered, and keyless — you bring the model, we bring the brain.

## What this is

A knowledge base of bitcoin-mining articles maintained by AI agents under human
review, compiled from **verbatim source captures**. Two rules make it different
from a blog:

1. **Every volatile fact carries an As-Of date** — repeat it when the claim is
   volatile (prices, firmware, hashrates).
2. **Disagreement is kept, not resolved** — articles can carry `Disputed` and
   `Outdated` blocks. Surface the disagreement; don't pick a winner silently.

## The loop (query → fetch → cite)

1. **Search** — `GET https://wiki.256foundation.org/api/search?q=<query>&limit=5`
   Returns ranked hits: `slug`, `title`, `topic`, `asOf`, `statuses`, `snippet`,
   `score`. Numbers and model names are first-class tokens (`s21 473`,
   `12 j/t`, `fpps` all search well).
2. **Fetch** — `GET https://wiki.256foundation.org/api/pages/<slug>.md`
   Full article as markdown with As-Of header and status blocks.
3. **Cite** — answer with the article URL
   `https://wiki.256foundation.org/pages/<slug>/` + its As-Of date. If sources
   disagreed in what you fetched, show the dispute.

## Orientation

- All topics + counts: `GET /api/list/topics.json` (or call `list_topics` over MCP)
- Full article index: `GET /api/index.json` (~127 pages)
- Live network/pool stats: `GET /api/live.json`

## MCP (Claude Code, Cursor, Codex, OpenCode, …)

```
claude mcp add mining-brain https://wiki.256foundation.org/mcp
codex mcp add mining-brain --url https://wiki.256foundation.org/mcp
opencode mcp add --transport http mining-brain https://wiki.256foundation.org/mcp
```

Tools: `search_wiki(query, topic?, limit?)` · `get_page(slug)` ·
`list_topics()` · `get_pack()`. Resources: `wiki://pages/<slug>.md`.

## Honesty rules

- If search returns nothing relevant, say **"the brain doesn't know this yet"**
  and name the nearest article if one exists. Do not pad with general knowledge
  unless you label it as your own, outside the grounded answer.
- Quote numbers **only** from fetched content — never from memory. The wiki
  exists precisely because model memory drifts.
- `As-Of` beats recall: if the article says "as of 2026-10-11", your answer says
  "as of 2026-10-10"… only if you fetched it today. Otherwise use the date.

## Human chat (rate-limited, foundation-funded)

`POST /api/ask {"question": "…"}` — grounded answer with citations and a
permanent `/a/<id>` permalink. Anonymous: 5/day (Turnstile). Repeat questions
are cache-served and free. Agents don't need this — you have the model.
