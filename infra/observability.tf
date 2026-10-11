# The org's first CloudWatch alarms + first AWS Budgets alarm — per plan §9.6:
# wired to SNS → Slack webhook into #256-infrastructure (subscription email/HTTP
# endpoint provided by the infra agent; `alarm_email` seeds the email leg).

resource "aws_sns_topic" "alarms" {
  name = "256-wiki-alarms"

  tags = { Component = "observability" }
}

data "aws_iam_policy_document" "alarms_topic" {
  statement {
    sid       = "AllowCloudWatchAlarms"
    effect    = "Allow"
    actions   = ["SNS:Publish"]
    resources = [aws_sns_topic.alarms.arn]
    principals {
      type        = "Service"
      identifiers = ["cloudwatch.amazonaws.com"]
    }
  }

  statement {
    sid       = "AllowBudgets"
    effect    = "Allow"
    resources = [aws_sns_topic.alarms.arn]
    principals {
      type        = "Service"
      identifiers = ["budgets.amazonaws.com"]
    }
    actions = ["SNS:Publish"]
  }
}

resource "aws_sns_topic_policy" "alarms" {
  arn    = aws_sns_topic.alarms.arn
  policy = data.aws_iam_policy_document.alarms_topic.json
}

resource "aws_sns_topic_subscription" "email" {
  count = var.alarm_email != "" ? 1 : 0

  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email # infra agent confirms the subscription
}

# ── Lambda ───────────────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "256-wiki-lambda-errors"
  alarm_description   = "256-wiki API Lambda errors above ${var.lambda_error_threshold} in 15m"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 3
  threshold           = var.lambda_error_threshold
  treat_missing_data  = "notBreaching"

  metric_name = "Errors"
  namespace   = "AWS/Lambda"
  period      = 300
  statistic   = "Sum"
  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]
  ok_actions    = [aws_sns_topic.alarms.arn]

  tags = { Component = "observability" }
}

resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "256-wiki-lambda-throttles"
  alarm_description   = "256-wiki API Lambda throttled — reserved concurrency (${var.lambda_reserved_concurrency}) saturated"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"

  metric_name = "Throttles"
  namespace   = "AWS/Lambda"
  period      = 300
  statistic   = "Sum"
  dimensions = {
    FunctionName = aws_lambda_function.api.function_name
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = { Component = "observability" }
}

# ── Edge (API 5xx) ───────────────────────────────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "cloudfront_5xx" {
  alarm_name          = "256-wiki-cloudfront-5xx-rate"
  alarm_description   = "256-wiki 5xx error rate ≥ 5% over 15m (origin or Lambda unhealthy)"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = 5
  treat_missing_data  = "notBreaching"

  metric_name = "5xxErrorRate"
  namespace   = "AWS/CloudFront"
  period      = 300
  statistic   = "Average"
  dimensions = {
    DistributionId = aws_cloudfront_distribution.site.id
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = { Component = "observability" }
}

# ── DynamoDB throttles (quota/cache paths) ───────────────────────────────────

resource "aws_cloudwatch_metric_alarm" "dynamodb_throttles" {
  for_each = {
    quotas        = aws_dynamodb_table.quotas.name
    answers_cache = aws_dynamodb_table.answers_cache.name
    query_log     = aws_dynamodb_table.query_log.name
  }

  alarm_name          = "256-wiki-dynamodb-throttles-${each.key}"
  alarm_description   = "256-wiki DynamoDB throttled requests on ${each.value} — on-demand should never throttle; investigate access pattern"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  threshold           = 1
  treat_missing_data  = "notBreaching"

  metric_name = "ThrottledRequests"
  namespace   = "AWS/DynamoDB"
  period      = 300
  statistic   = "Sum"
  dimensions = {
    TableName = each.value
  }

  alarm_actions = [aws_sns_topic.alarms.arn]

  tags = { Component = "observability" }
}

# ── The org's first budget alarm (plan §3, §10) ──────────────────────────────

resource "aws_budgets_budget" "monthly" {
  name              = "256-wiki-monthly"
  budget_type       = "COST"
  limit_amount      = tostring(var.budget_monthly_usd)
  limit_unit        = "USD"
  time_period_start = "2026-11-01_00:00"
  time_unit         = "MONTHLY"

  # Cost isolation: only this service's tagged resources count.
  cost_filter {
    name   = "TagKeyValue" # tag-key/value filter, format "Key$Value"
    values = ["ManagedBy$256-wiki"]
  }

  dynamic "notification" {
    for_each = var.alarm_email != "" ? [1] : []
    content {
      comparison_operator        = "GREATER_THAN"
      threshold                  = 80
      threshold_type             = "PERCENTAGE"
      notification_type          = "ACTUAL"
      subscriber_email_addresses = [var.alarm_email]
    }
  }

  notification {
    comparison_operator       = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscription_type         = "SNS"
    subscriber_sns_topic_arns = [aws_sns_topic.alarms.arn]
  }

  tags = { Component = "observability" }
}
