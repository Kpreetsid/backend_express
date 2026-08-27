import sanitizeHtml from 'sanitize-html';
import { sanitizeStructuredPayload } from '../../utils/structuredPayload';

export const ASSET_REPORT_HEALTH_VALUES = ['1', '2', '3', '4', '5'] as const;
export const ASSET_REPORT_STATUSES = ['Open', 'On-Hold', 'In-Progress', 'Completed'] as const;

export const ASSET_REPORT_LIMITS = Object.freeze({
  richText: 50_000,
  files: 12,
  fileSize: 5 * 1024 * 1024,
  faults: 25,
  healthHistory: 120,
  endpointRms: 500,
  chartDetails: 100,
  harmonicIndexes: 100,
  alarmId: 2_147_483_647
});

type ReportFileType = 'image/jpeg' | 'image/png' | 'application/pdf';

interface SanitizedReportFile {
  originalName: string;
  type: ReportFileType;
  folderName: 'asset_report';
  fileName: string;
  size?: number;
}

const MIME_BY_EXTENSION: Readonly<Record<string, ReportFileType>> = Object.freeze({
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png'
});

const MUTABLE_FIELDS = new Set([
  'Observations',
  'Recommendations',
  'CreateWorkRequest',
  'FaultDetected',
  'Severity',
  'NewFault',
  'ISO',
  'TrendOfAlarm',
  'EquipmentHealth',
  'files',
  'harmonicIndex',
  'chartDetail',
  'faultData',
  'asset_health_history',
  'endpointRMSData'
]);

export function sanitizeAssetReportCreatePayload(input: unknown, accountId: unknown): Record<string, any> {
  const body = requirePlainObject(input, 'Asset report payload');
  const result = sanitizeMutableFields(body, accountId, undefined, true);
  result.assetId = objectIdString(body.assetId, 'Asset ID');
  result.locationId = objectIdString(body.locationId, 'Location ID');
  result.top_level_asset_id = objectIdString(body.top_level_asset_id, 'Top level asset ID');

  const alarmId = optionalPositiveInteger(body.alarmId, 'Alarm ID', ASSET_REPORT_LIMITS.alarmId);
  if (alarmId !== undefined) result.alarmId = alarmId;
  result.createdFrom = alarmId === undefined ? 'Asset Report' : 'Asset Alarm';
  return result;
}

export function sanitizeAssetReportUpdatePayload(
  input: unknown,
  existingFiles: unknown,
  accountId: unknown
): Record<string, any> {
  const body = requirePlainObject(input, 'Asset report payload');
  if (![...MUTABLE_FIELDS].some(field => Object.prototype.hasOwnProperty.call(body, field))) {
    throw badRequest('No supported asset report fields were provided');
  }
  return sanitizeMutableFields(body, accountId, existingFiles, false);
}

export function sanitizeAssetReportStatusPayload(input: unknown): {
  status: typeof ASSET_REPORT_STATUSES[number];
  observationId?: string;
} {
  const body = requirePlainObject(input, 'Asset report status payload');
  const result: { status: typeof ASSET_REPORT_STATUSES[number]; observationId?: string } = {
    status: enumValue(body.status, ASSET_REPORT_STATUSES, 'Status')
  };
  const observationId = optionalObjectIdString(body.observationId, 'Observation ID');
  if (observationId) result.observationId = observationId;
  return result;
}

