import { IProcedureItem } from '../../models/procedure.model';

export interface GeneratedReliabilityProcedureDraft {
  name: string;
  category: string;
  tags: string[];
  location_ids: string[];
  asset_ids: string[];
  description: string;
  required_parts: Array<Record<string, unknown>>;
  steps: IProcedureItem[];
  version_notes: string;
}

const ACTION_OPTIONS = ['Completed', 'Unable to complete', 'Not applicable'];
const VERIFICATION_OPTIONS = ['Yes', 'No', 'N/A'];
const ACTION_OPTION_SCORES = [1, 0, 0];
const VERIFICATION_OPTION_SCORES = [1, 0, 0];

export function buildReliabilityProcedureDraft(caseData: any): GeneratedReliabilityProcedureDraft {
  const caseNo = plainTextLines(caseData?.case_no)[0] || 'Reliability case';
  const assetName = plainTextLines(caseData?.asset?.asset_name || caseData?.title)[0] || 'Asset';
  const failureMode = firstLine(
    caseData?.diagnosis_snapshot?.likely_failure_mode,
    ...(caseData?.linked_asset_reports || []).map((report: any) => report?.fault_detected),
    caseData?.recommendation_snapshot?.action_summary
  ) || 'Recommended maintenance';
  const idPrefix = slug(`${caseNo}-${String(caseData?._id || caseData?.id || '').slice(-8)}`) || 'reliability-case';
  const observations = buildObservationSections(caseData, idPrefix);
  const inspectionSteps = uniquePlainText([
    ...(caseData?.recommendation_snapshot?.inspection_steps || [])
  ]);
  const safetyChecks = uniquePlainText([
    ...(caseData?.recommendation_snapshot?.safety_checklist || [])
  ]);
  const recommendedActions = buildRecommendedActions(caseData);
  const reportIds = (caseData?.linked_asset_reports || [])
    .map((report: any) => String(report?.report_id || report?._id || '').trim())
    .filter(Boolean);

  const steps: IProcedureItem[] = [
    {
      id: `${idPrefix}-source-findings`,
      type: 'section',
      title: 'Source Findings',
      description: `Read-only findings imported from ${reportIds.length || 1} linked asset report${reportIds.length === 1 ? '' : 's'}.`,
      items: observations
    },
    {
      id: `${idPrefix}-pre-work`,
      type: 'section',
      title: 'Pre-work Verification',
      items: [
        {
          id: `${idPrefix}-condition-confirmed`,
          type: 'field',
          title: 'Reported condition confirmed at the asset',
          description: 'Verify the report findings against the current physical condition before starting work.',
          field_type: 'yes-no-na',
          options: VERIFICATION_OPTIONS,
          scoring_enabled: true,
          option_scores: VERIFICATION_OPTION_SCORES,
          required: true
        },
        ...inspectionSteps.map((step, index) => actionField(
          `${idPrefix}-inspection-${index + 1}`,
          `Inspection ${index + 1}`,
          step
        )),
        ...safetyChecks.map((step, index) => actionField(
          `${idPrefix}-safety-${index + 1}`,
          `Safety check ${index + 1}`,
          step
        ))
      ]
    },
    {
      id: `${idPrefix}-recommended-actions`,
      type: 'section',
      title: 'Recommended Actions',
      description: 'Complete each imported recommendation and record its execution status.',
      items: recommendedActions.map((action, index) => actionField(
        `${idPrefix}-action-${index + 1}`,
        `Recommended action ${index + 1}`,
        action
      ))
    },
    {
      id: `${idPrefix}-technician-record`,
      type: 'section',
      title: 'Technician Record',
      items: [
        requiredTextField(`${idPrefix}-technician-observations`, 'Technician observations', 'Record the condition found during inspection and execution.'),
        requiredTextField(`${idPrefix}-work-performed`, 'Work performed', 'Describe the maintenance work completed on the asset.'),
        requiredTextField(`${idPrefix}-deviations`, 'Deviations or incomplete actions', 'Record deviations and incomplete actions, or enter None.'),
        {
          id: `${idPrefix}-post-condition`,
          type: 'field',
          title: 'Post-maintenance condition verified',
          description: 'Confirm whether the asset condition was verified after maintenance.',
          field_type: 'yes-no-na',
          options: VERIFICATION_OPTIONS,
          scoring_enabled: true,
          option_scores: VERIFICATION_OPTION_SCORES,
          required: true
        },
        requiredTextField(`${idPrefix}-post-evidence`, 'Post-maintenance readings and evidence', 'Record post-maintenance readings, checks, and supporting evidence.'),
        {
          id: `${idPrefix}-verified-at`,
          type: 'field',
          title: 'Verification date and time',
          field_type: 'date',
          include_time: true,
          required: true
        }
      ]
    }
  ];

  return {
    name: truncate(`Reliability - ${assetName} - ${failureMode}`, 180),
    category: 'Reliability',
    tags: uniquePlainText([
      'reliability-generated',
      `case:${caseNo}`,
      `risk:${plainTextLines(caseData?.risk_level)[0] || 'unclassified'}`,
      `fault:${failureMode}`
    ]).map((tag) => truncate(tag, 100)),
    location_ids: validIds([caseData?.location_id, caseData?.location?._id, caseData?.location?.id]),
    asset_ids: validIds([caseData?.asset_id, caseData?.asset?._id, caseData?.asset?.id]),
    description: buildDescription(caseData, caseNo, assetName, failureMode, reportIds),
    required_parts: buildRequiredParts(caseData?.recommendation_snapshot?.suggested_spares),
    steps,
    version_notes: `Automatically generated from reliability case ${caseNo} when its work order was created.`
  };
}

