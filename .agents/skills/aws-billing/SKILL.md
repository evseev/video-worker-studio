---
name: watadot-aws-billing
description: Advanced AWS Billing and Cost Management. Orchestrate budgets, cost exploration, and usage reports via AWS CLI.
metadata:
  openclaw:
    emoji: 💰
    requires:
      anyBins: [aws]
---

# AWS Billing & Cost Management Skills

Precision control over your cloud spend and budgetary guardrails.

## 🚀 Core Commands

### Cost Exploration (Cost Explorer API)
```bash
# Get monthly spend by service for the last 3 months
aws ce get-cost-and-usage \
    --time-period Start=$(date -d "3 months ago" +%Y-%m-01),End=$(date +%Y-%m-01) \
    --granularity MONTHLY \
    --metrics "UnblendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --query "ResultsByTime[].{Date:TimePeriod.Start, Total:Total.UnblendedCost.Amount, Services:Groups[].{Name:Keys[0], Cost:Metrics.UnblendedCost.Amount}}" \
    --output json

# Find the highest cost daily peak in the current month
aws ce get-cost-and-usage \
    --time-period Start=$(date +%Y-%m-01),End=$(date +%Y-%m-%d) \
    --granularity DAILY \
    --metrics "UnblendedCost" \
    --query "ResultsByTime[].{Date:TimePeriod.Start, Amount:Total.UnblendedCost.Amount}" \
    --output table
```

### Budget Orchestration
```bash
# List all active budgets and their current status
aws budgets describe-budgets --account-id $(aws sts get-caller-identity --query Account --output text) \
    --query "Budgets[].{Name:BudgetName, Limit:BudgetLimit.Amount, Spent:CalculatedSpend.ActualSpend.Amount, Unit:BudgetLimit.Unit}" \
    --output table

# Create a $100 monthly cost budget with email notification at 80%
# (Requires local budget-config.json)
aws budgets create-budget --account-id <account-id> --budget file://budget-config.json --notifications-with-subscribers file://notifications.json
```

### Savings & RI Monitoring
```bash
# Check for active Savings Plans
aws savingsplans describe-savings-plans --query "savingsPlans[?state==\`active\`].[savingsPlanId, status, start, end]" --output json
```

## 🧠 Best Practices
1. **Granular Tagging**: Use "Cost Allocation Tags" to group spend by Project or Owner. This makes `aws ce --group-by` significantly more powerful.
2. **Alerting is Mandatory**: Never run production workloads without an AWS Budget set to 50%, 80%, and 100% of your expected spend.
3. **Region Awareness**: Costs vary by region (e.g., S3 egress costs). Monitor cross-region data transfer regularly.
4. **Spot Instance Arbitrage**: Use `aws ec2 describe-spot-price-history` to find the cheapest time to run heavy tasks like Remotion rendering.
