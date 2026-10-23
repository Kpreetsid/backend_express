'use strict';
// Temporary, allowlisted preparation. The validated candidate deletes this script.
const fs = require('node:fs');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const workflow = '.github/workflows/cmms-priority-validation.yml';
const request = 'src/modules/work-orders/controllers/request.controller.ts';
const parts = 'src/modules/inventory/services/parts.service.ts';
const order = 'src/modules/work-orders/services/order.service.ts';
const scheduler = 'src/core/scheduler/scheduler.service.ts';
const allowed = [request, parts, order, scheduler, 'package.json', workflow];
const regression = 'node --require ts-node/register/transpile-only --test src/core/scheduler/scheduler-recurrence.test.ts src/modules/inventory/services/work-order-quantities.test.ts src/modules/work-orders/controllers/request-boundaries.test.ts src/modules/work-orders/services/cmms-regression.test.ts';
function replace(path, before, after, count = 1) {
  const source = fs.readFileSync(path, 'utf8');
  assert.equal(source.split(before).length - 1, count, `Unexpected source at ${path}: ${before.slice(0, 75)}`);
  fs.writeFileSync(path, source.split(before).join(after));
}
function replaceBetween(path, first, last, replacement) {
  const source = fs.readFileSync(path, 'utf8');
  const begin = source.indexOf(first), end = source.indexOf(last, begin + first.length);
  assert.ok(begin >= 0 && end > begin, `Missing bounded section in ${path}`);
  assert.equal(source.indexOf(first, begin + first.length), -1, 'Ambiguous start');
  fs.writeFileSync(path, source.slice(0, begin) + replacement + source.slice(end));
}
function prepare() {
  replace(parts, "    const explicitActual = Number(part?.actualQuantity);\n    if (Number.isFinite(explicitActual) && explicitActual > 0) {", "    const rawActual = part?.actualQuantity;\n    const hasActual = rawActual !== null && rawActual !== undefined\n      && !(typeof rawActual === 'string' && rawActual.trim() === '');\n    const explicitActual = Number(rawActual);\n    // Explicit zero means no consumption. Only absent values use the legacy estimate.\n    if (hasActual && Number.isFinite(explicitActual) && explicitActual >= 0) {");
  replace(request, 'class RequestController {', "const editableRequestFields = ['title', 'description', 'problemType', 'priority', 'location_id', 'asset_id', 'files', 'status', 'tags', 'remarks', 'review_sla_hours', 'order_sla_hours'] as const;\nfunction editableRequestPayload(value: any): Record<string, any> {\n  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Object.assign(new Error('A work request object is required'), { status: 400 });\n  const payload: Record<string, any> = {};\n  for (const field of editableRequestFields) if (Object.prototype.hasOwnProperty.call(value, field)) payload[field] = value[field];\n  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {\n    if (!WORK_REQUEST_STATUSES.includes(payload.status)) throw Object.assign(new Error('Status is not editable'), { status: 400 });\n    if (['Approved', 'Rejected'].includes(payload.status)) throw Object.assign(new Error('Use the dedicated approval actions for this request'), { status: 400 });\n  }\n  return payload;\n}\n\nclass RequestController {");
  replace(request, 'const { params: { id }, query } = req;', 'const { params: { id } } = req;');
  replace(request, '      let baseFilter: any = { _id: requestId, account_id: account_id, visible: true };\n      if (query) {\n        baseFilter = { ...baseFilter, ...query };\n      }', '      const baseFilter: any = { _id: requestId, account_id: account_id, visible: true };');
  replace(request, 'const body = req.body;', 'const body = editableRequestPayload(req.body);');
  replace(request, 'const { params: { id, status }, body } = req;', 'const { params: { id, status } } = req;\n      const body = editableRequestPayload(req.body);');
  replace(request, '      if (body.remarks !== existingRequest[0].remarks) {', "      if (typeof body.remarks !== 'string' || !body.remarks.trim() || body.remarks === existingRequest[0].remarks) {\n        delete body.remarks;\n      } else {\n        body.remarks = body.remarks.trim();");
  replace(request, 'const { params: { id }, body: { remarks } } = req;', "const { params: { id } } = req;\n      const remarks = typeof req.body?.remarks === 'string' ? req.body.remarks.trim() : '';");
  replace(order, "const workRequestMatch: any = { status: { $nin: ['completed'] } }", "const workRequestMatch: any = { account_id: workOrderMatch.account_id, status: { $nin: ['completed'] } }");
  replace(order, 'let existingOrder: any = await WorkOrderModel.findById(id).session(session);', 'let existingOrder: any = await WorkOrderModel.findOne({ _id: id, account_id: user.account_id, visible: true }).session(session);');
  replace(order, 'body.oldParts || existingOrder.parts || []', 'existingOrder.parts || []', 2);
  replace(order, 'let updatedData = { ...existingOrder.toObject(), ...body };', "let updatedData = { ...existingOrder.toObject(), ...body,\n        _id: existingOrder._id, account_id: existingOrder.account_id,\n        createdBy: existingOrder.createdBy, created_by: existingOrder.created_by,\n        createdAt: existingOrder.createdAt, order_no: existingOrder.order_no, visible: existingOrder.visible }; ");
  replace(order, 'const updateFilter: any = { _id: id };', 'const updateFilter: any = { _id: id, account_id: user.account_id, visible: true };');
  replace(order, 'actualQuantity: part.actualQuantity || part.estimatedQuantity', "actualQuantity: part.actualQuantity === null || part.actualQuantity === undefined || part.actualQuantity === '' ? part.estimatedQuantity : part.actualQuantity");
  replace(scheduler, 'import crypto from "crypto";', 'import crypto from "crypto";\nimport { isScheduleDue } from "./schedule-calendar";');
  replaceBetween(scheduler, '    private getTodayDateStr(): string {', '    private async acquireScheduleLock(', '');
  replace(scheduler, 'private async acquireScheduleLock(scheduleId: any): Promise<boolean>', 'private async acquireScheduleLock(scheduleId: any): Promise<IScheduleMaster | null>');
  replace(scheduler, 'return !!locked;', 'return locked;');
  replace(scheduler, 'createdFrom: schedule.work_order.createdFrom,', 'createdFrom: schedule.work_order.createdFrom || "Preventive",');
  replace(scheduler, 'await usersService.getAllUsers({ _id: schedule.createdBy });', 'await usersService.getAllUsers({ _id: schedule.createdBy, account_id: schedule.account_id });\n        if (!systemUser?.[0]) throw new Error("Schedule creator is unavailable in this account");');
  const source = fs.readFileSync(scheduler, 'utf8');
  const failedCreation = /if \(!workOrder\) \{[\s\S]*?\n        \}/g;
  assert.equal([...source.matchAll(failedCreation)].length, 1);
  fs.writeFileSync(scheduler, source.replace(failedCreation, 'if (!workOrder) {\n            throw new Error("Scheduled work order creation failed; execution was not recorded");\n        }'));
  replaceBetween(scheduler, '    public async runUnifiedScheduler(): Promise<void> {', '\n}\n\nexport const schedulerService', `    public async runUnifiedScheduler(): Promise<void> {
        try {
            const schedules = await SchedulerModel.find({ visible: true, "schedule.enabled": true });
            for (const schedule of schedules) {
                try {
                    if (!isScheduleDue(schedule.schedule)) continue;
                    const claimed = await this.acquireScheduleLock(schedule._id);
                    if (!claimed) continue;
                    try {
                        // Another worker or an edit may have changed the plan after the initial scan.
                        if (isScheduleDue(claimed.schedule)) await this.executeSchedule(claimed);
                    } finally {
                        await this.releaseScheduleLock(schedule._id);
                    }
                } catch (error) {
                    console.error('Schedule execution failed', String(schedule._id), error);
                }
            }
        } catch (error) {
            console.error('Scheduler failed', error);
        }
    }
`);
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  pkg.scripts['test:cmms'] = regression;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  let yaml = fs.readFileSync(workflow, 'utf8');
  const archiveStart = yaml.indexOf('      - name: Package isolated verification workspace');
  assert.ok(archiveStart > 0); yaml = yaml.slice(0, archiveStart);
  yaml = yaml.replace('      - name: Build application', "      - name: CMMS workflow regression tests\n        if: ${{ !cancelled() && steps.install.outcome == 'success' }}\n        env:\n          TZ: UTC\n        run: npm run test:cmms\n      - name: Build application");
  fs.writeFileSync(workflow, yaml);
  console.log(cp.execFileSync('git', ['diff', '--stat'], { encoding: 'utf8' }));
}
async function propose() {
  assert.equal(process.env.GITHUB_REPOSITORY, 'Kpreetsid/backend_express');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/priority/bugs');
  const parent = cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(parent, process.env.GITHUB_SHA);
  const changed = cp.execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  assert.deepEqual([...changed].sort(), [...allowed].sort());
  async function api(path, body) {
    const response = await fetch('https://api.github.com/repos/Kpreetsid/backend_express/' + path, {
      method: 'POST', headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`Git object request failed: ${path} ${response.status}`);
    return response.json();
  }
  const entries = [];
  for (const path of allowed) {
    const blob = await api('git/blobs', { content: fs.readFileSync(path, 'utf8'), encoding: 'utf-8' });
    entries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  for (const path of ['scripts/cmms-candidate.cjs', '.github/workflows/cmms-candidate.yml']) entries.push({ path, mode: '100644', type: 'blob', sha: null });
  const baseTree = cp.execFileSync('git', ['rev-parse', 'HEAD^{tree}'], { encoding: 'utf8' }).trim();
  const tree = await api('git/trees', { base_tree: baseTree, tree: entries });
  const commit = await api('git/commits', { message: 'fix(cmms): protect request decisions, reconcile actual usage and honor PM intervals', tree: tree.sha, parents: [parent] });
  // Deliberately do not update any Git ref; publication requires a separate reviewed lease check.
  console.log(`VALIDATED_CANDIDATE_COMMIT=${commit.sha}`);
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `Validated candidate: ${commit.sha}\n\nParent: ${parent}\n\nNo branch ref was changed by this job.\n`);
}
if (process.argv[2] === 'prepare') prepare();
else if (process.argv[2] === 'propose') propose().catch(error => { console.error(error.message); process.exitCode = 1; });
else throw new Error('Expected prepare or propose');
