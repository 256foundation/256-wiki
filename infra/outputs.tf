output "distribution_domain" {
  description = "CloudFront domain — site works here before DNS cutover."
  value       = aws_cloudfront_distribution.site.domain_name
}

output "dns_row" {
  description = "Exact row for 256-infra vars/dns_zones.yml (human-readable)."
  value       = "wiki.256foundation.org  300  IN  ALIAS  ${aws_cloudfront_distribution.site.domain_name}. (zone apex style) — or CNAME ${aws_cloudfront_distribution.site.domain_name}"
}

output "distribution_id" {
  value = aws_cloudfront_distribution.site.id
}

output "acm_validation_records" {
  description = "CNAME(s) to add in 256-infra DNS so the new ACM cert validates (empty if acm_certificate_arn was provided)."
  value = var.acm_certificate_arn == "" ? [
    for dvo in aws_acm_certificate.site[0].domain_validation_options :
    "${dvo.resource_record_name} ${dvo.resource_record_type} ${dvo.resource_record_value}"
  ] : []
}

output "static_bucket" {
  value = aws_s3_bucket.static.bucket
}

output "lambda_function_url" {
  value = aws_lambda_function_url.api.function_url
}

output "lambda_function_name" {
  value = aws_lambda_function.api.function_name
}

output "table_names" {
  value = {
    quotas        = aws_dynamodb_table.quotas.name
    answers_cache = aws_dynamodb_table.answers_cache.name
    query_log     = aws_dynamodb_table.query_log.name
  }
}

output "alarms_topic_arn" {
  value = aws_sns_topic.alarms.arn
}

output "acm_certificate_arn" {
  value = local.acm_certificate_arn
}