function sanitizeMutableFields(
  body: Record<string, any>,
  accountId: unknown,
  existingFiles: unknown,
  requireAll: boolean
): Record<string, any> {
  const result: Record<string, any> = {};
  const assign = (field: string, valueFactory: () => any): void => {
    if (requireAll || Object.prototype.hasOwnProperty.call(body, field)) result[field] = valueFactory();
  };

  assign('Observations', () => sanitizeRichText(body.Observations, 'Observations'));
  assign('Recommendations', () => sanitizeRichText(body.Recommendations, 'Recommendations'));
  assign('CreateWorkRequest', () => enumValue(String(body.CreateWorkRequest), ['1', '2'] as const, 'Create work request'));
  assign('FaultDetected', () => enumValue(String(body.FaultDetected), ['1', '2'] as const, 'Fault detected'));
  assign('EquipmentHealth', () => enumValue(String(body.EquipmentHealth), ASSET_REPORT_HEALTH_VALUES, 'Equipment health'));
  assign('ISO', () => booleanValue(body.ISO, 'ISO'));
  assign('Severity', () => optionalString(body.Severity, 'Severity', 100));
  assign('NewFault', () => optionalString(body.NewFault, 'New fault', 100));
  assign('TrendOfAlarm', () => optionalString(body.TrendOfAlarm, 'Trend of alarm', 100));
  assign('files', () => sanitizeReportFiles(body.files, accountId, existingFiles));
  assign('faultData', () => sanitizeFaultData(body.faultData));
  assign('asset_health_history', () => sanitizeHealthHistory(body.asset_health_history));
  assign('endpointRMSData', () => sanitizeEndpointRms(body.endpointRMSData));
  assign('chartDetail', () => sanitizeChartDetails(body.chartDetail));
  assign('harmonicIndex', () => sanitizeHarmonicIndexes(body.harmonicIndex));
  return result;
}

function sanitizeRichText(value: unknown, label: string): string {
  const source = requiredString(value, label, ASSET_REPORT_LIMITS.richText * 2);
  const clean = sanitizeHtml(source, {
    allowedTags: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'ul', 'ol', 'li', 'blockquote',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'span', 'div', 'pre', 'code',
      'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr'
    ],
    allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (_tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          ...(attribs.target === '_blank' ? { rel: 'noopener noreferrer' } : {})
        }
      })
    }
  }).trim();
  const plainText = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/gi, ' ')
    .trim();
  if (!plainText) throw badRequest(`${label} must contain readable text`);
  if (clean.length > ASSET_REPORT_LIMITS.richText) {
    throw badRequest(`${label} must not exceed ${ASSET_REPORT_LIMITS.richText} characters`);
  }
  return clean;
}

function sanitizeFaultData(value: unknown): Array<{ name: string; value: number }> {
  const values = boundedArray(value, 'Fault data', ASSET_REPORT_LIMITS.faults);
  return values.map((entry, index) => {
    const item = requirePlainObject(entry, `Fault ${index + 1}`);
    return {
      name: requiredString(item.name, `Fault ${index + 1} name`, 100),
      value: integerValue(item.value, `Fault ${index + 1} value`, 1, 4)
    };
  });
}

function sanitizeHealthHistory(value: unknown): Array<{ date: string; status: string }> {
  const values = boundedArray(value, 'Asset health history', ASSET_REPORT_LIMITS.healthHistory);
  return values.map((entry, index) => {
    const item = requirePlainObject(entry, `Health history ${index + 1}`);
    return {
      date: optionalString(item.date, `Health history ${index + 1} date`, 50),
      status: enumValue(String(item.status), ASSET_REPORT_HEALTH_VALUES, `Health history ${index + 1} status`)
    };
  });
}

function sanitizeEndpointRms(value: unknown): Record<string, any>[] {
  const values = boundedArray(value, 'Endpoint RMS data', ASSET_REPORT_LIMITS.endpointRms);
  return values.map((entry, index) => {
    const item = requirePlainObject(entry, `Endpoint RMS ${index + 1}`);
    const result: Record<string, any> = {};
    copyOptionalBoolean(item, result, 'is_linked', `Endpoint RMS ${index + 1}`);
    copyOptionalBoolean(item, result, 'online', `Endpoint RMS ${index + 1}`);
    for (const field of [
      'composite_id', 'point_name', 'mount_location', 'mount_type', 'mount_material',
      'mount_direction', 'asset_id', 'org_id', 'mac_id', 'image', 'asset_type', 'asset_name'
    ]) {
      if (Object.prototype.hasOwnProperty.call(item, field)) {
        result[field] = optionalString(item[field], `Endpoint RMS ${index + 1} ${field}`, 500);
      }
    }
    for (const field of ['acceleration', 'velocity']) {
      if (Object.prototype.hasOwnProperty.call(item, field) && item[field] != null) {
        result[field] = sanitizeStructuredPayload(item[field], `Endpoint RMS ${index + 1} ${field}`, {
          maxBytes: 16 * 1024,
          maxDepth: 5,
          maxNodes: 100,
          maxStringLength: 500
        });
      }
    }
    return result;
  });
}

