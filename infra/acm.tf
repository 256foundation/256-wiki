# TLS: CloudFront requires the ACM cert in us-east-1 — the org's first.
# If `acm_certificate_arn` is provided (cert managed elsewhere) the cert
# resource is skipped. Otherwise we create it and export the exact validation
# CNAME for the 256-infra DNS row (this module never edits Route53).

locals {
  acm_certificate_arn = var.acm_certificate_arn != "" ? var.acm_certificate_arn : aws_acm_certificate.site[0].arn
}

resource "aws_acm_certificate" "site" {
  count = var.acm_certificate_arn == "" ? 1 : 0

  domain_name       = var.site_domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Component = "edge" }
}

resource "aws_acm_certificate_validation" "site" {
  count = var.acm_certificate_arn == "" ? 1 : 0

  certificate_arn = aws_acm_certificate.site[0].arn
  # Validation records are added manually in 256-infra (vars/dns_zones.yml) —
  # this module never touches DNS. Validate with:
  #   terraform apply -target=aws_acm_certificate.site   (then add the CNAME,
  #   then the full apply)
  # See `terraform output -raw acm_validation_records` for the exact row.
}
