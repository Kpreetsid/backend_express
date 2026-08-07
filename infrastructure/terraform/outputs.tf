output "api_alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "spa_cloudfront_domain_name" {
  value = aws_cloudfront_distribution.spa.domain_name
}

output "upload_bucket" {
  value = aws_s3_bucket.uploads.bucket
}

output "redis_primary_endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}

output "codedeploy_application" {
  value = aws_codedeploy_app.api.name
}

output "codedeploy_deployment_group" {
  value = aws_codedeploy_deployment_group.api.deployment_group_name
}

output "operations_dashboard" {
  value = aws_cloudwatch_dashboard.operations.dashboard_name
}

output "api_log_group" {
  value = aws_cloudwatch_log_group.api.name
}

output "worker_log_group" {
  value = aws_cloudwatch_log_group.worker.name
}

output "access_log_bucket" {
  value = aws_s3_bucket.access_logs.bucket
}
