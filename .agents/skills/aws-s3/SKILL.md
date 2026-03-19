---
name: aws-s3
description: >-
  ☁️ Senior Cloud Infrastructure Architect skill for Amazon S3. Manages buckets,
  objects, lifecycle policies, versioning, replication, access control, and
  pre-signed URLs using the AWS CLI with --query, --output json, and least-privilege
  IAM best practices. Use when the user asks about S3 buckets, objects, uploads,
  downloads, sync, ACLs, bucket policies, static hosting, encryption, or storage
  operations.
requirements:
  - aws-cli >= 2.0
  - Configured AWS credentials (aws configure or IAM role/instance profile)
---

# AWS S3 — Senior Cloud Infrastructure Architect Skill

## Core Conventions

Always apply these flags unless the user explicitly overrides:

```
--output json          # machine-parseable, predictable
--query '…'            # filter at the API layer, not in shell pipes
--region <region>      # explicit region, never rely on ambient default
--no-paginate          # add when expecting full result sets
```

---

## Bucket Operations

### List all buckets (with creation dates)
```bash
aws s3api list-buckets \
  --query 'Buckets[*].{Name:Name,Created:CreationDate}' \
  --output json
```

### Create bucket (us-east-1)
```bash
aws s3api create-bucket \
  --bucket my-bucket \
  --region us-east-1 \
  --output json
```

### Create bucket (any other region — requires LocationConstraint)
```bash
aws s3api create-bucket \
  --bucket my-bucket \
  --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1 \
  --output json
```

### Block all public access (always apply to new buckets)
```bash
aws s3api put-public-access-block \
  --bucket my-bucket \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### Delete bucket (must be empty)
```bash
aws s3api delete-bucket --bucket my-bucket --region us-east-1
```

### Force-delete bucket with all versions (use with caution)
```bash
aws s3api list-object-versions --bucket my-bucket \
  --query '{Objects:Versions[*].{Key:Key,VersionId:VersionId}}' \
  --output json > versions.json
aws s3api delete-objects --bucket my-bucket --delete file://versions.json
aws s3api delete-bucket --bucket my-bucket
```

---

## Object Operations

### Upload object (SSE-KMS, infrequent-access storage class)
```bash
aws s3 cp local-file.zip s3://my-bucket/path/local-file.zip \
  --sse aws:kms \
  --storage-class STANDARD_IA
```

### Upload with explicit KMS key
```bash
aws s3 cp data.csv s3://my-bucket/data/data.csv \
  --sse aws:kms \
  --sse-kms-key-id arn:aws:kms:us-east-1:123456789012:key/KEY-ID
```

### Download object
```bash
aws s3 cp s3://my-bucket/path/file.txt ./file.txt
```

### Sync local directory → S3 (with delete)
```bash
aws s3 sync ./dist s3://my-bucket/dist \
  --delete \
  --sse aws:kms \
  --exclude "*.DS_Store"
```

### List objects (with size and last modified)
```bash
aws s3api list-objects-v2 \
  --bucket my-bucket \
  --prefix path/ \
  --query 'Contents[*].{Key:Key,Size:Size,Modified:LastModified}' \
  --output json
```

### Move (copy + delete) object within S3
```bash
aws s3 mv s3://my-bucket/old-path/file.txt s3://my-bucket/new-path/file.txt
```

### Delete object
```bash
aws s3api delete-object --bucket my-bucket --key path/file.txt
```

### Batch delete all objects under a prefix
```bash
aws s3 rm s3://my-bucket/tmp/ --recursive
```

### Generate pre-signed URL (expires in 1 hour)
```bash
aws s3 presign s3://my-bucket/private/report.pdf \
  --expires-in 3600
```

---

## Versioning

### Enable versioning
```bash
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Enabled
```

### Suspend versioning
```bash
aws s3api put-bucket-versioning \
  --bucket my-bucket \
  --versioning-configuration Status=Suspended
```

### List object versions
```bash
aws s3api list-object-versions \
  --bucket my-bucket \
  --prefix path/file.txt \
  --query '{Versions:Versions[*].{Key:Key,VersionId:VersionId,IsLatest:IsLatest},DeleteMarkers:DeleteMarkers}' \
  --output json
```

### Restore a specific version (copy it back as latest)
```bash
aws s3api copy-object \
  --bucket my-bucket \
  --copy-source my-bucket/path/file.txt?versionId=VERSION-ID \
  --key path/file.txt \
  --server-side-encryption aws:kms
```

---

## Encryption

### Enable SSE-KMS default encryption with bucket key (cost optimization)
```bash
aws s3api put-bucket-encryption \
  --bucket my-bucket \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "aws:kms",
        "KMSMasterKeyID": "arn:aws:kms:us-east-1:123456789012:key/KEY-ID"
      },
      "BucketKeyEnabled": true
    }]
  }'
```

> Enable `BucketKeyEnabled: true` to reduce KMS API call costs by up to 99% for high-throughput buckets.

### Verify encryption is configured
```bash
aws s3api get-bucket-encryption \
  --bucket my-bucket \
  --query 'ServerSideEncryptionConfiguration.Rules[*]' \
  --output json
