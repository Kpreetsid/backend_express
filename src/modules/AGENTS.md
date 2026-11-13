# Scoped master-data instructions

This folder owns the domain modules, including assets, users, company, locations, schedules, inventory, SOP and related features. Trace `src/routes/v1/master.routes.ts` and nested module `*.routes.ts`, then controller/service/model. Preserve `account_id`, `visible`, parent-child references and role permissions. Validate ObjectIds, relationship ownership and aggregation joins. For asset trees test depth, cycles, tenant filtering and large datasets. See `docs/ai/DATA-MONGOOSE.md` and `docs/ai/FEATURE-PLAYBOOK.md`.
