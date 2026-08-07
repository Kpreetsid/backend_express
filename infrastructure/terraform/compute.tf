resource "aws_security_group" "alb" {
  name_prefix = "${local.name}-alb-"
  description = "Public HTTPS entrypoint"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "api" {
  name_prefix = "${local.name}-api-"
  description = "CMMS API instances"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "api" {
  name                       = "${local.name}-api"
  internal                   = false
  load_balancer_type         = "application"
  security_groups            = [aws_security_group.alb.id]
  subnets                    = aws_subnet.public[*].id
  drop_invalid_header_fields = true
  enable_deletion_protection = var.environment == "production"
  idle_timeout               = 120

  access_logs {
    bucket  = aws_s3_bucket.access_logs.id
    prefix  = "alb"
    enabled = true
  }

  depends_on = [aws_s3_bucket_policy.access_logs]
}

resource "aws_lb_target_group" "blue" {
  name        = "${local.name}-blue"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/health/ready"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 300
    enabled         = true
  }
}

resource "aws_lb_target_group" "green" {
  name        = "${local.name}-green"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = "/health/ready"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 300
    enabled         = true
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"
  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.api.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.alb_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn
  }
}

data "aws_iam_policy_document" "instance_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "api" {
  name               = "${local.name}-api"
  assume_role_policy = data.aws_iam_policy_document.instance_assume.json
}

data "aws_iam_policy_document" "api" {
  statement {
    actions   = ["s3:GetObject", "s3:GetObjectVersion"]
    resources = ["arn:aws:s3:::${var.artifact_bucket_name}/cmms_express/*"]
  }
  statement {
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["${aws_s3_bucket.uploads.arn}/*"]
  }
  statement {
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = [aws_s3_bucket.uploads.arn]
  }
  dynamic "statement" {
    for_each = length(var.runtime_secret_arns) > 0 ? [1] : []
    content {
      actions   = ["secretsmanager:GetSecretValue"]
      resources = var.runtime_secret_arns
    }
  }
  dynamic "statement" {
    for_each = length(var.runtime_secret_kms_key_arns) > 0 ? [1] : []
    content {
      actions   = ["kms:Decrypt"]
      resources = var.runtime_secret_kms_key_arns
    }
  }
  statement {
    actions = [
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "cloudwatch:PutMetricData"
    ]
    resources = ["*"]
  }
}

resource "aws_iam_role_policy" "api" {
  role   = aws_iam_role.api.id
  policy = data.aws_iam_policy_document.api.json
}

resource "aws_iam_instance_profile" "api" {
  name = "${local.name}-api"
  role = aws_iam_role.api.name
}

resource "aws_launch_template" "api" {
  name_prefix   = "${local.name}-api-"
  image_id      = var.ami_id
  instance_type = var.instance_type

  iam_instance_profile {
    name = aws_iam_instance_profile.api.name
  }

  vpc_security_group_ids = [aws_security_group.api.id]
  user_data = base64encode(<<-EOT
    #!/bin/bash
    set -euo pipefail
    install -d -m 0755 -o root -g root /etc/cmms
    cat > /etc/cmms/runtime.conf <<'CMMS_RUNTIME_CONTEXT'
    CMMS_RUNTIME_SECRET_ID_B64=${base64encode(try(var.runtime_secret_arns[0], ""))}
    AWS_REGION=${var.aws_region}
    CMMS_RUNTIME_CONTEXT
    chown root:ubuntu /etc/cmms/runtime.conf
    chmod 0640 /etc/cmms/runtime.conf
    install -d -m 0750 -o ubuntu -g ubuntu /var/log/cmms
    install -d -m 0755 -o root -g root /opt/aws/amazon-cloudwatch-agent/etc
    cat > /opt/aws/amazon-cloudwatch-agent/etc/cmms.json <<'CMMS_CLOUDWATCH_AGENT'
    ${jsonencode({
    agent = {
      metrics_collection_interval = 60
      run_as_user                 = "root"
    }
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            {
              file_path       = "/var/log/cmms/api.log"
              log_group_name  = aws_cloudwatch_log_group.api.name
              log_stream_name = "{instance_id}/stdout"
              timezone        = "UTC"
            },
            {
              file_path       = "/var/log/cmms/api-error.log"
              log_group_name  = aws_cloudwatch_log_group.api.name
              log_stream_name = "{instance_id}/stderr"
              timezone        = "UTC"
            },
            {
              file_path       = "/var/log/cmms/worker.log"
              log_group_name  = aws_cloudwatch_log_group.worker.name
              log_stream_name = "{instance_id}/stdout"
              timezone        = "UTC"
            },
            {
              file_path       = "/var/log/cmms/worker-error.log"
              log_group_name  = aws_cloudwatch_log_group.worker.name
              log_stream_name = "{instance_id}/stderr"
              timezone        = "UTC"
            }
          ]
        }
      }
      metrics = {
        append_dimensions = {
          AutoScalingGroupName = "$${aws:AutoScalingGroupName}"
          InstanceId           = "$${aws:InstanceId}"
        }
        metrics_collected = {
          mem = {
            measurement                 = ["mem_used_percent"]
            metrics_collection_interval = 60
          }
          disk = {
            measurement                 = ["used_percent"]
            metrics_collection_interval = 60
            resources                   = ["/"]
          }
        }
      }
    }
})}
    CMMS_CLOUDWATCH_AGENT
    if command -v amazon-cloudwatch-agent-ctl >/dev/null 2>&1; then
      amazon-cloudwatch-agent-ctl \
        -a fetch-config \
        -m ec2 \
        -s \
        -c file:/opt/aws/amazon-cloudwatch-agent/etc/cmms.json
    fi
  EOT
)

metadata_options {
  http_endpoint               = "enabled"
  http_tokens                 = "required"
  http_put_response_hop_limit = 1
}

monitoring {
  enabled = true
}

tag_specifications {
  resource_type = "instance"
  tags          = merge(local.tags, { Name = "${local.name}-api" })
}

lifecycle {
  precondition {
    condition     = var.environment != "production" || length(var.runtime_secret_arns) > 0
    error_message = "Production requires at least one runtime Secrets Manager ARN."
  }
}
}

resource "aws_autoscaling_group" "api" {
  name                = "${local.name}-api"
  min_size            = var.minimum_instances
  desired_capacity    = var.desired_instances
  max_size            = var.maximum_instances
  vpc_zone_identifier = aws_subnet.private[*].id
  health_check_type   = "ELB"
  target_group_arns   = [aws_lb_target_group.blue.arn]

  launch_template {
    id      = aws_launch_template.api.id
    version = "$Latest"
  }

  instance_refresh {
    strategy = "Rolling"
    preferences {
      min_healthy_percentage = 100
    }
  }
}

resource "aws_autoscaling_policy" "api_cpu_target" {
  name                   = "${local.name}-api-cpu-target"
  autoscaling_group_name = aws_autoscaling_group.api.name
  policy_type            = "TargetTrackingScaling"

  target_tracking_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ASGAverageCPUUtilization"
    }
    target_value     = 60
    disable_scale_in = false
  }
}
