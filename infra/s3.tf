# One bucket, three prefixes — site/, pack/, api/. Fewer buckets to babysit; the
# CloudFront behaviors give each prefix its own caching posture. Public access
# stays fully blocked; CloudFront reads via OAC only.

resource "aws_s3_bucket" "static" {
  bucket = "256-wiki-${data.aws_caller_identity.current.account_id}-static"

  tags = { Component = "storage" }
}

data "aws_caller_identity" "current" {}

data "aws_canonical_user_id" "current" {}

resource "aws_s3_bucket_public_access_block" "static" {
  bucket = aws_s3_bucket.static.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_ownership_controls" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "static" {
  bucket = aws_s3_bucket.static.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# The site is fully rebuildable from git + the pack release — versioning would
# only double storage. Pack copies live as GitHub releases too.
resource "aws_s3_bucket_versioning" "static" {
  bucket = aws_s3_bucket.static.id

  versioning_configuration {
    status = "Disabled"
  }
}

# CloudFront origin access control — the only read path.
resource "aws_cloudfront_origin_access_control" "static" {
  name                              = "256-wiki-s3-oac"
  description                       = "256-wiki static site + pack + read-only API JSONs"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_s3_bucket_policy" "static" {
  bucket = aws_s3_bucket.static.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "CloudFrontRead"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.static.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${aws_cloudfront_distribution.site.id}"
          }
        }
      },
    ]
  })
}
