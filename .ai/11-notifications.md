# Notification Standard

Socket.IO remains notification-only. Allowed realtime behavior is delivery of existing notification events and acknowledgements such as `notification_reached`.

Presence, chat, cursor sharing, collaboration, or unrelated domain events are prohibited without a separate architecture decision. User rooms and tenant authorization remain mandatory. The Socket.IO handshake accepts the existing token/account transports only when the verified JWT `companyID` matches the supplied account, then joins only the verified user room. Multi-instance deployments use the Redis adapter; ALB stickiness supports polling fallback but is not the source of truth.

Notification fan-out moves to an idempotent queue worker backed by an outbox. Delivery, acknowledgement, retry, dead-letter, and reconnect metrics are required.

Work-order create, update, and status-change notifications now write
`notification.account.requested@1` events using the same MongoDB session as the
business mutation. The worker rejects payload/tenant mismatches and creates at
most one notification per `(eventId, targetUser)` across BullMQ retries. When
the outbox feature flag is disabled, the existing synchronous notification
path remains available as the rollback mode.

Work-order assignment email fan-out is also written within the work-order
transaction. The worker resolves users and work orders with the event tenant,
uses bounded retries, and records a deterministic message ID. User creation
uses the same transaction/outbox rule for both its welcome email and account
notification. Other legacy email families remain in the migration backlog.

Socket.IO remains notification-only. Queue processing does not introduce
presence, chat, collaboration, or unrelated realtime events.
