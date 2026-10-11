# 256-wiki infrastructure — self-contained Terraform module
#
# The org's first static+serverless service (infra audit 2026-10-11): S3 + CloudFront
# for all read paths, one Node Lambda for ask/mcp/suggest/search, DynamoDB on-demand
# for quotas / answers-cache / query-log. No EC2 load; the `apps` box is untouched.
#
# Discipline mirrors 256-infra: `make plan` is the default (dry-run culture);
# `APPLY=1 make apply` is the explicit apply. The infra agent owns applies.
#
# DNS stays in 256-infra (`vars/dns_zones.yml`): this module never touches Route53
# zones. If `acm_certificate_arn` is left empty the module creates the ACM cert and
# prints the exact validation CNAME to add there (see `make dns-row` / outputs).

SHELL := /bin/bash
TF    := terraform

.PHONY: help plan apply package validate fmt dns-row init

.DEFAULT_GOAL := help

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

init: ## terraform init (idempotent)
	$(TF) init -input=false

package: ## build the Lambda zip from the app tree (npm run build:lambda)
	cd .. && npm ci && npm run build:lambda

plan: init package ## default: build zip + terraform plan (no changes applied)
	$(TF) plan -input=false -out=tfplan
	@echo "— plan written to tfplan; review it, then: APPLY=1 make apply"

apply: init package ## explicit apply; guarded by APPLY=1 (256-infra discipline)
	@test "$(APPLY)" = "1" || { echo "refusing to apply: run 'APPLY=1 make apply' (plan first: make plan)"; exit 1; }
	$(TF) apply -input=false tfplan

validate: init ## fmt check + validate (CI-safe, no AWS creds needed)
	$(TF) fmt -check -recursive
	$(TF) validate

fmt: ## rewrite terraform files
	$(TF) fmt -recursive

dns-row: ## print the exact DNS row for 256-infra vars/dns_zones.yml
	@$(TF) output -no-color dns_row 2>/dev/null || echo "(run 'make plan' first — the row needs the distribution id)"
