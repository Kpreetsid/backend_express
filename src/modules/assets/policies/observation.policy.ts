import sanitizeHtml from 'sanitize-html';

export const OBSERVATION_STATUSES = ['Critical', 'Danger', 'Alert', 'Healthy', 'Not Defined'] as const;

export const OBSERVATION_LIMITS = Object.freeze({
  richText: 50_000,
  faults: 25,
  faultLength: 100,
  files: 12,
  fileSize: 5 * 1024 * 1024,
  alarmId: 2_147_483_647
});

export interface SanitizedObservationFile {
  originalName: string;
  type: 'image/jpeg' | 'image/png' | 'application/pdf';
  folderName: 'observations';
  fileName: string;
  size?: number;
}

export interface SanitizedObservationCreatePayload {
  observation: string;
  recommendation: string;
  status: typeof OBSERVATION_STATUSES[number];
  faults: string[];
  files: SanitizedObservationFile[];
  assetId: string;
  locationId: string;
  top_level_asset_id: string;
  report_id?: string;
  alarmId?: number;
}

export type SanitizedObservationUpdatePayload = Pick<
  SanitizedObservationCreatePayload,
  'observation' | 'recommendation' | 'status' | 'faults' | 'files'
>;

const UPDATE_FIELDS = ['observation', 'recommendation', 'status', 'faults', 'files'] as const;
const MIME_BY_EXTENSION: Readonly<Record<string, SanitizedObservationFile['type']>> = Object.freeze({
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png'
});

export function sanitizeObservationCreatePayload(
  input: unknown,
  accountId: unknown
): SanitizedObservationCreatePayload {
  const body = requirePlainObject(input, 'Observation payload');
  const payload: SanitizedObservationCreatePayload = {
    observation: sanitizeRichText(body.observation, 'Observation'),
    recommendation: sanitizeRichText(body.recommendation, 'Recommendation'),
    status: enumValue(body.status, OBSERVATION_STATUSES, 'Status'),
    faults: stringArray(body.faults, 'Faults', OBSERVATION_LIMITS.faults, OBSERVATION_LIMITS.faultLength),
    files: sanitizeObservationFiles(body.files, accountId),
    assetId: objectIdString(body.assetId, 'Asset ID'),
    locationId: objectIdString(body.locationId, 'Location ID'),
    top_level_asset_id: objectIdString(body.top_level_asset_id, 'Top level asset ID')
  };

  const reportId = optionalObjectIdString(body.report_id, 'Report ID');
  const alarmId = optionalPositiveInteger(body.alarmId, 'Alarm ID', OBSERVATION_LIMITS.alarmId);
  if (reportId) payload.report_id = reportId;
  if (alarmId !== undefined) payload.alarmId = alarmId;
  return payload;
}

export function sanitizeObservationUpdatePayload(
  input: unknown,
  existingFiles: unknown,
  accountId: unknown
): SanitizedObservationUpdatePayload {
  const body = requirePlainObject(input, 'Observation payload');
  if (!UPDATE_FIELDS.some(field => Object.prototype.hasOwnProperty.call(body, field))) {
    throw badRequest('No supported observation fields were provided');
  }

  return {
    observation: sanitizeRichText(body.observation, 'Observation'),
    recommendation: sanitizeRichText(body.recommendation, 'Recommendation'),
    status: enumValue(body.status, OBSERVATION_STATUSES, 'Status'),
    faults: stringArray(body.faults, 'Faults', OBSERVATION_LIMITS.faults, OBSERVATION_LIMITS.faultLength),
    files: sanitizeObservationFiles(body.files, accountId, existingFiles)
  };
}

function sanitizeRichText(value: unknown, label: string): string {
  const source = requiredString(value, label, OBSERVATION_LIMITS.richText * 2);
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
  if (clean.length > OBSERVATION_LIMITS.richText) {
    throw badRequest(`${label} must not exceed ${OBSERVATION_LIMITS.richText} characters`);
  }
  return clean;
}

function sanitizeObservationFiles(
  value: unknown,
  accountId: unknown,
  existingValue?: unknown
): SanitizedObservationFile[] {
  const source = extractFileArray(value);
  if (source.length > OBSERVATION_LIMITS.files) {
    throw badRequest(`A maximum of ${OBSERVATION_LIMITS.files} files is allowed`);
  }

  const existingKeys = new Set(extractFileArray(existingValue)
    .map((entry, index) => normalizeExistingFile(entry, index))
    .filter((entry): entry is SanitizedObservationFile => Boolean(entry))
    .map(fileKey));
  const accountToken = String(accountId || '').replace(/[^a-zA-Z0-9_-]/g, '').toLowerCase();
  if (!accountToken) throw badRequest('Active account is required');

  const seen = new Set<string>();
  return source.map((entry, index) => {
    const normalized = normalizeFile(entry, index);
    const key = fileKey(normalized);
    if (seen.has(key)) throw badRequest(`File ${index + 1} is duplicated`);
    seen.add(key);

    const belongsToAccount = normalized.fileName.toLowerCase().includes(`-${accountToken}-`);
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

function normalizeExistingFile(entry: unknown, index: number): SanitizedObservationFile | undefined {
  try {
    if (typeof entry === 'string') {
      const parsed = new URL(entry, 'https://observation.local');
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

function normalizeFile(entry: unknown, index: number): SanitizedObservationFile {
  const file = requirePlainObject(entry, `File ${index + 1}`);
  const fileName = optionalString(file.fileName ?? file.name, `File ${index + 1} name`, 255);
  if (!fileName || fileName !== fileName.split(/[\\/]/).pop() || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
    throw badRequest(`File ${index + 1} has an invalid stored name`);
  }

  const expectedType = typeFromFileName(fileName);
  const declaredType = optionalString(file.type ?? file.mimeType, `File ${index + 1} type`, 100).toLowerCase();
  if (!expectedType || declaredType !== expectedType) throw badRequest(`File ${index + 1} has an invalid type`);
  const folderName = optionalString(file.folderName ?? file.container, `File ${index + 1} folder`, 50);
  if (folderName !== 'observations') {
    throw badRequest(`File ${index + 1} must be uploaded to the observations folder`);
  }

  const result: SanitizedObservationFile = {
    originalName: optionalString(file.originalName, `File ${index + 1} original name`, 255) || fileName,
    type: expectedType,
    folderName: 'observations',
    fileName
  };
  if (file.size !== undefined && file.size !== null) {
    const size = Number(file.size);
    if (!Number.isSafeInteger(size) || size < 1 || size > OBSERVATION_LIMITS.fileSize) {
      throw badRequest(`File ${index + 1} has an invalid size`);
    }
    result.size = size;
  }
  return result;
}

function typeFromFileName(fileName: string): SanitizedObservationFile['type'] | undefined {
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? MIME_BY_EXTENSION[fileName.slice(dot).toLowerCase()] : undefined;
}

function fileKey(file: SanitizedObservationFile): string {
  return `${file.folderName}/${file.fileName}`.toLowerCase();
}

function stringArray(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array`);
  if (value.length > maxItems) throw badRequest(`${label} cannot contain more than ${maxItems} items`);
  return Array.from(new Set(value.map((item, index) => requiredString(item, `${label} item ${index + 1}`, maxLength))));
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

function optionalPositiveInteger(value: unknown, label: string, max: number): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) throw badRequest(`${label} is invalid`);
  return parsed;
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
