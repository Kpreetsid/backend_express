import { defineConfig } from 'vitest/config';

process.env['NODE_ENV'] = 'test';
process.env['LOG_LEVEL'] = 'silent';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: [
        'src/middlewares/requestContext.ts',
        'src/middlewares/permission.ts',
        'src/middlewares/idempotency.middleware.ts',
        'src/middlewares/error-handler.ts',
        'src/middlewares/passwordExpire.ts',
        'src/middlewares/validate.ts',
        'src/models/plugins/history.plugin.ts',
        'src/_config/storage.ts',
        'src/_config/auth.ts',
        'src/_config/cors.ts',
        'src/_config/malwareScanner.ts',
        'src/_config/payloadCrypto.ts',
        'src/_config/processorAuth.ts',
        'src/_config/redis-keys.ts',
        'src/_config/redis.ts',
        'src/_config/socket.ts',
        'src/_db/index.ts',
        'src/_db/mongo.connection.ts',
        'src/_db/mongoosePlugins.ts',
        'src/_db/migrations/20260728-stored-upload-metadata-indexes.ts',
        'src/_db/migrations/20260729-upload-quota-indexes.ts',
        'src/_db/migrations/20260729-asset-report-pdf-job-indexes.ts',
        'src/_db/migrations/20260730-declared-model-indexes.ts',
        'src/cron/scheduler.service.ts',
        'src/observability/trace-context.ts',
        'src/routes/health.routes.ts',
        'src/server.ts',
        'src/masters/inspection/inspection.controller.ts',
        'src/masters/schedule/schedule.service.ts',
        'src/masters/equipment/equipment.controller.ts',
        'src/masters/equipment/equipment.service.ts',
        'src/masters/part/parts.controller.ts',
        'src/masters/part/parts.service.ts',
        'src/masters/post/posts.controller.ts',
        'src/masters/post/posts.service.ts',
        'src/masters/post/comments/comments.controller.ts',
        'src/masters/post/comments/comments.service.ts',
        'src/masters/user/role/roles.controller.ts',
        'src/masters/user/role/roles.service.ts',
        'src/notification/notification.controller.ts',
        'src/notification/notification.service.ts',
        'src/queue/domain-event-consumer.ts',
        'src/queue/handlers/asset-endpoint-clone.handler.ts',
        'src/queue/handlers/asset-health-initialization.handler.ts',
        'src/queue/handlers/asset-report-processor.handler.ts',
        'src/queue/handlers/asset-report-pdf.handler.ts',
        'src/queue/handlers/equipment-endpoint-sync.handler.ts',
        'src/queue/handlers/notification.handler.ts',
        'src/queue/handlers/observation-asset-health.handler.ts',
        'src/queue/handlers/user-created-email.handler.ts',
        'src/queue/handlers/work-order-email.handler.ts',
        'src/queue/outbox-publisher.ts',
        'src/queue/outbox-writer.ts',
        'src/queue/processor-events.ts',
        'src/queue/queue-registry.ts',
        'src/queue/report-events.ts',
        'src/reports/asset/asset-pdf-job.service.ts',
        'src/reports/asset/asset-pdf-request.ts',
        'src/upload/upload-migration.ts',
        'src/upload/upload-metadata.service.ts',
        'src/upload/upload-quota-reconciliation.ts',
        'src/upload/upload-quota.service.ts',
        'src/upload/upload.multer.ts',
        'src/upload/upload.service.ts',
        'src/utils/notification.service.ts',
        'src/utils/externalAPI.ts',
        'src/utils/transaction.helper.ts',
        'src/utils/tenant-users.ts',
        'src/user/authentication/webRefreshCookie.ts',
        'src/user/registration/registration.controller.ts',
        'src/user/resetPassword/passwordResetAuthorization.service.ts',
        'src/user/resetPassword/resetPassword.controller.ts',
        'src/user/verification/verification.controller.ts',
        'src/transaction/mapUserWorkOrder/userWorkOrder.controller.ts',
        'src/transaction/mapUserAsset/userAsset.controller.ts',
        'src/work/request/request.controller.ts',
        'src/work/request/request.service.ts',
        'src/work/order/order.controller.ts',
        'src/work/procedure/procedure.service.ts',
        'src/worker.ts'
      ],
      thresholds: {
        lines: 94,
        functions: 96,
        statements: 93,
        branches: 81,
        'src/user/authentication/webRefreshCookie.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 80
        },
        'src/_config/auth.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/_config/cors.ts': {
          lines: 90,
          functions: 100,
          statements: 90,
          branches: 90
        },
        'src/_config/malwareScanner.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/_config/storage.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 80
        },
        'src/_config/payloadCrypto.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/_config/processorAuth.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 95
        },
        'src/_config/redis-keys.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 50
        },
        'src/_config/redis.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/_config/socket.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/_db/index.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/_db/mongo.connection.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/_db/mongoosePlugins.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 95
        },
        'src/_db/migrations/20260730-declared-model-indexes.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 95
        },
        'src/cron/scheduler.service.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/observability/trace-context.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/routes/health.routes.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/user/registration/registration.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        'src/user/resetPassword/passwordResetAuthorization.service.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/user/resetPassword/resetPassword.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        'src/user/verification/verification.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 85
        },
        'src/middlewares/idempotency.middleware.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 90
        },
        'src/server.ts': {
          lines: 95,
          functions: 100,
          statements: 95,
          branches: 85
        },
        'src/middlewares/error-handler.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 90
        },
        'src/middlewares/passwordExpire.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/middlewares/validate.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 100
        },
        'src/middlewares/permission.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 95
        },
        'src/models/plugins/history.plugin.ts': {
          lines: 90,
          functions: 95,
          statements: 90,
          branches: 80
        },
        'src/masters/inspection/inspection.controller.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 80
        },
        'src/masters/schedule/schedule.service.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 85
        },
        'src/masters/equipment/equipment.service.ts': {
          lines: 90,
          functions: 85,
          statements: 85,
          branches: 75
        },
        'src/masters/equipment/equipment.controller.ts': {
          lines: 85,
          functions: 100,
          statements: 85,
          branches: 70
        },
        'src/masters/part/parts.controller.ts': {
          lines: 85,
          functions: 100,
          statements: 85,
          branches: 70
        },
        'src/masters/part/parts.service.ts': {
          lines: 95,
          functions: 100,
          statements: 95,
          branches: 80
        },
        'src/masters/post/posts.controller.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/masters/post/posts.service.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 80
        },
        'src/masters/post/comments/comments.controller.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 85
        },
        'src/masters/post/comments/comments.service.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 90
        },
        'src/masters/user/role/roles.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 75
        },
        'src/masters/user/role/roles.service.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 75
        },
        'src/upload/upload.service.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 85
        },
        'src/notification/notification.controller.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 85
        },
        'src/transaction/mapUserWorkOrder/userWorkOrder.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 70
        },
        'src/transaction/mapUserAsset/userAsset.controller.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 75
        },
        'src/work/request/request.service.ts': {
          lines: 90,
          functions: 90,
          statements: 90,
          branches: 70
        },
        'src/work/order/order.controller.ts': {
          lines: 90,
          functions: 100,
          statements: 90,
          branches: 65
        },
        'src/utils/transaction.helper.ts': {
          lines: 90,
          functions: 95,
          statements: 90,
          branches: 75
        },
        'src/work/procedure/procedure.service.ts': {
          lines: 95,
          functions: 95,
          statements: 95,
          branches: 80
        },
        'src/worker.ts': {
          lines: 95,
          functions: 100,
          statements: 95,
          branches: 85
        },
        'src/queue/queue-registry.ts': {
          lines: 100,
          functions: 100,
          statements: 100,
          branches: 90
        }
      }
    }
  }
});