function sanitizeChartDetails(value: unknown): Record<string, any>[] {
  const values = boundedArray(value, 'Chart details', ASSET_REPORT_LIMITS.chartDetails);
  return values.map((entry, index) => {
    const item = requirePlainObject(entry, `Chart detail ${index + 1}`);
    const result: Record<string, any> = {
      composite_id: requiredString(item.composite_id, `Chart detail ${index + 1} composite ID`, 250),
      timestamp: scalarValue(item.timestamp, `Chart detail ${index + 1} timestamp`),
      axis: enumArray(item.axis, ['Axial', 'Horizontal', 'Vertical'] as const, `Chart detail ${index + 1} axes`, 3),
      type: enumArray(item.type, ['Acceleration', 'Velocity'] as const, `Chart detail ${index + 1} types`, 2),
      domain: enumArray(item.domain, ['time', 'frequency'] as const, `Chart detail ${index + 1} domains`, 2),
      chartName: stringArray(item.chartName, `Chart detail ${index + 1} chart names`, 10, 100)
    };
    if (item.compare_time !== undefined && item.compare_time !== null) {
      result.compare_time = integerValue(item.compare_time, `Chart detail ${index + 1} compare time`, 0, Number.MAX_SAFE_INTEGER);
    }
    return result;
  });
}

function sanitizeHarmonicIndexes(value: unknown): Record<string, any>[] {
  const values = boundedArray(value, 'Harmonic indexes', ASSET_REPORT_LIMITS.harmonicIndexes);
  return values.map((entry, index) => {
    const item = requirePlainObject(entry, `Harmonic index ${index + 1}`);
    return {
      chartType: requiredString(item.chartType, `Harmonic index ${index + 1} chart type`, 100),
      key: requiredString(item.key, `Harmonic index ${index + 1} key`, 250),
      index: sanitizeStructuredPayload(item.index ?? [], `Harmonic index ${index + 1} values`, {
        maxBytes: 64 * 1024,
        maxDepth: 8,
        maxNodes: 1000,
        maxStringLength: 500
      })
    };
  });
}

function sanitizeReportFiles(value: unknown, accountId: unknown, existingValue?: unknown): SanitizedReportFile[] {
  const source = extractFileArray(value);
  if (source.length > ASSET_REPORT_LIMITS.files) {
    throw badRequest(`A maximum of ${ASSET_REPORT_LIMITS.files} files is allowed`);
  }
  const existingKeys = new Set(extractFileArray(existingValue)
    .map((entry, index) => normalizeExistingFile(entry, index))
    .filter((entry): entry is SanitizedReportFile => Boolean(entry))
    .map(fileKey));
  const accountToken = String(accountId || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!accountToken) throw badRequest('Active account is required');

  const seen = new Set<string>();
  return source.map((entry, index) => {
    const normalized = normalizeFile(entry, index);
    const key = fileKey(normalized);
    if (seen.has(key)) throw badRequest(`File ${index + 1} is duplicated`);
    seen.add(key);
    const belongsToAccount = normalized.fileName.toLowerCase().includes(`-asset_report-${accountToken}-`);
    if (!existingKeys.has(key) && !belongsToAccount) {
      throw badRequest(`File ${index + 1} was not uploaded for the active account`);
    }
    return normalized;
  });
}

function extractFileArray(value: unknown): unknown[] {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value;
  const object = requirePlainObject(value, 'Files');
  const collection = Object.values(object).find(Array.isArray);
  if (!Array.isArray(collection)) throw badRequest('Files must be an array');
  return collection;
}

function normalizeExistingFile(entry: unknown, index: number): SanitizedReportFile | undefined {
  try {
    if (typeof entry === 'string') {
      const parsed = new URL(entry, 'https://asset-report.local');
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length < 2) return undefined;
      const fileName = decodeURIComponent(segments[segments.length - 1]);
      const folderName = segments[segments.length - 2];
      return normalizeFile({ fileName, folderName, type: typeFromFileName(fileName) }, index);
    }
    return normalizeFile(entry, index);
  } catch {
    return undefined;
  }
}

