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
| `aws_s3_bucket_policy.frontend` | Grants the distribution read access (optionally keeps the legacy public-read) |
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

## Making the bucket private
`keep_public_website` (default `true`) keeps the old public S3 website URL alive. Once the
CloudFront URL is verified: set it to `false` and apply, then disable "Block public access"
exceptions and static website hosting on the bucket.

## Known gaps
- CloudFront → EC2 is plain HTTP over the internet. Next steps: restrict the instance's
  security group to CloudFront's managed prefix list and add a secret origin header.
- No custom domain yet (uses the default `*.cloudfront.net` certificate).
