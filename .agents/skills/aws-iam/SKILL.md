---
name: aws-iam
description: >-
  🔐 Senior Cloud Infrastructure Architect skill for AWS IAM. Creates and manages
  users, groups, roles, policies, permission boundaries, service control policies,
  trust relationships, access keys, and MFA using the AWS CLI with --query,
  --output json, and strict least-privilege design. Use when the user asks about
  IAM users, roles, policies, permissions, trust policies, cross-account access,
  service roles, access keys, MFA, policy simulation, or identity and access management.
requirements:
  - aws-cli >= 2.0
  - Configured AWS credentials with iam:* permissions (or scoped equivalents)
---

# AWS IAM — Senior Cloud Infrastructure Architect Skill

## Core Conventions

```
--output json          # machine-parseable
--query '…'            # reduce noise at API layer
```

> IAM is global — no `--region` flag is needed for most IAM API calls.

---

## Users

### Create user (with tags)
```bash
aws iam create-user \
  --user-name jane-doe \
  --tags Key=Team,Value=platform Key=Env,Value=prod \
  --output json
```

### List users (name + creation date + ARN)
```bash
aws iam list-users \
  --query 'Users[*].{User:UserName,Created:CreateDate,ARN:Arn}' \
  --output json \
  --no-paginate
```

### Attach managed policy to user
```bash
aws iam attach-user-policy \
  --user-name jane-doe \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
```

### Create programmatic access key
```bash
aws iam create-access-key \
  --user-name jane-doe \
  --query 'AccessKey.{ID:AccessKeyId,Secret:SecretAccessKey}' \
  --output json
```

> Store the `SecretAccessKey` immediately — it cannot be retrieved again after creation.

### List & audit access keys
```bash
aws iam list-access-keys \
  --user-name jane-doe \
  --query 'AccessKeyMetadata[*].{ID:AccessKeyId,Status:Status,Created:CreateDate}' \
  --output json
```

### Deactivate and delete stale key
```bash
aws iam update-access-key \
  --user-name jane-doe \
  --access-key-id AKIAIOSFODNN7EXAMPLE \
  --status Inactive

aws iam delete-access-key \
  --user-name jane-doe \
  --access-key-id AKIAIOSFODNN7EXAMPLE
```

### Set login profile (console password)
```bash
aws iam create-login-profile \
  --user-name jane-doe \
  --password 'Temp@Pass123!' \
  --password-reset-required
```

### Delete user (detach all policies first)
```bash
aws iam detach-user-policy \
  --user-name jane-doe \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess
aws iam delete-login-profile --user-name jane-doe
aws iam delete-user --user-name jane-doe
```

---

## Groups

### Create group and attach policy
```bash
aws iam create-group --group-name developers

aws iam attach-group-policy \
  --group-name developers \
  --policy-arn arn:aws:iam::aws:policy/PowerUserAccess
```

### Add user to group
```bash
aws iam add-user-to-group \
  --group-name developers \
  --user-name jane-doe
```

### List groups and attached policies
```bash
aws iam list-groups \
  --query 'Groups[*].{Name:GroupName,ARN:Arn}' \
  --output json

aws iam list-attached-group-policies \
  --group-name developers \
  --query 'AttachedPolicies[*].{Name:PolicyName,ARN:PolicyArn}' \
  --output json
```

---

## Roles

### Create role with trust policy (EC2 service principal)
```bash
aws iam create-role \
  --role-name ec2-app-role \
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ec2.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' \
  --description "Role for EC2 application instances" \
  --output json
```

### Trust policy — cross-account assume role (MFA required)
```bash
aws iam update-assume-role-policy \
  --role-name my-role \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"AWS": "arn:aws:iam::TRUSTED-ACCOUNT-ID:root"},
      "Action": "sts:AssumeRole",
      "Condition": {
        "Bool": {"aws:MultiFactorAuthPresent": "true"},
        "NumericLessThan": {"aws:MultiFactorAuthAge": "3600"}
      }
    }]
  }'
```

### Attach managed policy to role
```bash
aws iam attach-role-policy \
  --role-name ec2-app-role \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess
```

### List roles and their ARNs
```bash
aws iam list-roles \
  --query 'Roles[*].{Name:RoleName,ARN:Arn,Created:CreateDate}' \
  --output json \
  --no-paginate
```

### Create instance profile and bind role (required for EC2)
```bash
aws iam create-instance-profile --instance-profile-name ec2-app-profile
aws iam add-role-to-instance-profile \
  --instance-profile-name ec2-app-profile \
  --role-name ec2-app-role
```

### Assume role (obtain temporary credentials)
```bash
aws sts assume-role \
  --role-arn arn:aws:iam::123456789012:role/my-role \
  --role-session-name my-session \
  --duration-seconds 3600 \
  --query 'Credentials.{AccessKeyId:AccessKeyId,SecretAccessKey:SecretAccessKey,SessionToken:SessionToken}' \
  --output json
```

---

## Inline vs Managed Policies

| | Managed Policy | Inline Policy |
|---|---|---|
| **Reuse** | Across multiple principals | One principal only |
| **Audit** | Easier (versioned, listed separately) | Harder (embedded, not listed globally) |
| **Recommendation** | Prefer for shared permissions | Use for strict 1:1 binding only |

### Create customer-managed policy
```bash
aws iam create-policy \
  --policy-name s3-read-specific-bucket \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::my-bucket",
        "arn:aws:s3:::my-bucket/*"
      ]
    }]
  }' \
  --output json
```