function buildObservationSections(caseData: any, idPrefix: string): IProcedureItem[] {
  const reports = Array.isArray(caseData?.linked_asset_reports) ? caseData.linked_asset_reports : [];
  const sections = reports.map((report: any, reportIndex: number) => {
    const reportId = String(report?.report_id || report?._id || '').trim();
    const reportLabel = reportId ? `Asset Report #${reportId.slice(-8)}` : `Asset Report ${reportIndex + 1}`;
    const findings = uniquePlainText([report?.observations]);
    const metadata = uniquePlainText([
      report?.fault_detected ? `Fault: ${firstLine(report.fault_detected)}` : '',
      report?.severity ? `Severity: ${firstLine(report.severity)}` : '',
      report?.equipment_health ? `Equipment health: ${firstLine(report.equipment_health)}` : '',
      report?.createdOn ? `Reported: ${formatDate(report.createdOn)}` : ''
    ]).join(' | ');

    return {
      id: `${idPrefix}-report-${reportIndex + 1}`,
      type: 'section',
      title: reportLabel,
      description: metadata,
      items: findings.length
        ? findings.map((finding, findingIndex) => ({
            id: `${idPrefix}-report-${reportIndex + 1}-finding-${findingIndex + 1}`,
            type: 'heading',
            title: `Finding ${findingIndex + 1}`,
            description: finding
          }))
        : [{
            id: `${idPrefix}-report-${reportIndex + 1}-finding-none`,
            type: 'heading',
            title: 'Finding',
            description: 'No observation text was recorded in this asset report.'
          }]
    } as IProcedureItem;
  });

  if (sections.length) return sections;

  const fallbackFindings = uniquePlainText(caseData?.diagnosis_snapshot?.observations || []);
  return fallbackFindings.map((finding, index) => ({
    id: `${idPrefix}-case-finding-${index + 1}`,
    type: 'heading',
    title: `Finding ${index + 1}`,
    description: finding
  }));
}

function buildRecommendedActions(caseData: any): string[] {
  const reports = Array.isArray(caseData?.linked_asset_reports) ? caseData.linked_asset_reports : [];
  const actions = uniquePlainText([
    ...reports.map((report: any) => report?.recommendations),
    ...(caseData?.recommendation_snapshot?.maintenance_actions || []),
    ...(caseData?.diagnosis_snapshot?.recommendations || [])
  ]);
  if (actions.length) return actions;

  return uniquePlainText([
    caseData?.recommendation_snapshot?.action_summary,
    'Inspect the asset and complete the corrective maintenance defined by the reliability case.'
  ]).slice(0, 1);
}

