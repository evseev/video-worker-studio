---
name: aws-ec2
description: >-
  🖥️ Senior Cloud Infrastructure Architect skill for Amazon EC2. Launches,
  manages, and terminates instances, security groups, key pairs, AMIs, EBS
  volumes, Elastic IPs, Auto Scaling Groups, and placement groups using the
  AWS CLI with --query, --output json, and IAM least-privilege best practices.
  Use when the user asks about EC2 instances, AMIs, security groups, key pairs,
  EBS volumes, snapshots, Elastic IPs, Auto Scaling, launch templates, or
  compute capacity management.
requirements:
  - aws-cli >= 2.0
  - Configured AWS credentials with ec2:* permissions (or scoped equivalents)
---

# AWS EC2 — Senior Cloud Infrastructure Architect Skill

## Core Conventions

Always apply these flags unless the user explicitly overrides:

```
--output json          # machine-parseable, predictable
--query '…'            # filter at the API layer, not in shell pipes
--region <region>      # explicit region, never rely on ambient default
--no-paginate          # add when expecting full result sets
```

---

## Instances

### Launch instance (on-demand, minimal)
```bash
aws ec2 run-instances \
  --image-id ami-0abcdef1234567890 \
  --instance-type t3.micro \
  --key-name my-key-pair \
  --security-group-ids sg-0123456789abcdef0 \
  --subnet-id subnet-0123456789abcdef0 \
  --iam-instance-profile Name=my-instance-profile \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=web-01},{Key=Env,Value=prod}]' \
  --metadata-options HttpTokens=required \
  --region us-east-1 \
  --output json
```

> Always set `HttpTokens=required` to enforce IMDSv2 and prevent SSRF-based metadata theft.

### Launch from launch template
```bash
aws ec2 run-instances \
  --launch-template LaunchTemplateId=lt-0abcdef1234567890,Version='$Latest' \
  --count 2 \
  --region us-east-1 \
  --output json
```

### List running instances (name, type, state, IP)
```bash
aws ec2 describe-instances \
  --filters Name=instance-state-name,Values=running \
  --query 'Reservations[*].Instances[*].{ID:InstanceId,Type:InstanceType,State:State.Name,PrivateIP:PrivateIpAddress,PublicIP:PublicIpAddress,Name:Tags[?Key==`Name`]|[0].Value}' \
  --output json \
  --no-paginate
```

### Stop / start / terminate instance
```bash
aws ec2 stop-instances   --instance-ids i-0abcdef1234567890 --output json
aws ec2 start-instances  --instance-ids i-0abcdef1234567890 --output json
aws ec2 terminate-instances --instance-ids i-0abcdef1234567890 --output json
```

### Enable termination protection
```bash
aws ec2 modify-instance-attribute \
  --instance-id i-0abcdef1234567890 \
  --disable-api-termination
```

### Describe instance status (health checks)
```bash
aws ec2 describe-instance-status \
  --instance-ids i-0abcdef1234567890 \
  --query 'InstanceStatuses[*].{ID:InstanceId,Status:InstanceStatus.Status,System:SystemStatus.Status}' \
  --output json
```

---

## Security Groups

### Create security group
```bash
aws ec2 create-security-group \
  --group-name web-sg \
  --description "HTTP/HTTPS inbound for web tier" \
  --vpc-id vpc-0123456789abcdef0 \
  --output json
```

### Add ingress rule (HTTPS from anywhere)
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 443 \
  --cidr 0.0.0.0/0
```

### Restrict SSH to a bastion CIDR only
```bash
aws ec2 authorize-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 22 \
  --cidr 10.0.0.0/24
```

### Remove ingress rule
```bash
aws ec2 revoke-security-group-ingress \
  --group-id sg-0123456789abcdef0 \
  --protocol tcp \
  --port 22 \
  --cidr 0.0.0.0/0
