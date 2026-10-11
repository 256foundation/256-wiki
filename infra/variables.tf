variable "aws_region" {
  description = "Everything is pinned to us-east-1 (CloudFront + Lambda@edge-free design, org estate)."
  type        = string
  default     = "us-east-1"
}

variable "site_domain" {
  description = "CloudFront alternate domain (CNAME target). DNS itself lives in 256-infra."
  type        = string
  default     = "wiki.256foundation.org"
}

variable "component_tag" {
  description = "Extra tag for cost isolation inside the service (e.g. site / api)."
  type        = string
  default     = "core"
}

variable "acm_certificate_arn" {
  description = "Existing ACM cert (us-east-1) for the site domain. Leave empty to have the module create one; then add the printed validation CNAME to 256-infra DNS."
  type        = string
  default     = ""
}

variable "lambda_zip_path" {
  description = "Path to the built Lambda bundle (created by `make package` → npm run build:lambda)."
  type        = string
  default     = "../build/lambda.zip"
}

variable "lambda_runtime" {
  type    = string
  default = "nodejs22.x"
}

variable "lambda_memory_mb" {
  type    = number
  default = 512
}

variable "lambda_reserved_concurrency" {
  description = "Cap on concurrent executions — doubles as a runaway-cost guard for the token budget."
  type        = number
  default     = 10
}

variable "lambda_timeout_seconds" {
  description = "ask/MCP LLM calls can take ~20-30s."
  type        = number
  default     = 30
}

# ── DynamoDB ─────────────────────────────────────────────────────────────────

variable "answers_cache_ttl_days" {
  description = "answers-cache rows double as permalink content (PITR on); 90d keeps permalinks stable while bounding storage."
  type        = number
  default     = 90
}

variable "query_log_ttl_days" {
  description = "Raw query log retention before the weekly gap report has extracted what it needs."
  type        = number
  default     = 180
}

variable "quotas_ttl_days" {
  description = "Daily quota counters are tiny; 30d TTL keeps the table effectively empty."
  type        = number
  default     = 30
}

# ── Quotas / breaker (mirrored into Lambda env; config, not code) ────────────

variable "anonymous_daily_quota" {
  type    = number
  default = 5
}

variable "signedin_daily_quota" {
  type    = number
  default = 25
}

variable "llm_daily_token_budget" {
  description = "Global daily token cap across chat paths — the circuit breaker trips the UI to 'connect your own agent'."
  type        = number
  default     = 3000000
}

# ── Secrets (vault → tfvars at deploy; never committed) ───────────────────────

variable "openrouter_api_key" {
  description = "Dedicated OpenRouter key — per-key spend monitoring. Empty in CI/plans."
  type        = string
  default     = ""
  sensitive   = true
}

variable "turnstile_secret" {
  type      = string
  default   = ""
  sensitive = true
}

variable "session_secret" {
  description = "openssl rand -hex 32 — signs the HTTP-only session cookie."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_token" {
  description = "Suggest form → GitHub issue + weekly gap-report filing. repo scope on the content repo."
  type        = string
  default     = ""
  sensitive   = true
}

variable "github_target_repo" {
  type    = string
  default = "256foundation/public-mining-brain"
}

# ── Observability ────────────────────────────────────────────────────────────

variable "alarm_email" {
  description = "Ops email for the SNS alarm subscription (Slack webhook via email-to-Slack or direct). Empty = topic created, no subscription yet."
  type        = string
  default     = ""
}

variable "budget_monthly_usd" {
  description = "Org's first AWS Budgets alarm, tag-scoped to ManagedBy=256-wiki."
  type        = number
  default     = 10
}

variable "lambda_error_threshold" {
  description = "Lambda Errors ≥ this over 3×5min datapoints raises an alarm."
  type        = number
  default     = 5
}
