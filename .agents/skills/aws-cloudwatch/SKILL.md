---
name: aws-cloudwatch
description: >-
  📊 Senior Cloud Infrastructure Architect skill for Amazon CloudWatch. Creates
  and manages alarms, dashboards, log groups, log insights queries, metric
  filters, event rules, composite alarms, and anomaly detection using the AWS
  CLI with --query, --output json, and IAM least-privilege best practices.
  Use when the user asks about CloudWatch alarms, dashboards, metrics, log
  groups, log streams, log insights, metric filters, EventBridge rules,
  anomaly detection, or observability infrastructure.
requirements:
  - aws-cli >= 2.0
  - Configured AWS credentials with cloudwatch:*, logs:*, and events:* permissions
---

# AWS CloudWatch — Senior Cloud Infrastructure Architect Skill

## Core Conventions

```
--output json          # structured output
--query '…'            # filter at the API layer
--region <region>      # explicit, never ambient
--no-paginate          # add when expecting full result sets
```

---

## Alarms

### Create metric alarm (CPU > 80% for 5 minutes)
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "web-01-cpu-high" \
  --alarm-description "CPU utilization exceeds 80% for 5 min" \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0abcdef1234567890 \
  --statistic Average \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts \
  --ok-actions arn:aws:sns:us-east-1:123456789012:ops-alerts \
  --treat-missing-data breaching \
  --region us-east-1
```

> Use `treat-missing-data breaching` for critical alarms — missing data often indicates the resource is down.

### Create alarm on custom metric
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "app-error-rate-high" \
  --namespace MyApp/Production \
  --metric-name ErrorRate \
  --statistic Sum \
  --period 60 \
  --evaluation-periods 3 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts \
  --treat-missing-data notBreaching
```

### Create composite alarm (AND logic)
```bash
aws cloudwatch put-composite-alarm \
  --alarm-name "app-degraded" \
  --alarm-rule "ALARM(\"web-01-cpu-high\") AND ALARM(\"app-error-rate-high\")" \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-pager \
  --alarm-description "Triggers only when BOTH CPU and error rate are in alarm"
```

### List alarms by state
```bash
aws cloudwatch describe-alarms \
  --state-value ALARM \
  --query 'MetricAlarms[*].{Name:AlarmName,State:StateValue,Reason:StateReason,Updated:StateUpdatedTimestamp}' \
  --output json
```

### Disable / enable alarm actions (maintenance window)
```bash
aws cloudwatch disable-alarm-actions --alarm-names "web-01-cpu-high"
aws cloudwatch enable-alarm-actions  --alarm-names "web-01-cpu-high"
```

### Delete alarm
```bash
aws cloudwatch delete-alarms --alarm-names "web-01-cpu-high" "app-error-rate-high"
```

---

## Metrics

### Publish custom metric data point
```bash
aws cloudwatch put-metric-data \
  --namespace MyApp/Production \
  --metric-data '[{
    "MetricName": "OrdersProcessed",
    --value 42,
    "Unit": "Count",
    "Dimensions": [{"Name": "Environment", "Value": "prod"}]
  }]'
```

Corrected form (no comment syntax in JSON):
```bash
aws cloudwatch put-metric-data \
  --namespace MyApp/Production \
  --metric-name OrdersProcessed \
  --value 42 \
  --unit Count \
  --dimensions Name=Environment,Value=prod
```

### Retrieve metric statistics (last hour, 5-min intervals)
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 \
  --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-0abcdef1234567890 \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time   $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average Maximum \
  --query 'sort_by(Datapoints, &Timestamp)[*].{Time:Timestamp,Avg:Average,Max:Maximum}' \
  --output json
```

### Use Metric Insights for aggregated queries
```bash
aws cloudwatch get_metric_data \
  --metric-data-queries '[{
    "Id": "cpu",
    "Expression": "AVG(SEARCH('"'"'{AWS/EC2,InstanceId} CPUUtilization'"'"', '"'"'Average'"'"', 300))",
    "Label": "All EC2 CPU Avg"
  }]' \
  --start-time 2024-01-01T00:00:00Z \
  --end-time   2024-01-01T01:00:00Z \
  --output json