```

### List security groups with rules summary
```bash
aws ec2 describe-security-groups \
  --query 'SecurityGroups[*].{ID:GroupId,Name:GroupName,VPC:VpcId}' \
  --output json
```

---

## Key Pairs

### Create key pair (save private key)
```bash
aws ec2 create-key-pair \
  --key-name my-key-pair \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/my-key-pair.pem
chmod 600 ~/.ssh/my-key-pair.pem
```

### Import existing public key
```bash
aws ec2 import-key-pair \
  --key-name my-key-pair \
  --public-key-material fileb://~/.ssh/id_rsa.pub
```

### List key pairs
```bash
aws ec2 describe-key-pairs \
  --query 'KeyPairs[*].{Name:KeyName,Fingerprint:KeyFingerprint}' \
  --output json
```

---

## AMIs

### Create AMI from running instance (no-reboot)
```bash
aws ec2 create-image \
  --instance-id i-0abcdef1234567890 \
  --name "web-01-$(date +%Y%m%d)" \
  --no-reboot \
  --tag-specifications 'ResourceType=image,Tags=[{Key=Source,Value=web-01}]' \
  --output json
```

### List owned AMIs
```bash
aws ec2 describe-images \
  --owners self \
  --query 'Images[*].{ID:ImageId,Name:Name,State:State,Created:CreationDate}' \
  --output json
```

### Deregister AMI and delete associated snapshots
```bash
AMI_ID=ami-0abcdef1234567890
SNAP_IDS=$(aws ec2 describe-images --image-ids $AMI_ID \
  --query 'Images[0].BlockDeviceMappings[*].Ebs.SnapshotId' --output text)
aws ec2 deregister-image --image-id $AMI_ID
for snap in $SNAP_IDS; do
  aws ec2 delete-snapshot --snapshot-id $snap
done
```

---

## EBS Volumes

### Create and attach encrypted volume
```bash
aws ec2 create-volume \
  --size 100 \
  --volume-type gp3 \
  --availability-zone us-east-1a \
  --encrypted \
  --kms-key-id arn:aws:kms:us-east-1:123456789012:key/KEY-ID \
  --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=data-vol}]' \
  --output json

aws ec2 attach-volume \
  --volume-id vol-0abcdef1234567890 \
  --instance-id i-0abcdef1234567890 \
  --device /dev/xvdf
```

### Create snapshot with description
```bash
aws ec2 create-snapshot \
  --volume-id vol-0abcdef1234567890 \
  --description "pre-deploy snapshot $(date +%Y%m%d-%H%M)" \
  --tag-specifications 'ResourceType=snapshot,Tags=[{Key=Env,Value=prod}]' \
  --output json
```

### List unattached volumes (cost hygiene)
```bash
aws ec2 describe-volumes \
  --filters Name=status,Values=available \
  --query 'Volumes[*].{ID:VolumeId,Size:Size,AZ:AvailabilityZone,Type:VolumeType}' \
  --output json
```

---

## Elastic IPs

### Allocate and associate
```bash
EIP=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
aws ec2 associate-address \
  --instance-id i-0abcdef1234567890 \
  --allocation-id $EIP
```

### Release unused Elastic IP
```bash
aws ec2 release-address --allocation-id eipalloc-0abcdef1234567890
```

---

## Launch Templates

### Create launch template with IMDSv2 and encrypted root volume
```bash
aws ec2 create-launch-template \
  --launch-template-name web-lt \
  --version-description "v1 baseline" \
  --launch-template-data '{
    "ImageId": "ami-0abcdef1234567890",
    "InstanceType": "t3.small",
    "KeyName": "my-key-pair",
    "SecurityGroupIds": ["sg-0123456789abcdef0"],
    "IamInstanceProfile": {"Name": "my-instance-profile"},
    "MetadataOptions": {"HttpTokens": "required", "HttpEndpoint": "enabled"},
    "BlockDeviceMappings": [{
      "DeviceName": "/dev/xvda",
      "Ebs": {"VolumeSize": 20, "VolumeType": "gp3", "Encrypted": true, "DeleteOnTermination": true}
    }],
    "TagSpecifications": [{"ResourceType": "instance", "Tags": [{"Key": "Env", "Value": "prod"}]}]
  }' \
  --output json
