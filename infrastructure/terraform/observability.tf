resource "aws_cloudwatch_log_group" "api" {
  name              = "/cmms/${var.environment}/api"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.observability.arn
  tags              = local.tags
}

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/cmms/${var.environment}/worker"
  retention_in_days = var.log_retention_days
  kms_key_id        = aws_kms_key.observability.arn
  tags              = local.tags
}

data "aws_iam_policy_document" "observability_kms" {
  statement {
    sid       = "AccountAdministration"
    actions   = ["kms:*"]
    resources = ["*"]
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }

  statement {
    sid = "CloudWatchLogsEncryption"
    actions = [
      "kms:Encrypt",
      "kms:Decrypt",
      "kms:ReEncrypt*",
      "kms:GenerateDataKey*",
      "kms:DescribeKey"
    ]
    resources = ["*"]
    principals {
      type        = "Service"
      identifiers = ["logs.${var.aws_region}.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "kms:EncryptionContext:aws:logs:arn"
      values   = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:/cmms/${var.environment}/*"]
    }
  }
}

resource "aws_kms_key" "observability" {
  description             = "CMMS ${var.environment} observability log encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  policy                  = data.aws_iam_policy_document.observability_kms.json
  tags                    = local.tags
}

resource "aws_kms_alias" "observability" {
  name          = "alias/${local.name}-observability"
  target_key_id = aws_kms_key.observability.key_id
}

locals {
  alarm_actions = var.alarm_notification_arns
}

resource "aws_cloudwatch_metric_alarm" "alb_target_latency" {
  alarm_name          = "${local.name}-target-p95-latency"
  alarm_description   = "CMMS API target p95 latency exceeded one second."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  datapoints_to_alarm = 2
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "alb_no_healthy_targets" {
  for_each            = toset(["blue", "green"])
  alarm_name          = "${local.name}-${each.key}-no-healthy-targets"
  alarm_description   = "A CMMS blue-green target group has no healthy API instances."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "notBreaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  dimensions = {
    LoadBalancer = aws_lb.api.arn_suffix
    TargetGroup  = each.key == "blue" ? aws_lb_target_group.blue.arn_suffix : aws_lb_target_group.green.arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "asg_cpu_high" {
  alarm_name          = "${local.name}-api-cpu-high"
  alarm_description   = "CMMS API fleet CPU remained above 80 percent."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  dimensions = {
    AutoScalingGroupName = aws_autoscaling_group.api.name
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_cpu_high" {
  alarm_name          = "${local.name}-redis-cpu-high"
  alarm_description   = "Redis engine CPU remained above 75 percent."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Average"
  threshold           = 75
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis.replication_group_id
  }
}

resource "aws_cloudwatch_metric_alarm" "redis_memory_high" {
  alarm_name          = "${local.name}-redis-memory-high"
  alarm_description   = "Redis counted-for-eviction memory remained above 80 percent."
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "DatabaseMemoryUsageCountedForEvictPercentage"
  namespace           = "AWS/ElastiCache"
  period              = 60
  statistic           = "Maximum"
  threshold           = 80
  treat_missing_data  = "breaching"
  alarm_actions       = local.alarm_actions
  ok_actions          = local.alarm_actions
  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis.replication_group_id
  }
}

resource "aws_cloudwatch_dashboard" "operations" {
  dashboard_name = "${local.name}-operations"
  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "API traffic, failures, and latency"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.api.arn_suffix, { stat = "Sum" }],
            [".", "HTTPCode_Target_5XX_Count", ".", ".", { stat = "Sum" }],
            [".", "TargetResponseTime", ".", ".", { stat = "p95" }]
          ]
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "API fleet capacity"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/EC2", "CPUUtilization", "AutoScalingGroupName", aws_autoscaling_group.api.name, { stat = "Average" }],
            ["CWAgent", "mem_used_percent", "AutoScalingGroupName", aws_autoscaling_group.api.name, { stat = "Average" }],
            [".", "disk_used_percent", ".", ".", "path", "/", { stat = "Average" }]
          ]
        }
      },
      {
        type   = "metric"
        width  = 12
        height = 6
        properties = {
          title  = "Redis coordination"
          region = var.aws_region
          view   = "timeSeries"
          metrics = [
            ["AWS/ElastiCache", "EngineCPUUtilization", "ReplicationGroupId", aws_elasticache_replication_group.redis.replication_group_id, { stat = "Average" }],
            [".", "DatabaseMemoryUsageCountedForEvictPercentage", ".", ".", { stat = "Maximum" }]
          ]
        }
      },
      {
        type   = "log"
        width  = 12
        height = 6
        properties = {
          title  = "Recent API and worker errors"
          region = var.aws_region
          view   = "table"
          query  = "SOURCE '${aws_cloudwatch_log_group.api.name}' | SOURCE '${aws_cloudwatch_log_group.worker.name}' | fields @timestamp, service, level, msg, requestId, correlationId, traceId | filter level >= 50 | sort @timestamp desc | limit 100"
        }
      }
    ]
  })
}
