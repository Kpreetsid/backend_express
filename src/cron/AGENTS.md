# Scoped scheduled-job instructions

Do not register duplicate jobs, send real email in tests or assume host timezone equals business timezone. Analyze durable idempotency for each schedule occurrence and consistency across multiple application instances. Test UTC/local boundary, retries, partial work-order creation, DB failures and checkpointing. See `docs/ai/SCHEDULER-MAIL.md`.