```

### List available metrics for a namespace
```bash
aws cloudwatch list-metrics \
  --namespace AWS/Lambda \
  --query 'Metrics[*].{Name:MetricName,Dimensions:Dimensions}' \
  --output json \
  --no-paginate
```

---

## Anomaly Detection

### Create anomaly detector on a metric
```bash
aws cloudwatch put-anomaly-detector \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=my-function \
  --stat Average
```

### Alarm on anomaly band breach
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "lambda-duration-anomaly" \
  --metrics '[
    {"Id":"m1","MetricStat":{"Metric":{"Namespace":"AWS/Lambda","MetricName":"Duration","Dimensions":[{"Name":"FunctionName","Value":"my-function"}]},"Period":300,"Stat":"Average"}},
    {"Id":"ad1","Expression":"ANOMALY_DETECTION_BAND(m1, 2)","Label":"Expected range"}
  ]' \
  --comparison-operator GreaterThanUpperThreshold \
  --threshold-metric-id ad1 \
  --evaluation-periods 2 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:ops-alerts
```

---

## Dashboards

### Create dashboard from JSON body
```bash
aws cloudwatch put-dashboard \
  --dashboard-name "ProductionOverview" \
  --dashboard-body '{
    "widgets": [
      {
        "type": "metric",
        "x": 0, "y": 0, "width": 12, "height": 6,
        "properties": {
          "title": "EC2 CPU",
          "metrics": [["AWS/EC2","CPUUtilization","InstanceId","i-0abcdef1234567890"]],
          "period": 300,
          "stat": "Average",
          "region": "us-east-1"
        }
      }
    ]
  }'
```

### List dashboards
```bash
aws cloudwatch list-dashboards \
  --query 'DashboardEntries[*].{Name:DashboardName,Size:Size,Modified:LastModified}' \
  --output json
```

### Delete dashboard
```bash
aws cloudwatch delete-dashboards --dashboard-names "ProductionOverview"
```

---

## Log Groups

### Create log group with retention
```bash
aws logs create-log-group \
  --log-group-name /app/production/api \
  --tags Env=prod,Team=platform

aws logs put-retention-policy \
  --log-group-name /app/production/api \
  --retention-in-days 90
```

> Never leave log groups without a retention policy — unbounded log retention accumulates significant storage costs.

### List log groups (name + retention)
```bash
aws logs describe-log-groups \
  --query 'logGroups[*].{Name:logGroupName,Retention:retentionInDays,StoredBytes:storedBytes}' \
  --output json \
  --no-paginate
```

### Tail log stream in real time
```bash
aws logs tail /app/production/api --follow --format short
```

### Get recent log events from a stream
```bash
aws logs get-log-events \
  --log-group-name /app/production/api \
  --log-stream-name "2024/01/15/[$LATEST]abc123" \
  --start-from-head \
  --limit 100 \
  --query 'events[*].{Time:timestamp,Message:message}' \
  --output json
```

### Delete log group
```bash
aws logs delete-log-group --log-group-name /app/production/api
```

---

## CloudWatch Logs Insights

### Query errors in the last hour
```bash
aws logs start-query \
  --log-group-name /app/production/api \
  --start-time $(date -d '1 hour ago' +%s) \
  --end-time   $(date +%s) \
  --query-string 'fields @timestamp, @message
    | filter @message like /ERROR/
    | sort @timestamp desc
    | limit 50' \
  --output json
```

### Poll query results
```bash
aws logs get-query-results \
  --query-id <query-id-from-start-query> \
  --query '{Status:status,Results:results}' \
  --output json
```