function actionField(id: string, title: string, description: string): IProcedureItem {
  return {
    id,
    type: 'field',
    title,
    description,
    field_type: 'inspection-check',
    options: ACTION_OPTIONS,
    scoring_enabled: true,
    option_scores: ACTION_OPTION_SCORES,
    required: true
  };
}

function requiredTextField(id: string, title: string, description: string): IProcedureItem {
  return { id, type: 'field', title, description, field_type: 'text', required: true };
}

function buildDescription(caseData: any, caseNo: string, assetName: string, failureMode: string, reportIds: string[]): string {
  const summary = firstLine(caseData?.diagnosis_snapshot?.summary, caseData?.description);
  return [
    `Generated from reliability case ${caseNo}.`,
    `Asset: ${assetName}`,
    `Failure mode: ${failureMode}`,
    `Risk: ${plainTextLines(caseData?.risk_level)[0] || 'Unclassified'}`,
    reportIds.length ? `Linked asset reports: ${reportIds.map((id) => `#${id.slice(-8)}`).join(', ')}` : '',
    summary ? `Summary: ${summary}` : ''
  ].filter(Boolean).join('\n');
}

function buildRequiredParts(spares: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(spares)) return [];
  const seen = new Set<string>();
  return spares.reduce<Array<Record<string, unknown>>>((parts, spare: any) => {
    const partId = String(spare?.part_id || spare?.id || spare?._id || '').trim();
    const partName = firstLine(spare?.part_name, spare?.name, spare?.description) || '';
    const partNumber = firstLine(spare?.part_number, spare?.partNo, spare?.sku) || '';
    const key = (partId || partNumber || partName).toLowerCase();
    if (!key || seen.has(key)) return parts;
    seen.add(key);
    const quantity = Number(spare?.quantity ?? spare?.estimatedQuantity ?? spare?.qty ?? 1);
    const part = {
      part_id: partId || undefined,
      part_name: partName || partNumber,
      part_number: partNumber,
      barcode: firstLine(spare?.barcode) || '',
      quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
      unit: firstLine(spare?.unit) || '',
      notes: firstLine(spare?.notes) || ''
    };
    if (part.part_name) parts.push(part);
    return parts;
  }, []);
}

export function plainTextLines(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return values.flatMap((item) => {
    const html = String(item || '')
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*li(?:\s[^>]*)?>/gi, '\n')
      .replace(/<\s*\/\s*(?:li|p|div|ul|ol|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ');
    return decodeHtmlEntities(html)
      .split(/\r?\n|;/)
      .map((line) => line.replace(/^\s*[-*\u2022]+\s*/, '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  });
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' '
  };
  return value
    .replace(/&([a-z]+);/gi, (match, name) => named[String(name).toLowerCase()] ?? match)
    .replace(/&#(\d+);/g, (match, code) => safeCodePoint(code, match))
    .replace(/&#x([0-9a-f]+);/gi, (match, code) => safeCodePoint(parseInt(code, 16), match));
}

function safeCodePoint(value: unknown, fallback: string): string {
  const code = Number(value);
  try {
    return Number.isInteger(code) && code >= 0 ? String.fromCodePoint(code) : fallback;
  } catch {
    return fallback;
  }
}

function uniquePlainText(values: unknown[]): string[] {
  const seen = new Set<string>();
  return values.flatMap((value) => plainTextLines(value)).filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function firstLine(...values: unknown[]): string | undefined {
  for (const value of values) {
    const line = plainTextLines(value)[0];
    if (line) return line;
  }
  return undefined;
}

function validIds(values: unknown[]): string[] {
  return Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 3).trim()}...`;
}

function formatDate(value: unknown): string {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? String(value || '') : date.toISOString();
}