```

---

## Lifecycle Policies

### Transition to Glacier after 90 days, expire after 365
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "archive-and-expire",
      "Status": "Enabled",
      "Filter": {"Prefix": "logs/"},
      "Transitions": [{"Days": 90, "StorageClass": "GLACIER"}],
      "Expiration": {"Days": 365}
    }]
  }'
```

### Abort incomplete multipart uploads after 7 days
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "abort-incomplete-mpu",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 7}
    }]
  }'
```

### Expire non-current versions after 30 days (versioned buckets)
```bash
aws s3api put-bucket-lifecycle-configuration \
  --bucket my-bucket \
  --lifecycle-configuration '{
    "Rules": [{
      "ID": "expire-old-versions",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "NoncurrentVersionExpiration": {"NoncurrentDays": 30}
    }]
  }'
```

---

## Replication

### Enable cross-region replication (requires versioning on both buckets)
```bash
aws s3api put-bucket-replication \
  --bucket my-source-bucket \
  --replication-configuration '{
    "Role": "arn:aws:iam::123456789012:role/s3-replication-role",
    "Rules": [{
      "ID": "replicate-all",
      "Status": "Enabled",
      "Filter": {"Prefix": ""},
      "Destination": {
        "Bucket": "arn:aws:s3:::my-dest-bucket",
        "StorageClass": "STANDARD_IA",
        "EncryptionConfiguration": {
          "ReplicaKmsKeyID": "arn:aws:kms:eu-west-1:123456789012:key/DEST-KEY-ID"
        }
      },
      "SourceSelectionCriteria": {
        "SseKmsEncryptedObjects": {"Status": "Enabled"}
      }
    }]
  }'
```

---

## Bucket Policy (Least-Privilege Example)

### Allow a specific IAM role read-only access to a prefix
```bash
aws s3api put-bucket-policy \
  --bucket my-bucket \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "AllowRoleReadPrefix",
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::123456789012:role/my-role"},
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/data/*"
      ]
    }]
  }'
```

### Enforce TLS-only access (deny HTTP)
```bash
aws s3api put-bucket-policy \
  --bucket my-bucket \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Sid": "DenyNonTLS",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": ["arn:aws:s3:::my-bucket", "arn:aws:s3:::my-bucket/*"],
      "Condition": {"Bool": {"aws:SecureTransport": "false"}}
    }]
  }'
```

---

## Static Website Hosting

### Enable static website hosting
```bash
aws s3api put-bucket-website \
  --bucket my-website-bucket \
  --website-configuration '{
    "IndexDocument": {"Suffix": "index.html"},
    "ErrorDocument": {"Key": "error.html"}
  }'
```

> For production websites, always serve via CloudFront with OAC rather than exposing the bucket endpoint directly.

---

## CORS Configuration

```bash
aws s3api put-bucket-cors \
  --bucket my-bucket \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["https://app.example.com"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3000
    }]
  }'
```

---

## Storage Lens (Account-wide analytics)

### List available Storage Lens dashboards
```bash
aws s3control list-storage-lens-configurations \
  --account-id 123456789012 \
  --query 'StorageLensConfigurationList[*].{Id:Id,Enabled:IsEnabled}' \
  --output json
```

---

## IAM Least-Privilege Reference

| Task | Actions Required |
|------|-----------------|
| Read objects | `s3:GetObject` |
| Upload objects | `s3:PutObject` |
| List bucket | `s3:ListBucket` |
| Delete objects | `s3:DeleteObject` |
| Manage versioning | `s3:GetBucketVersioning`, `s3:PutBucketVersioning` |
| Manage lifecycle | `s3:GetLifecycleConfiguration`, `s3:PutLifecycleConfiguration` |
| Manage replication | `s3:GetReplicationConfiguration`, `s3:PutReplicationConfiguration` |
| Bucket policy | `s3:GetBucketPolicy`, `s3:PutBucketPolicy` |
| Pre-signed URLs | No special permission beyond the action being pre-signed |

Always scope `s3:ListBucket` to the bucket ARN and object actions to `arn:aws:s3:::bucket/*`. Never use `"Resource": "*"` for S3 object permissions.

---

## Best Practices

1. **Block public access at account level** — enable S3 Account-level Public Access Block in all accounts to prevent accidental exposure.
2. **Encrypt by default** — configure bucket-level SSE-KMS with a customer-managed key and enable Bucket Key to control encryption costs.
3. **Enforce TLS** — add a bucket policy `Deny` statement on `aws:SecureTransport=false` for all buckets handling sensitive data.
4. **Enable versioning for critical data** — pair with a lifecycle rule to expire non-current versions after a retention window.
5. **Abort incomplete MPU** — always add an `AbortIncompleteMultipartUpload` lifecycle rule to prevent cost accumulation from failed uploads.
6. **Prefer `s3api` over `s3`** — the `s3api` subcommand maps 1:1 to S3 REST API operations and returns structured JSON; the `s3` subcommand is a convenience wrapper.
7. **Use S3 Access Points** — for multi-tenant or complex policy scenarios, create per-application access points rather than expanding the bucket policy.
8. **Tag all buckets** — apply `Env`, `Owner`, `DataClassification`, and `CostCenter` tags for governance, billing, and automated lifecycle enforcement.
