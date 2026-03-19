---
name: aws-lambda
description: >-
  ⚡ Senior Cloud Infrastructure Architect skill for AWS Lambda. Creates, deploys,
  invokes, configures, and manages Lambda functions, layers, aliases, versions,
  event source mappings, and environment variables using the AWS CLI with
  --query, --output json, and IAM least-privilege best practices. Use when the
  user asks about Lambda functions, serverless deployments, function invocation,
  triggers, layers, aliases, function URLs, concurrency, or event-driven architecture.
requirements:
  - aws-cli >= 2.0
  - Configured AWS credentials with appropriate Lambda + IAM permissions
---

# AWS Lambda — Senior Cloud Infrastructure Architect Skill

## Core Conventions

```
--output json          # structured output
--query '…'            # filter at the API layer
--region <region>      # explicit, never ambient
```

---

## Function Deployment

### Create function (zip deployment)
```bash
zip -r function.zip . -x "*.git*"

aws lambda create-function \
  --function-name my-function \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/lambda-exec-role \
  --handler app.handler \
  --zip-file fileb://function.zip \
  --timeout 30 \
  --memory-size 256 \
  --environment Variables='{LOG_LEVEL=INFO,ENV=production}' \
  --region us-east-1 \
  --output json
```

### Create function with VPC config (private subnet access)
```bash
aws lambda create-function \
  --function-name my-vpc-function \
  --runtime python3.12 \
  --role arn:aws:iam::123456789012:role/lambda-exec-role \
  --handler app.handler \
  --zip-file fileb://function.zip \
  --vpc-config SubnetIds=subnet-aaa,subnet-bbb,SecurityGroupIds=sg-0123456789abcdef0 \
  --timeout 30 \
  --memory-size 256 \
  --output json
```

> VPC-attached functions require `ec2:CreateNetworkInterface`, `ec2:DescribeNetworkInterfaces`, and `ec2:DeleteNetworkInterface` in the execution role.

### Update function code only
```bash
aws lambda update-function-code \
  --function-name my-function \
  --zip-file fileb://function.zip \
  --region us-east-1 \
  --output json
```

### Deploy from S3 artifact
```bash
aws lambda update-function-code \
  --function-name my-function \
  --s3-bucket my-deploy-bucket \
  --s3-key builds/function-v1.2.3.zip \
  --region us-east-1 \
  --output json
```

### Update configuration
```bash
aws lambda update-function-configuration \
  --function-name my-function \
  --timeout 60 \
  --memory-size 512 \
  --environment Variables='{LOG_LEVEL=DEBUG,ENV=staging}' \
  --output json
```

### Wait for update to complete before chaining further calls
```bash
aws lambda wait function-updated --function-name my-function
```

---

## Invocation

### Synchronous invocation (with log decode)
```bash
aws lambda invoke \
  --function-name my-function \
  --payload '{"key": "value"}' \
  --cli-binary-format raw-in-base64-out \
  --log-type Tail \
  response.json \
  --query 'LogResult' \
  --output text | base64 --decode
```

### Asynchronous invocation (fire-and-forget)
```bash
aws lambda invoke \
  --function-name my-function \
  --invocation-type Event \
  --payload '{"key": "value"}' \
  --cli-binary-format raw-in-base64-out \
  /dev/null
```

### Dry-run invocation (permission check only)
```bash
aws lambda invoke \
  --function-name my-function \
  --invocation-type DryRun \
  --payload '{}' \
  --cli-binary-format raw-in-base64-out \
  /dev/null
```

---

## Listing & Inspection

### List all functions (name + runtime + memory + last modified)
```bash
aws lambda list-functions \
  --query 'Functions[*].{Name:FunctionName,Runtime:Runtime,Modified:LastModified,Memory:MemorySize}' \
  --output json \
  --no-paginate
```

### Get function configuration
```bash
aws lambda get-function-configuration \
  --function-name my-function \
  --query '{ARN:FunctionArn,Role:Role,Timeout:Timeout,Memory:MemorySize,Env:Environment}' \
  --output json
```

### Get function URL (if configured)
```bash
aws lambda get-function-url-config \
  --function-name my-function \
  --output json
```

### Create public function URL (no auth — use only for public endpoints)
```bash
aws lambda create-function-url-config \
  --function-name my-function \
  --auth-type NONE \
  --cors '{"AllowOrigins":["https://app.example.com"],"AllowMethods":["POST"]}'
```

### Create function URL with IAM auth (recommended for internal use)
```bash
aws lambda create-function-url-config \
  --function-name my-function \
  --auth-type AWS_IAM
```

---

## Versions & Aliases

### Publish a new version
```bash
aws lambda publish-version \
  --function-name my-function \
  --description "Release v1.2.3" \
  --output json
```

### Create alias pointing to version
```bash
aws lambda create-alias \
  --function-name my-function \
  --name production \
  --function-version 5 \
  --output json
```

### Weighted alias for canary deployment (10% → new version)
```bash
aws lambda update-alias \
  --function-name my-function \
  --name production \
  --function-version 5 \
  --routing-config AdditionalVersionWeights={"6"=0.1} \
  --output json
```

### List aliases
```bash
aws lambda list-aliases \
  --function-name my-function \
  --query 'Aliases[*].{Name:Name,Version:FunctionVersion,Routing:RoutingConfig}' \
  --output json
```

---

