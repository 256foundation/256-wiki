#!/usr/bin/env node
/**
 * Build the Lambda bundle: server/handler.ts + the knowledge pack →
 * build/lambda.zip (CJS, nodejs22.x arm64, zero native deps).
 * `make package` in infra/ runs this before every plan/apply so the deployed
 * artifact always matches the source tree.
 */
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "build");

mkdirSync(OUT, { recursive: true });

await build({
  entryPoints: [path.join(ROOT, "server", "handler.ts")],
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  outfile: path.join(OUT, "handler.js"),
  sourcemap: false,
  minify: false,
  legalComments: "none",
  logLevel: "info",
});

// one lambda zip: handler.js (+ everything esbuild bundled in)
const zip = path.join(OUT, "lambda.zip");
if (existsSync(zip)) rmSync(zip);
execFileSync("zip", ["-q", "-9", "lambda.zip", "handler.js"], { cwd: OUT });
console.log(`build/lambda.zip ready (${(existsSync(zip) ? "exists" : "?")})`);
