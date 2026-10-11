# Node Lambda app (Hono): /api/ask, /api/suggest, /api/search, /api/live.json,
# /mcp, /a/<id> permalinks. One function keeps warm starts and cost minimal;
# split later only if cold-start or blast radius demands it.
#
# The zip is built by `make package` (npm run build:lambda) — plan/apply always
# rebuilds it so the deployed artifact matches the reviewed code.

resource "aws_lambda_function" "api" {
  function_name = "256-wiki-api"
  role          = aws_iam_role.api.arn
  runtime       = var.lambda_runtime
  handler       = "handler.handler"
  architectures = ["arm64"] # cheaper, and the bundle is pure JS

  filename         = var.lambda_zip_path
  source_code_hash = filesha256(pathexpand(var.lambda_zip_path))

  memory_size = var.lambda_memory_mb
  timeout     = var.lambda_timeout_seconds

  reserved_concurrent_executions = var.lambda_reserved_concurrency

  environment {
    variables = {
      # tables
      QUOTAS_TABLE   = aws_dynamodb_table.quotas.name
      ANSWERS_TABLE  = aws_dynamodb_table.answers_cache.name
      QUERYLOG_TABLE = aws_dynamodb_table.query_log.name
      AWS_REGION     = var.aws_region

      # quotas + breaker (config, not code)
      ANON_DAILY_QUOTA       = tostring(var.anonymous_daily_quota)
      SIGNEDIN_DAILY_QUOTA   = tostring(var.signedin_daily_quota)
      LLM_DAILY_TOKEN_BUDGET = tostring(var.llm_daily_token_budget)

      # LLM adapter (OpenRouter via OpenAI-compatible API)
      LLM_BASE_URL       = "https://openrouter.ai/api/v1"
      LLM_MODEL          = "anthropic/claude-haiku-5.5"
      LLM_FALLBACK_MODEL = "z-ai/glm-flash-latest"
      OPENROUTER_API_KEY = var.openrouter_api_key

      # identity / forms / integrations
      SESSION_SECRET     = var.session_secret
      TURNSTILE_SECRET   = var.turnstile_secret
      GITHUB_TOKEN       = var.github_token
      GITHUB_TARGET_REPO = var.github_target_repo

      # pack location in the static bucket (site build syncs it there)
      PACK_S3_URI = "s3://${aws_s3_bucket.static.bucket}/pack/knowledge-pack.json"
    }
  }

  tags = { Component = "api" }
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/aws/lambda/${aws_lambda_function.api.function_name}"
  retention_in_days = 14 # cost guard — debug window only

  tags = { Component = "api" }
}

resource "aws_iam_role" "api" {
  name = "256-wiki-api"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Component = "api" }
}

resource "aws_iam_role_policy" "api_logs" {
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "${aws_cloudwatch_log_group.api.arn}:*"
    }]
  })
}

resource "aws_iam_role_policy" "api_tables" {
  role = aws_iam_role.api.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "Quotas"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:UpdateItem", "dynamodb:PutItem",
          "dynamodb:Query",
        ]
        Resource = aws_dynamodb_table.quotas.arn
      },
      {
        Sid    = "AnswersCache"
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query", "dynamodb:Scan"
        ]
        Resource = aws_dynamodb_table.answers_cache.arn
      },
      {
        Sid      = "QueryLog"
        Effect   = "Allow"
        Action   = ["dynamodb:PutItem", "dynamodb:Query"]
        Resource = aws_dynamodb_table.query_log.arn
      },
    ]
  })
}

# Function URL (auth NONE) — CloudFront is the public front; CORS is open for
# the agent-facing read endpoints per the plan.
resource "aws_lambda_function_url" "api" {
  function_name      = aws_lambda_function.api.function_name
  authorization_type = "NONE"

  cors {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 86400
  }
}
