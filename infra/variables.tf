variable "region" {
  description = "Region of the existing resources (S3 bucket, EC2 instance)."
  type        = string
  default     = "eu-north-1"
}

variable "frontend_bucket_name" {
  description = "Existing S3 bucket that holds the built SPA."
  type        = string
  default     = "mycotrack-frontend-prod-2026"
}

variable "api_eip_name" {
  description = "Name tag of the Elastic IP attached to the API's EC2 instance. Its public DNS name is used as the CloudFront origin."
  type        = string
  default     = "mycotrack-api"
}

variable "api_port" {
  description = "Port the FastAPI app listens on."
  type        = number
  default     = 8000
}

variable "deploy_role_name" {
  description = "Existing IAM role assumed by GitHub Actions to deploy the frontend."
  type        = string
  default     = "mycotrack-frontend-deploy"
}

variable "keep_public_website" {
  description = "Keep the legacy public-read bucket policy (and with it the old S3 website URL). Set to false once CloudFront is verified to make the bucket private."
  type        = bool
  default     = true
}