## Concurrency

### Set reserved concurrency (cap execution slots per function)
```bash
aws lambda put-function-concurrency \
  --function-name my-function \
  --reserved-concurrent-executions 50
```

### Remove reserved concurrency (restore to unreserved pool)
```bash
aws lambda delete-function-concurrency --function-name my-function
```

### Configure provisioned concurrency on alias (eliminate cold starts)
```bash
aws lambda put-provisioned-concurrency-config \
  --function-name my-function \
  --qualifier production \
  --provisioned-concurrent-executions 10
```

### Get concurrency utilisation
```bash
aws lambda get-provisioned-concurrency-config \
  --function-name my-function \
  --qualifier production \
  --output json
```

---

## Layers

### Publish a layer
```bash
zip -j layer.zip python/  # preserve the python/ directory structure for Python runtimes
aws lambda publish-layer-version \
  --layer-name common-deps \
  --description "Shared Python dependencies" \
  --zip-file fileb://layer.zip \
  --compatible-runtimes python3.11 python3.12 \
  --output json
```

### Attach layer to function
```bash
aws lambda update-function-configuration \
  --function-name my-function \
  --layers arn:aws:lambda:us-east-1:123456789012:layer:common-deps:3
```

### List layer versions
```bash
aws lambda list-layer-versions \
  --layer-name common-deps \
  --query 'LayerVersions[*].{Version:Version,ARN:LayerVersionArn,Created:CreatedDate}' \
  --output json
```

---

## Event Source Mappings

### SQS trigger (with batching window)
```bash
aws lambda create-event-source-mapping \
  --function-name my-function \
  --event-source-arn arn:aws:sqs:us-east-1:123456789012:my-queue \
  --batch-size 10 \
  --maximum-batching-window-in-seconds 5 \
  --output json
```

### DynamoDB Streams trigger
```bash
aws lambda create-event-source-mapping \
  --function-name my-function \
  --event-source-arn arn:aws:dynamodb:us-east-1:123456789012:table/my-table/stream/TIMESTAMP \
  --starting-position TRIM_HORIZON \
  --batch-size 100 \
  --bisect-batch-on-function-error \
  --output json
```

### List event source mappings
```bash
aws lambda list-event-source-mappings \
  --function-name my-function \
  --query 'EventSourceMappings[*].{UUID:UUID,Source:EventSourceArn,State:State,BatchSize:BatchSize}' \
  --output json
```

### Disable an event source mapping (pause processing)
```bash
aws lambda update-event-source-mapping \
  --uuid <mapping-uuid> \
  --enabled false
```

---

## Environment Variables & Secrets

### Update environment variables
```bash
aws lambda update-function-configuration \
  --function-name my-function \
  --environment Variables='{DB_HOST=db.internal,LOG_LEVEL=INFO}'
```

> Never store secrets in Lambda environment variables in plaintext. Use AWS Secrets Manager or SSM Parameter Store (SecureString) and retrieve at runtime via SDK. Grant `secretsmanager:GetSecretValue` or `ssm:GetParameter` on the specific secret/parameter ARN.

---

## Delete Function

```bash
aws lambda delete-function --function-name my-function
aws lambda delete-function --function-name my-function --qualifier 5  # delete specific version
```

---

## IAM Execution Role — Minimum Permissions

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:log-group:/aws/lambda/my-function:*"
    }
  ]
}
```

Add additional statements only for specific resources the function must access (S3 bucket, DynamoDB table, SQS queue). Never use `"Resource": "*"` in a Lambda execution role.

---

## IAM Least-Privilege Reference

| Task | Action Required |
|------|----------------|
| Deploy code | `lambda:UpdateFunctionCode` |
| Update config | `lambda:UpdateFunctionConfiguration` |
| Invoke synchronously | `lambda:InvokeFunction` |
| Manage aliases | `lambda:CreateAlias`, `lambda:UpdateAlias` |
| Manage concurrency | `lambda:PutFunctionConcurrency` |
| Add SQS trigger | `lambda:CreateEventSourceMapping` |
| Attach layer | `lambda:UpdateFunctionConfiguration` |
| Publish version | `lambda:PublishVersion` |
| Create function | `lambda:CreateFunction`, `iam:PassRole` |

---

## Best Practices

1. **Right-size memory** — Lambda allocates CPU proportionally to memory. Profile with AWS Lambda Power Tuning (open-source Step Functions state machine) before fixing memory in production.
2. **Keep deployment packages minimal** — large packages increase cold start latency. Use Lambda Layers for shared dependencies and avoid bundling unused packages.
3. **Use `$LATEST` only in development** — always invoke production traffic through a named alias pointing to a published version.
4. **Implement dead-letter queues** — configure a DLQ (SQS or SNS) on asynchronous invocations to capture unprocessed events.
5. **Enable X-Ray tracing** — add `--tracing-config Mode=Active` for distributed tracing across service calls without code changes.
6. **Never use `Resource: "*"` in the execution role** — scope every IAM statement to the exact ARN of the resource the function accesses.
7. **Avoid VPC unless necessary** — VPC attachment adds cold start latency and requires ENI quota headroom. Only attach to VPC when the function needs access to private resources (RDS, ElastiCache).
8. **Log structured JSON** — emit `{"level":"INFO","requestId":"...","message":"..."}` to enable Logs Insights filtering and CloudWatch metric filters.
