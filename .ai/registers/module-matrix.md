# Module Ownership Matrix

Owners are deployment-accountable roles until named individuals are approved.

| Domain | API area | Angular area | Data / integration | Accountable owner | Required contract tests |
|---|---|---|---|---|---|
| Authentication | auth and non-auth routes | login/session services | users, refresh tokens, mail | Security owner | login, rotate, replay, logout |
| Account/company | masters/account | account/company UI | account/company models | Platform owner | tenant boundary, compatibility |
| Users/roles | masters/users, roles | user/role modules | user and RBAC models | IAM owner | permission allow/deny |
| Locations/assets | masters + transactions | location/asset modules | hierarchy and asset models | Asset domain owner | hierarchy copy, tenant denial |
| Inspections | work/inspection | inspection module | inspection models | Inspection owner | create/complete/report |
| Work requests/orders | work routes | WR/WO modules | work and history models | Work owner | lifecycle, transaction rollback |
| Parts/inventory | work/master routes | inventory modules | stock/part models | Inventory owner | quantity integrity |
| Schedules | cron + work routes | scheduler UI | schedule models/jobs | Reliability owner | idempotent execution |
| Reports | reports routes | report modules | processor/PDF | Reporting owner | timeout, authorization |
| Notifications | notification routes/socket | notification service/UI | notification/outbox/Redis | Messaging owner | room scope, reconnect, ack |
| Uploads | upload routes/storage | upload controls | Mongo metadata/S3 | Storage owner | signature, quota, access |

No module is production-certified until its accountable owner is replaced with a named person or on-call team in the approved register.
