/** Persistence for quotas / answers-cache / query-log / token budget.
 *
 * Two implementations behind one interface:
 *  - DynamoStore — production (env: QUOTAS_TABLE, ANSWERS_TABLE, QUERYLOG_TABLE,
 *    AWS creds at runtime; on-demand tables, TTL attributes per infra/)
 *  - MemoryStore — local dev & tests (no AWS needed; process-lifetime data).
 *    Chosen automatically when tables aren't configured, so the entire ask
 *    pipeline is testable in a dev environment first — deployment waits for
 *    the human dev-environment pass by design.
 */

import { createHash } from "node:crypto";
import type { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

export interface AnswerRow {
  answerId: string; // <qhash>.<packhash8> — the /a/<id> permalink key
  qhash: string; // normalized-question hash (dedupe key)
  question: string;
  answer: string; // markdown
  citations: Array<{ slug: string; title: string; asOf: string | null; url: string }>;
  model: string;
  packHash: string;
  thread: string | null; // thread root for multi-turn mode
  createdAt: string; // ISO
  expiresAt: number; // epoch seconds (TTL)
}

export interface QueryLogRow {
  id: string;
  qhash: string;
  question: string;
  cached: boolean;
  breakerTripped: boolean;
  topSlugs: string[];
  topScores: number[];
  packHash: string;
  tokensPrompt: number;
  tokensCompletion: number;
  model: string;
  tier: string; // anon | user | team
  createdAt: string;
  expiresAt: number;
}

export interface Store {
  kind: "memory" | "dynamo";
  /** Quota counter for (pk, day). Returns the new count, or null if it would exceed limit. */
  bumpQuota(pk: string, day: string, limit: number): Promise<number | null>;
  peekQuota(pk: string, day: string): Promise<number>;
  getAnswer(qhash: string): Promise<AnswerRow | null>;
  getAnswerById(answerId: string): Promise<AnswerRow | null>;
  putAnswer(row: AnswerRow): Promise<void>;
  logQuery(row: QueryLogRow): Promise<void>;
  /** most recent gap rows (model "none") for the public board — newest first */
  recentGaps(limit: number): Promise<QueryLogRow[]>;
  bumpBudget(day: string, tokens: number, cap: number): Promise<{ total: number; tripped: boolean }>;
  getBudget(day: string): Promise<number>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

export function dayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Normalized-question hash: "What's FPPS?" ≈ "what's fpps?" — the cache key. */
export function qhashOf(question: string): string {
  const norm = question.toLowerCase().replace(/\s+/g, " ").trim();
  return sha256Hex(norm).slice(0, 24);
}

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function ttlFromNow(days: number): number {
  return Math.floor(Date.now() / 1000) + days * 86400;
}

export function selectStore(): Store {
  if (process.env.QUOTAS_TABLE && process.env.AWS_REGION) return dynamoStore();
  return memoryStore();
}

// ── memory impl (dev/tests) ──────────────────────────────────────────────────

export interface MemoryStore extends Store {
  logRows: QueryLogRow[];
}

export function memoryStore(): MemoryStore {
  const quotas = new Map<string, number>();
  const answers = new Map<string, AnswerRow>(); // by qhash
  const answersById = new Map<string, AnswerRow>(); // by answerId
  const logRows: QueryLogRow[] = [];
  const budgets = new Map<string, number>();

  return {
    kind: "memory",
    logRows,
    async bumpQuota(pk, day, limit) {
      const key = `${pk}#${day}`;
      const next = (quotas.get(key) ?? 0) + 1;
      if (next > limit) return null;
      quotas.set(key, next);
      return next;
    },
    async peekQuota(pk, day) {
      return quotas.get(`${pk}#${day}`) ?? 0;
    },
    async getAnswer(qhash) {
      return answers.get(qhash) ?? null;
    },
    async getAnswerById(answerId) {
      return answersById.get(answerId) ?? null;
    },
    async putAnswer(row) {
      answers.set(row.qhash, row);
      answersById.set(row.answerId, row);
    },
    async logQuery(row) {
      logRows.push(row);
      if (logRows.length > 5000) logRows.splice(0, 1000);
    },
    async recentGaps(limit) {
      return logRows
        .filter((r) => r.model === "none" && !r.cached)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async bumpBudget(day, tokens, cap) {
      const total = (budgets.get(day) ?? 0) + tokens;
      budgets.set(day, total);
      return { total, tripped: total >= cap };
    },
    async getBudget(day) {
      return budgets.get(day) ?? 0;
    },
  };
}

// ── Dynamo impl (production) ─────────────────────────────────────────────────

export function dynamoStore(): Store {
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb") as typeof import("@aws-sdk/client-dynamodb");
  const { DynamoDBDocumentClient, UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");

  const doc: DynamoDBDocumentClient = DynamoDBDocumentClient.from(
    new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" }),
  );
  const QUOTAS = process.env.QUOTAS_TABLE ?? "256-wiki-quotas";
  const ANSWERS = process.env.ANSWERS_TABLE ?? "256-wiki-answers-cache";
  const QUERYLOG = process.env.QUERYLOG_TABLE ?? "256-wiki-query-log";
  const ANSWER_TTL_DAYS = Number(process.env.ANSWERS_TTL_DAYS || 90);
  const LOG_TTL_DAYS = Number(process.env.QUERYLOG_TTL_DAYS || 180);
  const QUOTA_TTL_DAYS = Number(process.env.QUOTAS_TTL_DAYS || 30);

  return {
    kind: "dynamo",
    async bumpQuota(pk, day, limit) {
      // conditional increment — atomic; fails (null) when the daily limit is hit
      try {
        const out = await doc.send(
          new UpdateCommand({
            TableName: QUOTAS,
            Key: { pk, day },
            UpdateExpression: "ADD #c :one SET expiresAt = :ttl",
            ConditionExpression: "attribute_not_exists(#c) OR #c < :limit",
            ExpressionAttributeNames: { "#c": "count" },
            ExpressionAttributeValues: { ":one": 1, ":limit": limit, ":ttl": ttlFromNow(QUOTA_TTL_DAYS) },
            ReturnValues: "UPDATED_NEW",
          }),
        );
        return Number((out.Attributes as { count: number } | undefined)?.count ?? 1);
      } catch (err) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") return null;
        throw err;
      }
    },
    async peekQuota(pk, day) {
      const out = await doc.send(GetCommandSafe(QUOTAS, { pk, day }));
      return Number((out?.Item as { count?: number } | undefined)?.count ?? 0);
    },
    async getAnswer(qhash) {
      const out = await doc.send(GetCommandSafe(ANSWERS, { qhash }));
      return (out?.Item as AnswerRow | undefined) ?? null;
    },
    async getAnswerById(answerId) {
      // answers-cache PK is qhash; permalinks need a lookup by answerId —
      // query the qhash prefix stored on the id (answerId = qhash.packhash8)
      const qhash = answerId.split(".")[0];
      const row = await this.getAnswer(qhash);
      return row && row.answerId === answerId ? row : null;
    },
    async putAnswer(row) {
      await doc.send(PutCommandSafe(ANSWERS, { ...row, expiresAt: row.expiresAt || ttlFromNow(ANSWER_TTL_DAYS) }));
    },
    async logQuery(row) {
      await doc.send(
        PutCommandSafe(QUERYLOG, { ...row, expiresAt: row.expiresAt || ttlFromNow(LOG_TTL_DAYS) }),
      );
    },
    async recentGaps(limit) {
      // v1 scale (low ask volume): one filtered Scan, no pagination. If the log
      // outgrows this (~10k+ rows/day), add a model-indexed GSI — noted in infra.
      const out = await doc.send(
        new ScanCommand({
          TableName: QUERYLOG,
          FilterExpression: "#m = :none",
          ExpressionAttributeNames: { "#m": "model" },
          ExpressionAttributeValues: { ":none": "none" },
          Limit: Math.max(limit, 1000),
        }),
      );
      return ((out.Items as QueryLogRow[]) ?? [])
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, limit);
    },
    async bumpBudget(day, tokens, cap) {
      try {
        const out = await doc.send(
          new UpdateCommand({
            TableName: QUOTAS,
            Key: { pk: "budget#global", day },
            UpdateExpression: "ADD #t :tokens SET expiresAt = :ttl",
            ConditionExpression: "attribute_not_exists(#t) OR #t < :cap",
            ExpressionAttributeNames: { "#t": "tokens" },
            ExpressionAttributeValues: {
              ":tokens": tokens,
              ":cap": cap,
              ":ttl": ttlFromNow(2),
            },
            ReturnValues: "ALL_NEW",
          }),
        );
        const total = Number((out?.Attributes as { tokens: number } | undefined)?.tokens ?? tokens);
        return { total, tripped: total >= cap };
      } catch (err) {
        if ((err as { name?: string }).name === "ConditionalCheckFailedException") {
          return { total: cap, tripped: true };
        }
        throw err;
      }
    },
    async getBudget(day) {
      const out = await doc.send(GetCommandSafe(QUOTAS, { pk: "budget#global", day }));
      return Number((out?.Item as { tokens?: number } | undefined)?.tokens ?? 0);
    },
  };
}

// small wrappers so the imports above stay single-line — they only add the TableName field
function GetCommandSafe(table: string, key: Record<string, unknown>) {
  const { GetCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");
  return new GetCommand({ TableName: table, Key: key });
}
function PutCommandSafe(table: string, item: Record<string, unknown>) {
  const { PutCommand } = require("@aws-sdk/lib-dynamodb") as typeof import("@aws-sdk/lib-dynamodb");
  return new PutCommand({ TableName: table, Item: item });
}
