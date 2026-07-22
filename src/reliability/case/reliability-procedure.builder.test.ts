import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReliabilityProcedureDraft, plainTextLines } from './reliability-procedure.builder';

test('plainTextLines converts asset-report HTML into readable findings', () => {
  assert.deepEqual(
    plainTextLines('<ul><li>Bearing wear &amp; looseness</li><li>High vibration</li></ul>'),
    ['Bearing wear & looseness', 'High vibration']
  );
});

test('buildReliabilityProcedureDraft maps case evidence into a required execution procedure', () => {
  const draft = buildReliabilityProcedureDraft({
    _id: '66aabbccddeeff0011223344',
    case_no: 'RC-2026-000042',
    title: 'Extruder Motor',
    risk_level: 'High',
    asset_id: '66aabbccddeeff0011223301',
    location_id: '66aabbccddeeff0011223302',
    asset: { asset_name: 'Extruder Motor' },
    diagnosis_snapshot: {
      likely_failure_mode: 'Bearing defect',
      summary: 'Bearing condition requires corrective maintenance.',
      recommendations: ['Inspect the bearing', 'Verify alignment']
    },
    recommendation_snapshot: {
      inspection_steps: ['Confirm vibration at the motor NDE'],
      safety_checklist: ['Apply lockout/tagout'],
      maintenance_actions: ['Inspect the bearing', 'Verify alignment'],
      suggested_spares: [{ part_id: '66aabbccddeeff0011223303', part_name: 'Bearing 6205', quantity: 1 }]
    },
    linked_asset_reports: [
      {
        report_id: '66aabbccddeeff0011223311',
        fault_detected: 'Bearing defect',
        severity: 'High',
        equipment_health: 'Danger',
        observations: '<ul><li>High vibration at motor NDE</li><li>Bearing noise</li></ul>',
        recommendations: '<ul><li>Inspect the bearing</li><li>Verify alignment</li></ul>'
      },
      {
        report_id: '66aabbccddeeff0011223312',
        observations: '<p>Temperature is elevated.</p>',
        recommendations: '<p>Inspect the bearing</p>'
      }
    ]
  });

  assert.equal(draft.category, 'Reliability');
  assert.match(draft.name, /^Reliability - Extruder Motor - Bearing defect/);
  assert.deepEqual(draft.asset_ids, ['66aabbccddeeff0011223301']);
  assert.deepEqual(draft.location_ids, ['66aabbccddeeff0011223302']);
  assert.equal(draft.required_parts.length, 1);
  assert.ok(draft.tags.includes('reliability-generated'));

  const sourceFindings = draft.steps.find((step) => step.title === 'Source Findings');
  assert.equal(sourceFindings?.items?.length, 2);
  assert.equal(sourceFindings?.items?.[0]?.items?.[0]?.description, 'High vibration at motor NDE');

  const recommendedActions = draft.steps.find((step) => step.title === 'Recommended Actions');
  assert.equal(recommendedActions?.items?.length, 2);
  assert.ok(recommendedActions?.items?.every((item) => item.type === 'field' && item.required));

  const technicianRecord = draft.steps.find((step) => step.title === 'Technician Record');
  assert.ok(technicianRecord?.items?.every((item) => item.type !== 'field' || item.required));
  assert.ok(technicianRecord?.items?.some((item) => item.title === 'Post-maintenance readings and evidence'));
});
