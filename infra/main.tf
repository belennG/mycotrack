# Existing resources this stack builds on (created earlier by hand, see issues #63-#66).
data "aws_s3_bucket" "frontend" {
  bucket = var.frontend_bucket_name
}

data "aws_eip" "api" {
  tags = {
    Name = var.api_eip_name
  }
}

# AWS-managed cache / origin-request policies, looked up by name.
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

# CloudFront signs its requests to S3 (OAC) so the bucket can stay private.
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "mycotrack-frontend"
  description                       = "CloudFront access to the MycoTrack frontend bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# SPA fallback for the website only: route-like paths (no file extension) get index.html.
# This is deliberately a viewer-request function on the default behavior rather than a
# distribution-wide custom error response, which would also rewrite real 404s from /api/*.
resource "aws_cloudfront_function" "spa_fallback" {
  name    = "mycotrack-spa-fallback"
  runtime = "cloudfront-js-2.0"
  comment = "Serve index.html for client-side routes"
  publish = true
  code    = <<-JS
    function handler(event) {
      var request = event.request;
      if (request.uri.indexOf('.') === -1) {
        request.uri = '/index.html';
      }
      return request;
    }
  JS
}

resource "aws_cloudfront_distribution" "site" {
  comment             = "MycoTrack: SPA (S3) + API (EC2) behind one HTTPS origin"
  enabled             = true
  is_ipv6_enabled     = true
  http_version        = "http2and3"
  default_root_object = "index.html"
  price_class         = "PriceClass_100" # North America + Europe edge locations only

  origin {
    origin_id                = "s3-frontend"
    domain_name              = data.aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  # CloudFront -> EC2 is plain HTTP on the API port (the instance has no certificate);
  # viewers only ever talk HTTPS to CloudFront.
  origin {
    origin_id   = "api"
    domain_name = data.aws_eip.api.public_dns

    custom_origin_config {
      http_port              = var.api_port
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    target_origin_id       = "s3-frontend"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.spa_fallback.arn
    }
  }

  # /api/* is never cached, and every viewer header (incl. Authorization) reaches FastAPI.
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "api"
    viewer_protocol_policy   = "https-only"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    compress                 = true
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # The default *.cloudfront.net certificate. Swap for an ACM certificate when a custom
  # domain is added.
  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Bucket policy: allow this distribution to read objects. The legacy public-read statement
# stays until `keep_public_website = false` so the old S3 website URL keeps working while the
# CloudFront URL is verified.
resource "aws_s3_bucket_policy" "frontend" {
  bucket = data.aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      var.keep_public_website ? [{
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${data.aws_s3_bucket.frontend.arn}/*"
      }] : [],
      [{
        Sid       = "AllowCloudFrontServicePrincipal"
        Effect    = "Allow"
        Principal = { Service = "cloudfront.amazonaws.com" }
        Action    = "s3:GetObject"
        Resource  = "${data.aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = { "AWS:SourceArn" = aws_cloudfront_distribution.site.arn }
        }
      }]
    )
  })
}

# Let the GitHub Actions deploy role invalidate this distribution after uploading a build.
# (The role itself and its S3 permissions already exist; this only attaches one more policy.)
resource "aws_iam_role_policy" "deploy_invalidate" {
  name = "cloudfront-invalidate"
  role = var.deploy_role_name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "cloudfront:CreateInvalidation"
      Resource = aws_cloudfront_distribution.site.arn
    }]
  })
}
