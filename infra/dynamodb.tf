# The org's first DynamoDB tables — all on-demand billing (spiky, tiny traffic).
# TTL attributes keep every table effectively empty at rest.

resource "aws_dynamodb_table" "quotas" {
  name         = "256-wiki-quotas"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "day"

  attribute {
    name = "pk" # anon#<iphash> | user#<subjhash> — hashes only, never raw identity
    type = "S"
  }
  attribute {
    name = "day"
    type = "S" # YYYY-MM-DD (UTC)
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  tags = { Component = "data" }
}

resource "aws_dynamodb_table" "answers_cache" {
  name         = "256-wiki-answers-cache"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "qhash"

  attribute {
    name = "qhash"
    type = "S" # normalized question hash — the dedupe key
  }

  # Permalinks (/a/<id>) are content, not ephemera → point-in-time recovery.
  # TTL (answers_cache_ttl_days) bounds storage; PITR covers the permalink corpus.
  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }

  point_in_time_recovery {
    enabled = true
  }

  tags = { Component = "data" }
}

resource "aws_dynamodb_table" "query_log" {
  name         = "256-wiki-query-log"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
  }

  tags = { Component = "data" }
}
