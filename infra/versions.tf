terraform {
  required_version = ">= 1.10"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.0"
    }
  }

  # State lives in a private, versioned S3 bucket (created once by hand — see README).
  # `use_lockfile` gives state locking without a DynamoDB table.
  backend "s3" {
    bucket       = "mycotrack-tfstate-618303856015"
    key          = "frontend/terraform.tfstate"
    region       = "eu-north-1"
    encrypt      = true
    use_lockfile = true
  }
}

# Credentials come from the environment (e.g. AWS_PROFILE=mycotrack) — nothing is hardcoded.
provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "mycotrack"
      ManagedBy = "terraform"
    }
  }
}
