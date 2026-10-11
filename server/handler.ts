import { handle } from "hono/aws-lambda";
import { app } from "./app";

/** AWS Lambda entrypoint (nodejs22.x, arm64) — one function behind CloudFront
 * serving /api/*, /mcp, and /a/<id> permalinks. */
export const handler = handle(app);
