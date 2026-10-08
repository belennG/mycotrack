output "distribution_id" {
  description = "Set as the CLOUDFRONT_DISTRIBUTION_ID repository variable (used by the deploy workflow)."
  value       = aws_cloudfront_distribution.site.id
}

output "url" {
  description = "Public HTTPS address of the site and API."
  value       = "https://${aws_cloudfront_distribution.site.domain_name}"
}

output "api_origin" {
  description = "EC2 public DNS name CloudFront forwards /api/* to."
  value       = data.aws_eip.api.public_dns
}
