# Infrastructure (Terraform)

Everything that serves MycoTrack to the internet over HTTPS.

```
Browser ──HTTPS──▶ CloudFront ──/*──────▶ S3 bucket (private, via OAC)
                       │   └ viewer-request function: route-like paths → /index.html
                       └─────/api/*─────▶ EC2 :8000 (FastAPI)   (not cached, all headers forwarded)
```

One origin for the SPA and the API means no CORS in production, and a free HTTPS
certificate (`*.cloudfront.net`) without owning a domain — which Auth0 needs.

## What's managed here
| Resource | Purpose |
| --- | --- |
| `aws_cloudfront_distribution.site` | The public HTTPS entry point (two origins, two behaviors) |
| `aws_cloudfront_function.spa_fallback` | Serves `index.html` for client-side routes — on the website behavior only, so real 404s from `/api/*` are untouched |
| `aws_cloudfront_origin_access_control.frontend` | Lets CloudFront read the private bucket |
| `aws_s3_bucket_policy.frontend` | Grants the distribution read access (no public access) |
| `aws_s3_bucket_website_configuration.frontend` | Redirects the legacy S3 website URL to CloudFront |
| `aws_s3_bucket_public_access_block.frontend` | Keeps the bucket private |
| `aws_iam_role_policy.deploy_invalidate` | Lets the GitHub Actions deploy role invalidate the cache |

Not managed here (created by hand earlier, referenced as data sources): the frontend S3
bucket, the EC2 instance and its Elastic IP (tag `Name=mycotrack-api`), the RDS database,
and the GitHub OIDC provider + deploy role. Importing them is future work.

## Usage
```bash
export AWS_PROFILE=mycotrack     # `aws login --profile mycotrack` first
cd infra
terraform init
terraform plan
terraform apply
```
State is stored in the private, versioned S3 bucket `mycotrack-tfstate-618303856015`
(locking via `use_lockfile`). That bucket was created once by hand:
versioning on, default encryption, all public access blocked.

## After applying
- Set the `CLOUDFRONT_DISTRIBUTION_ID` repository variable to the `distribution_id` output
  (the deploy workflow then invalidates `/index.html` after every upload).
- Build the frontend with `VITE_API_BASE_URL=/api` so API calls go to the same origin.
- Add `<url>/callback`, `<url>` to the Auth0 application's callback / logout / web-origin URLs.

## The bucket is private; the old S3 link redirects
The frontend bucket used to be public, and its website URL
(`http://mycotrack-frontend-prod-2026.s3-website.eu-north-1.amazonaws.com`) was shared in job
applications. That URL was HTTP-only, so Auth0 login could never work on it.

Now:
- **The bucket is private.** Only the CloudFront distribution can read it (origin access
  control), and S3 Block Public Access is on. Reaching an object directly returns 403.
- **The old URL still works** and redirects (301) to the HTTPS CloudFront site, keeping the
  path: `.../login` → `https://<cloudfront-domain>/login`. This uses S3's redirect-only
  website configuration, which serves no objects, so it needs no public access.
- The legacy public-read bucket policy can be brought back with `keep_public_website = true`
  (the redirect would still take precedence).

## Known gaps
- CloudFront → EC2 is plain HTTP over the internet. Next steps: restrict the instance's
  security group to CloudFront's managed prefix list and add a secret origin header.
- No custom domain yet (uses the default `*.cloudfront.net` certificate).
