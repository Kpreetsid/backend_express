variable "aws_region" {
  type    = string
  default = "ap-south-1"
}

variable "environment" {
  type = string
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "environment must be development, staging, or production."
  }
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.40.0.0/24", "10.40.1.0/24"]
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.40.10.0/24", "10.40.11.0/24"]
}

variable "ami_id" {
  type        = string
  description = "Immutable Node 24 AMI with the CodeDeploy agent."
}

variable "instance_type" {
  type    = string
  default = "t3.medium"
}

variable "app_port" {
  type    = number
  default = 3000
}

variable "minimum_instances" {
  type    = number
  default = 2
}

variable "desired_instances" {
  type    = number
  default = 2
}

variable "maximum_instances" {
  type    = number
  default = 4
}

variable "alb_certificate_arn" {
  type        = string
  description = "Regional ACM certificate for the API ALB."
}

variable "artifact_bucket_name" {
  type = string
}

variable "upload_bucket_name" {
  type = string
}

variable "spa_bucket_name" {
  type = string
}

variable "spa_content_security_policy" {
  type        = string
  description = "Content Security Policy applied by CloudFront to every Angular SPA response."
  default     = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' https://translate.google.com https://translate.googleapis.com; connect-src 'self' https: wss:; worker-src 'self' blob:; manifest-src 'self'"
  validation {
    condition     = length(trimspace(var.spa_content_security_policy)) > 0
    error_message = "spa_content_security_policy cannot be empty."
  }
}

variable "runtime_secret_arns" {
  type        = list(string)
  description = "Secrets Manager ARNs available to the API instance role."
  default     = []
}

variable "runtime_secret_kms_key_arns" {
  type        = list(string)
  description = "Customer-managed KMS key ARNs allowed to decrypt runtime secrets."
  default     = []
}

variable "alarm_notification_arns" {
  type        = list(string)
  description = "SNS topic ARNs that receive production and staging operational alarms."
  default     = []
}

variable "log_retention_days" {
  type        = number
  description = "CloudWatch retention for structured API and worker process logs."
  default     = 365
  validation {
    condition     = contains([30, 60, 90, 120, 150, 180, 365, 400, 545, 731, 1096, 1827, 2192, 2557, 2922, 3288, 3653], var.log_retention_days)
    error_message = "log_retention_days must be a CloudWatch Logs supported retention value of at least 30 days."
  }
}

variable "redis_node_type" {
  type    = string
  default = "cache.t4g.small"
}

variable "redis_auth_token" {
  type      = string
  sensitive = true
  validation {
    condition     = length(var.redis_auth_token) >= 32
    error_message = "redis_auth_token must contain at least 32 characters."
  }
}

locals {
  name = "cmms-${var.environment}"
  tags = {
    Application = "cmms"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