### Create new policy version (update in place)
```bash
aws iam create-policy-version \
  --policy-arn arn:aws:iam::123456789012:policy/s3-read-specific-bucket \
  --policy-document file://policy-v2.json \
  --set-as-default
```

### List all versions of a policy
```bash
aws iam list-policy-versions \
  --policy-arn arn:aws:iam::123456789012:policy/s3-read-specific-bucket \
  --query 'Versions[*].{VersionId:VersionId,IsDefault:IsDefaultVersion,Created:CreateDate}' \
  --output json
```

### Get effective policies attached to a role
```bash
aws iam list-attached-role-policies \
  --role-name ec2-app-role \
  --query 'AttachedPolicies[*].{Name:PolicyName,ARN:PolicyArn}' \
  --output json
```

### Put inline policy on a role
```bash
aws iam put-role-policy \
  --role-name ec2-app-role \
  --policy-name allow-specific-sqs \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"],
      "Resource": "arn:aws:sqs:us-east-1:123456789012:my-queue"
    }]
  }'
```

---

## Permission Boundaries

Set a permission boundary to cap maximum permissions that can be granted to a role or user, regardless of attached policies:

```bash
aws iam put-role-permissions-boundary \
  --role-name ec2-app-role \
  --permissions-boundary arn:aws:iam::123456789012:policy/max-permissions-boundary
```

### Remove permission boundary
```bash
aws iam delete-role-permissions-boundary --role-name ec2-app-role
```

> Permission boundaries define the *ceiling* of permissions; the effective permissions are the intersection of the boundary and the identity's policies.

---

## Policy Simulation

Test whether a principal can perform an action before deploying changes:

```bash
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::123456789012:role/ec2-app-role \
  --action-names s3:GetObject s3:PutObject \
  --resource-arns arn:aws:s3:::my-bucket/data/* \
  --query 'EvaluationResults[*].{Action:EvalActionName,Decision:EvalDecision,MissingContextValues:MissingContextValues}' \
  --output json
```

### Simulate against a specific policy document (without attaching it)
```bash
aws iam simulate-custom-policy \
  --policy-input-list file://policy.json \
  --action-names s3:GetObject ec2:DescribeInstances \
  --resource-arns '*' \
  --query 'EvaluationResults[*].{Action:EvalActionName,Decision:EvalDecision}' \
  --output json
```

---

## Credential Report

Generate and download account-wide credential audit:

```bash
aws iam generate-credential-report
sleep 5
aws iam get-credential-report \
  --query 'Content' \
  --output text | base64 --decode > credential-report.csv
```

The report includes: users, password last used, MFA enabled status, access key ages, and last-used metadata — essential for quarterly access reviews.

---

## MFA Enforcement

Condition block to require MFA in any policy statement:

```json
"Condition": {
  "Bool": {
    "aws:MultiFactorAuthPresent": "true"
  },
  "NumericLessThan": {
    "aws:MultiFactorAuthAge": "3600"
  }
}
```

### Allow user to manage only their own MFA device (self-service)
```bash
aws iam put-user-policy \
  --user-name jane-doe \
  --policy-name manage-own-mfa \
  --policy-document '{
    "Version": "2012-10-17",
    "Statement": [
      {
        "Sid": "AllowListVirtualMFADevices",
        "Effect": "Allow",
        "Action": "iam:ListVirtualMFADevices",
        "Resource": "*"
      },
      {
        "Sid": "AllowManageOwnMFA",
        "Effect": "Allow",
        "Action": [
          "iam:CreateVirtualMFADevice",
          "iam:EnableMFADevice",
          "iam:ResyncMFADevice",
          "iam:DeactivateMFADevice",
          "iam:DeleteVirtualMFADevice"
        ],
        "Resource": [
          "arn:aws:iam::*:mfa/${aws:username}",
          "arn:aws:iam::*:user/${aws:username}"
        ]
      }
    ]
  }'
```

---

## Access Analyzer

### Create analyzer (identify external access)
```bash
aws accessanalyzer create-analyzer \
  --analyzer-name account-analyzer \
  --type ACCOUNT \
  --output json
```

### List active findings
```bash
aws accessanalyzer list-findings \
  --analyzer-arn arn:aws:access-analyzer:us-east-1:123456789012:analyzer/account-analyzer \
  --filter '{"status":{"eq":["ACTIVE"]}}' \
  --query 'findings[*].{ID:id,ResourceType:resourceType,Resource:resource,Status:status}' \
  --output json
```

---

## IAM Least-Privilege Design Principles

1. **Start with deny** — only add `Allow` statements for what is explicitly needed.
2. **Scope resources** — never use `"Resource": "*"` unless the API requires it (e.g., `iam:ListUsers`).
3. **Use conditions** — restrict by `aws:SourceVpc`, `aws:RequestedRegion`, `s3:prefix`, `aws:PrincipalTag`, etc.
4. **Prefer roles over users** — avoid long-lived access keys; use roles for all workloads.
5. **Rotate keys** — automate rotation; alert on keys older than 90 days via CloudWatch + credential report.
6. **Use permission boundaries** — apply to developer-created roles to prevent privilege escalation.
7. **Audit with Access Analyzer** — run weekly to surface unintended external access to resources.
8. **Enforce MFA** — require MFA for all human users, especially for sensitive API calls (`iam:*`, `sts:AssumeRole`, `ec2:*`).
9. **Separate duty roles** — use distinct roles for read, write, and admin operations; never bundle into one.
10. **Tag IAM resources** — apply `Owner`, `Team`, and `Purpose` tags to all roles and policies for governance and automated cleanup.