```

---

## Auto Scaling Groups

### Create ASG from launch template
```bash
aws autoscaling create-auto-scaling-group \
  --auto-scaling-group-name web-asg \
  --launch-template LaunchTemplateId=lt-0abcdef1234567890,Version='$Latest' \
  --min-size 2 \
  --max-size 10 \
  --desired-capacity 2 \
  --vpc-zone-identifier "subnet-aaa,subnet-bbb" \
  --health-check-type ELB \
  --health-check-grace-period 300 \
  --tags Key=Name,Value=web-asg,PropagateAtLaunch=true
```

### Scale out / in manually
```bash
aws autoscaling set-desired-capacity \
  --auto-scaling-group-name web-asg \
  --desired-capacity 5
```

### Describe ASG instances
```bash
aws autoscaling describe-auto-scaling-groups \
  --auto-scaling-group-names web-asg \
  --query 'AutoScalingGroups[0].{Min:MinSize,Max:MaxSize,Desired:DesiredCapacity,Instances:Instances[*].{ID:InstanceId,State:LifecycleState}}' \
  --output json
```

---

## VPC & Networking Quick Reference

### Describe VPCs
```bash
aws ec2 describe-vpcs \
  --query 'Vpcs[*].{ID:VpcId,CIDR:CidrBlock,Default:IsDefault,Name:Tags[?Key==`Name`]|[0].Value}' \
  --output json
```

### Describe subnets in a VPC
```bash
aws ec2 describe-subnets \
  --filters Name=vpc-id,Values=vpc-0123456789abcdef0 \
  --query 'Subnets[*].{ID:SubnetId,AZ:AvailabilityZone,CIDR:CidrBlock,Public:MapPublicIpOnLaunch}' \
  --output json
```

---

## IAM Least-Privilege Reference

| Task | Actions Required |
|------|-----------------|
| Launch instances | `ec2:RunInstances`, `iam:PassRole` |
| Stop/start instances | `ec2:StopInstances`, `ec2:StartInstances` |
| Terminate instances | `ec2:TerminateInstances` |
| Manage security groups | `ec2:AuthorizeSecurityGroupIngress`, `ec2:RevokeSecurityGroupIngress` |
| Create AMI | `ec2:CreateImage`, `ec2:CreateSnapshot` |
| Manage volumes | `ec2:CreateVolume`, `ec2:AttachVolume`, `ec2:DetachVolume` |
| Manage ASG | `autoscaling:CreateAutoScalingGroup`, `autoscaling:UpdateAutoScalingGroup` |

Always scope `ec2:RunInstances` with `Condition` on `ec2:InstanceType` and `ec2:Region` to prevent unauthorized instance types or regions.

---

## Best Practices

1. **IMDSv2 always** — set `HttpTokens=required` on every instance and in every launch template.
2. **No public IPs by default** — use NAT Gateway + bastion or SSM Session Manager instead.
3. **Encrypt all EBS volumes** — enable account-level EBS encryption default with a customer-managed KMS key.
4. **Terminate vs stop for ephemeral workloads** — stopped instances still incur EBS costs.
5. **Tag everything** — use `Name`, `Env`, `Owner`, `CostCenter` tags on all resources for governance and cost allocation.
6. **Use SSM Session Manager** — eliminates inbound SSH rules and key pair sprawl; requires `AmazonSSMManagedInstanceCore` managed policy on the instance role.
7. **Prefer launch templates over launch configurations** — launch configurations are legacy and do not support versioning.
8. **Enable detailed monitoring** — `aws ec2 monitor-instances --instance-ids i-xxx` provides 1-minute CloudWatch metrics.
