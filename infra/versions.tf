terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # State: kept local until the org adopts remote state; the infra agent may
  # move this to the 256-infra state convention without code changes.
  backend "local" {}
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      ManagedBy = "256-wiki" # scoped by the AWS Budgets alarm
      Service   = "256-wiki"
      Component = var.component_tag
    }
  }
}
