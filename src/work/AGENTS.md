# Scoped work instructions

Work orders and requests often affect parts, users, maps, comments, status histories, notifications, schedules and mail. Inspect `src/work/work.routes.ts`, `src/work/order/order.routes.ts`, related services/models and relevant side effects before editing. Preserve status/priority enums in `src/models/workOrder.model.ts`, workflow invariants, tenant scoping, permission keys, soft delete, idempotent retries and frontend API compatibility. Test failed partial writes and concurrent status transitions when affected.