function normalizeFile(entry: unknown, index: number): SanitizedReportFile {
  const file = requirePlainObject(entry, `File ${index + 1}`);
  const fileName = optionalString(file.fileName ?? file.name, `File ${index + 1} name`, 255);
  if (!fileName || fileName !== fileName.split(/[\\/]/).pop() || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    throw badRequest(`File ${index + 1} has an invalid stored name`);
  }
  const expectedType = typeFromFileName(fileName);
  const declaredType = optionalString(file.type ?? file.mimeType, `File ${index + 1} type`, 100).toLowerCase();
  if (!expectedType || declaredType !== expectedType) throw badRequest(`File ${index + 1} has an invalid type`);
  const folderName = optionalString(file.folderName ?? file.container, `File ${index + 1} folder`, 50);
  if (folderName !== 'asset_report') throw badRequest(`File ${index + 1} must be uploaded to the asset_report folder`);

  const result: SanitizedReportFile = {
    originalName: optionalString(file.originalName, `File ${index + 1} original name`, 255) || fileName,
    type: expectedType,
    folderName: 'asset_report',
    fileName
  };
  if (file.size !== undefined && file.size !== null) {
    const size = Number(file.size);
    if (!Number.isSafeInteger(size) || size < 1 || size > ASSET_REPORT_LIMITS.fileSize) {
      throw badRequest(`File ${index + 1} has an invalid size`);
    }
    result.size = size;
  }
  return result;
}

function typeFromFileName(fileName: string): ReportFileType | undefined {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? MIME_BY_EXTENSION[fileName.slice(dot).toLowerCase()] : undefined;
}

function fileKey(file: SanitizedReportFile): string {
  return `${file.folderName}/${file.fileName}`.toLowerCase();
}

function boundedArray(value: unknown, label: string, maxItems: number): unknown[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array`);
  if (value.length > maxItems) throw badRequest(`${label} cannot contain more than ${maxItems} items`);
  return value;
}

function stringArray(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  return Array.from(new Set(boundedArray(value, label, maxItems)
    .map((item, index) => requiredString(item, `${label} item ${index + 1}`, maxLength))));
}

function enumArray<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
  maxItems: number
): T[number][] {
  return Array.from(new Set(boundedArray(value, label, maxItems)
    .map((item, index) => enumValue(item, allowed, `${label} item ${index + 1}`))));
}

function scalarValue(value: unknown, label: string): string | number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return requiredString(value, label, 100);
}

function booleanValue(value: unknown, label: string): boolean {
  if (typeof value !== 'boolean') throw badRequest(`${label} must be a boolean`);
  return value;
}

function copyOptionalBoolean(source: Record<string, any>, target: Record<string, any>, field: string, label: string): void {
  if (!Object.prototype.hasOwnProperty.call(source, field) || source[field] === null) return;
  target[field] = booleanValue(source[field], `${label} ${field}`);
}

function integerValue(value: unknown, label: string, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw badRequest(`${label} is invalid`);
  return parsed;
}

function optionalPositiveInteger(value: unknown, label: string, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return integerValue(value, label, 1, max);
}

function objectIdString(value: unknown, label: string): string {
  const normalized = requiredString(value, label, 24).toLowerCase();
  if (!/^[a-f0-9]{24}$/.test(normalized)) throw badRequest(`${label} is invalid`);
  return normalized;
}

function optionalObjectIdString(value: unknown, label: string): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  return objectIdString(value, label);
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const normalized = requiredString(value, label, 100);
  if (!allowed.includes(normalized as T[number])) throw badRequest(`${label} is invalid`);
  return normalized as T[number];
}

function requiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`);
  const normalized = value.trim();
  if (!normalized) throw badRequest(`${label} is required`);
  if (normalized.length > maxLength) throw badRequest(`${label} must not exceed ${maxLength} characters`);
  return normalized;
}

function optionalString(value: unknown, label: string, maxLength: number): string {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') throw badRequest(`${label} must be a string`);
  const normalized = value.trim();
  if (normalized.length > maxLength) throw badRequest(`${label} must not exceed ${maxLength} characters`);
  return normalized;
}

function requirePlainObject(value: unknown, label: string): Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw badRequest(`${label} must be an object`);
  }
  return value as Record<string, any>;
}

function badRequest(message: string): Error {
  return Object.assign(new Error(message), { status: 400 });
}