### Top 10 slowest Lambda invocations
```bash
aws logs start-query \
  --log-group-name /aws/lambda/my-function \
  --start-time $(date -d '1 day ago' +%s) \
  --end-time   $(date +%s) \
  --query-string 'fields @timestamp, @duration
    | sort @duration desc
    | limit 10'
```

---

## Metric Filters

### Create metric filter (count HTTP 500 errors)
```bash
aws logs put-metric-filter \
  --log-group-name /app/production/api \
  --filter-name "http-500-errors" \
  --filter-pattern '[timestamp, requestId, level="ERROR", statusCode=500, ...]' \
  --metric-transformations \
    metricName=Http500Errors,metricNamespace=MyApp/Production,metricValue=1,defaultValue=0
```

### List metric filters
```bash
aws logs describe-metric-filters \
  --log-group-name /app/production/api \
  --query 'metricFilters[*].{Name:filterName,Pattern:filterPattern,Metric:metricTransformations[0].metricName}' \
  --output json
```

---

## EventBridge (CloudWatch Events)

### Schedule a Lambda function (cron every day at 06:00 UTC)
```bash
aws events put-rule \
  --name "daily-cleanup" \
  --schedule-expression "cron(0 6 * * ? *)" \
  --state ENABLED \
  --output json

aws events put-targets \
  --rule "daily-cleanup" \
  --targets 'Id=lambda-target,Arn=arn:aws:lambda:us-east-1:123456789012:function:my-function'

# Grant EventBridge permission to invoke Lambda
aws lambda add-permission \
  --function-name my-function \
  --statement-id EventBridgeDailyCleanup \
  --action lambda:InvokeFunction \
  --principal events.amazonaws.com \
  --source-arn arn:aws:events:us-east-1:123456789012:rule/daily-cleanup
```

### React to EC2 state change events
```bash
aws events put-rule \
  --name "ec2-termination-alert" \
  --event-pattern '{
    "source": ["aws.ec2"],
    "detail-type": ["EC2 Instance State-change Notification"],
    "detail": {"state": ["terminated"]}
  }' \
  --state ENABLED
```

---

## IAM Least-Privilege Reference

| Task | Actions Required |
|------|-----------------|
| Put/delete alarms | `cloudwatch:PutMetricAlarm`, `cloudwatch:DeleteAlarms` |
| Read metrics | `cloudwatch:GetMetricStatistics`, `cloudwatch:GetMetricData` |
| Publish custom metrics | `cloudwatch:PutMetricData` |
| Manage dashboards | `cloudwatch:PutDashboard`, `cloudwatch:DeleteDashboards` |
| Write logs | `logs:CreateLogGroup`, `logs:CreateLogStream`, `logs:PutLogEvents` |
| Read logs | `logs:GetLogEvents`, `logs:FilterLogEvents`, `logs:StartQuery` |
| Create metric filters | `logs:PutMetricFilter`, `logs:DeleteMetricFilter` |
| Manage EventBridge rules | `events:PutRule`, `events:PutTargets`, `events:DeleteRule` |

---

## Best Practices

1. **Alarm on p99, not average** — averages mask tail latency; use `p99` percentile statistics for latency alarms.
2. **Composite alarms reduce noise** — combine related alarms with AND/OR logic to prevent alert fatigue.
3. **Always set retention policies** — default log groups have infinite retention; enforce 30–365 days based on compliance requirements.
4. **Use Logs Insights over grep** — it scales across log groups and runs server-side, orders of magnitude faster than streaming and filtering locally.
5. **Metric filters are free CloudWatch metrics** — prefer them over custom PutMetricData for log-derived signals to reduce cost.
6. **Namespace custom metrics** — use `AppName/Environment` namespaces (e.g., `MyApp/Production`) to avoid collision with AWS namespaces.
7. **Tag alarms and dashboards** — apply `Env`, `Team`, and `Service` tags for cost allocation and organizational filtering.
8. **Use `treat-missing-data breaching`** for health-check alarms — silence should be treated as failure, not success.
