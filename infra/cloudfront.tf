# CloudFront: every read path is edge-cached; the Lambda only sees writes and
# dynamic GETs. Routing:
#   default                  → S3 (site/, trailing-slash rewrite via CF function)
#   /api/index.json, /api/pages/*, /api/feed.xml → S3 (prebuilt)
#   /api/search*, /api/ask, /api/suggest, /mcp, /a/* → Lambda
# Pack for site builds is pulled from GitHub releases at CI time; S3 pack/ is
# the runtime copy the Lambda retrieves from.

locals {
  s3_domain       = aws_s3_bucket.static.bucket_regional_domain_name
  lambda_url_host = replace(replace(aws_lambda_function_url.api.function_url, "https://", ""), "/$", "")

  # Managed CloudFront policy IDs — stable constants from AWS docs.
  managed_caching_optimized              = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
  managed_caching_optimized_uncompressed = "b2884449-e4de-46a7-ac36-70bc7f1ddd6d" # Managed-CachingOptimizedForUncompressedObjects
  managed_caching_disabled               = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # Managed-CachingDisabled
  managed_cors_response_policy           = "eaab4381-ed33-4a86-88ca-d9558dc6cd63" # Managed-CORS-with-preflight-and-SecurityHeadersPolicy
}

# URI rewrite for the static export (directory-style URLs → index.html) and
# /SKILL.md + /llms.txt content types.
resource "aws_cloudfront_function" "url_rewrite" {
  name    = "256-wiki-url-rewrite"
  runtime = "cloudfront-js-2.0"
  comment = "rewrite pretty URLs to index.html; default doc for pack/api prefixes"
  publish = true

  code = <<-EOT
    function handler(event) {
      var request = event.request;
      var uri = request.uri;
      if (uri.endsWith('/')) { uri += 'index.html'; }
      else if (!uri.includes('.')) { request.uri = uri + '/index.html'; }
      request.uri = uri;
      return request;
    }
  EOT
}

resource "aws_cloudfront_cache_policy" "dynamic_query" {
  name        = "256-wiki-dynamic-query"
  comment     = "honors origin Cache-Control; caches per query string (search/live)"
  min_ttl     = 1
  default_ttl = 60
  max_ttl     = 300

  parameters_in_cache_key_and_forwarded_to_origin {
    cookies_config {
      cookie_behavior = "none"
    }
    headers_config {
      header_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
    enable_accept_encoding_gzip   = true
    enable_accept_encoding_brotli = true
  }
}

resource "aws_cloudfront_origin_request_policy" "lambda_post" {
  name    = "256-wiki-lambda-post"
  comment = "forward everything the ask/suggest/mcp handlers need"
  cookies_config {
    cookie_behavior = "all" # session cookie for signed-in quota tier
  }
  headers_config {
    header_behavior = "whitelist"
    headers {
      items = ["origin", "content-type", "authorization", "accept"]
    }
  }
  query_strings_config {
    query_string_behavior = "all"
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled         = true
  comment         = "256-wiki — wiki.256foundation.org"
  is_ipv6_enabled = true
  price_class     = "PriceClass_100" # NA+EU only — cost guard; widen only if traffic demands

  origin {
    domain_name              = local.s3_domain
    origin_id                = "s3-static"
    origin_access_control_id = aws_cloudfront_origin_access_control.static.id
  }

  origin {
    domain_name = local.lambda_url_host
    origin_id   = "lambda-api"
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # ── Lambda-backed routes (order matters: most specific first) ──
  ordered_cache_behavior {
    path_pattern               = "/mcp*"
    target_origin_id           = "lambda-api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "POST", "OPTIONS", "PUT", "DELETE", "PATCH"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.dynamic_query.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.lambda_post.id
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern           = "/api/ask"
    target_origin_id       = "lambda-api"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "POST", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    # ask is POST-only and never cached; policy still needed for the route
    cache_policy_id            = local.managed_caching_disabled
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.lambda_post.id
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern               = "/api/suggest"
    target_origin_id           = "lambda-api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "POST", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.managed_caching_disabled
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.lambda_post.id
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern               = "/api/search*"
    target_origin_id           = "lambda-api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = aws_cloudfront_cache_policy.dynamic_query.id
    origin_request_policy_id   = aws_cloudfront_origin_request_policy.lambda_post.id
    response_headers_policy_id = local.managed_cors_response_policy
  }

  # answer permalinks — SSR'd by the Lambda, long-cached, OG-tagged
  ordered_cache_behavior {
    path_pattern             = "/a/*"
    target_origin_id         = "lambda-api"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.dynamic_query.id
    origin_request_policy_id = aws_cloudfront_origin_request_policy.lambda_post.id
  }

  # ── static, prebuilt read-only API JSONs (S3, CDN-cacheable, CORS open) ──
  ordered_cache_behavior {
    path_pattern               = "/api/index.json"
    target_origin_id           = "s3-static"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.managed_caching_optimized
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern               = "/api/pages/*"
    target_origin_id           = "s3-static"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.managed_caching_optimized
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern               = "/api/feed.xml"
    target_origin_id           = "s3-static"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.managed_caching_optimized
    response_headers_policy_id = local.managed_cors_response_policy
  }

  ordered_cache_behavior {
    path_pattern               = "/api/gaps.json"
    target_origin_id           = "lambda-api"
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD", "OPTIONS"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = local.managed_caching_optimized
    response_headers_policy_id = local.managed_cors_response_policy
  }

  default_cache_behavior {
    target_origin_id       = "s3-static"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = local.managed_caching_optimized
    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.url_rewrite.arn
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = local.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  aliases = [var.site_domain]

  custom_error_response {
    error_code         = 403 # S3 REST origins 403 on missing keys
    response_code      = 404
    response_page_path = "/404.html"
  }
  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  tags = { Component = "edge" }
}
