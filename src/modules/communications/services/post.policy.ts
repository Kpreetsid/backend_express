import sanitizeHtml from 'sanitize-html';

export const POST_TYPES = ['General', 'Maintenance', 'Quality', 'Breakdown', 'Kaizen/improvement'] as const;
export const POST_TOPICS = ['Assets', 'Locations', 'Products', 'Material', 'Method', 'Scan', 'Other'] as const;
export const POST_STATUSES = ['Draft', 'Pending Review', 'Approved', 'Published', 'Scheduled', 'Archived', 'Rejected', 'Expired'] as const;
export const POST_VISIBILITIES = ['Account', 'Locations'] as const;

export const POST_LIMITS = Object.freeze({
  title: 160,
  subtitle: 240,
  description: 50_000,
  slug: 160,
  seoTitle: 70,
  seoDescription: 160,
  tagCount: 10,
  keywordCount: 10,
  tagLength: 40,
  reviewNote: 1_000,
  publishTo: 100,
  files: 12,
  fileSize: 5 * 1024 * 1024
});

export interface SanitizedPostFile {
  originalName: string;
  type: 'image/jpeg' | 'image/png' | 'application/pdf';
  folderName: 'posts';
  fileName: string;
  size?: number;
}

export interface SanitizedPostPayload {
  title: string;
  subtitle: string;
  postType: typeof POST_TYPES[number];
  relatedTo: typeof POST_TOPICS[number];
  tags: string[];
  description: string;
  files: SanitizedPostFile[];
  publishTo: string[];
  status: typeof POST_STATUSES[number];
  visibility: typeof POST_VISIBILITIES[number];
  featured: boolean;
  pinned: boolean;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  scheduledAt: Date | null;
  commentsEnabled: boolean;
  reviewNote: string;
  help: boolean;
}

const ALLOWED_INPUT_FIELDS = new Set([
  'title', 'subtitle', 'postType', 'relatedTo', 'tags', 'description', 'files', 'publishTo',
  'status', 'visibility', 'featured', 'pinned', 'slug', 'seoTitle', 'seoDescription',
  'keywords', 'scheduledAt', 'commentsEnabled', 'reviewNote', 'help'
]);

const MIME_BY_EXTENSION: Readonly<Record<string, SanitizedPostFile['type']>> = Object.freeze({
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.png': 'image/png'
});

export function sanitizePostPayload(input: unknown): SanitizedPostPayload {
  const body = requirePlainObject(input, 'Post payload');
  const supportedKeys = Object.keys(body).filter(key => ALLOWED_INPUT_FIELDS.has(key));
  if (!supportedKeys.length) throw badRequest('No supported post fields were provided');

  const title = requiredString(body.title, 'Title', POST_LIMITS.title);
  const postType = enumValue(body.postType ?? 'General', POST_TYPES, 'Post type');
  const relatedTo = enumValue(body.relatedTo ?? 'Other', POST_TOPICS, 'Related to');
  const description = sanitizeDescription(requiredString(body.description, 'Description', POST_LIMITS.description));
  const visibility = enumValue(body.visibility ?? 'Account', POST_VISIBILITIES, 'Visibility');
  const status = enumValue(body.status ?? 'Published', POST_STATUSES, 'Status');
  const publishTo = stringArray(body.publishTo, 'Publish to', POST_LIMITS.publishTo, 24);

  if (visibility === 'Locations' && !publishTo.length) {
    throw badRequest('At least one location is required for location visibility');
  }

  return {
    title,
    subtitle: optionalString(body.subtitle, 'Subtitle', POST_LIMITS.subtitle),
    postType,
    relatedTo,
    tags: stringArray(body.tags, 'Tags', POST_LIMITS.tagCount, POST_LIMITS.tagLength),
    description,
    files: sanitizeFiles(body.files),
    publishTo: visibility === 'Locations' ? publishTo : [],
    status,
    visibility,
    featured: optionalBoolean(body.featured, 'Featured', false),
    pinned: optionalBoolean(body.pinned, 'Pinned', false),
    slug: sanitizeSlug(optionalString(body.slug, 'Slug', POST_LIMITS.slug)),
    seoTitle: optionalString(body.seoTitle, 'SEO title', POST_LIMITS.seoTitle),
    seoDescription: optionalString(body.seoDescription, 'SEO description', POST_LIMITS.seoDescription),
    keywords: stringArray(body.keywords, 'Keywords', POST_LIMITS.keywordCount, POST_LIMITS.tagLength),
    scheduledAt: status === 'Scheduled' ? optionalDate(body.scheduledAt, 'Scheduled date') : null,
    commentsEnabled: optionalBoolean(body.commentsEnabled, 'Comments enabled', true),
    reviewNote: optionalString(body.reviewNote, 'Review note', POST_LIMITS.reviewNote),
    help: optionalBoolean(body.help, 'Help', false)
  };
}

function sanitizeDescription(value: string): string {
  const clean = sanitizeHtml(value, {
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
  if (!plainText) throw badRequest('Description must contain readable text');
  if (clean.length > POST_LIMITS.description) throw badRequest(`Description must not exceed ${POST_LIMITS.description} characters`);
  return clean;
}

function sanitizeFiles(value: unknown): SanitizedPostFile[] {
  if (value === undefined || value === null) return [];
  const source = Array.isArray(value)
    ? value
    : Object.values(requirePlainObject(value, 'Files')).find(Array.isArray) || [];
  if (!Array.isArray(source)) throw badRequest('Files must be an array');
  if (source.length > POST_LIMITS.files) throw badRequest(`A maximum of ${POST_LIMITS.files} files is allowed`);

  const seen = new Set<string>();
  return source.map((entry, index) => {
    const file = requirePlainObject(entry, `File ${index + 1}`);
    const fileName = optionalString(file.fileName ?? file.name, `File ${index + 1} name`, 255);
    if (!fileName || fileName !== fileName.split(/[\\/]/).pop() || !/^[a-zA-Z0-9._-]+$/.test(fileName)) {
      throw badRequest(`File ${index + 1} has an invalid stored name`);
    }
    const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase();
    const expectedType = MIME_BY_EXTENSION[extension];
    const declaredType = optionalString(file.type, `File ${index + 1} type`, 100).toLowerCase();
    if (!expectedType || declaredType !== expectedType) throw badRequest(`File ${index + 1} has an invalid type`);
    const folderName = optionalString(file.folderName ?? file.container, `File ${index + 1} folder`, 50);
    if (folderName !== 'posts') throw badRequest(`File ${index + 1} must be uploaded to the posts folder`);
    const key = fileName.toLowerCase();
    if (seen.has(key)) throw badRequest(`File ${index + 1} is duplicated`);
    seen.add(key);

    const result: SanitizedPostFile = {
      originalName: optionalString(file.originalName, `File ${index + 1} original name`, 255) || fileName,
      type: expectedType,
      folderName: 'posts',
      fileName
    };
    if (file.size !== undefined && file.size !== null) {
      const size = Number(file.size);
      if (!Number.isSafeInteger(size) || size < 1 || size > POST_LIMITS.fileSize) {
        throw badRequest(`File ${index + 1} has an invalid size`);
      }
      result.size = size;
    }
    return result;
  });
}

function stringArray(value: unknown, label: string, maxItems: number, maxLength: number): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw badRequest(`${label} must be an array`);
  if (value.length > maxItems) throw badRequest(`${label} cannot contain more than ${maxItems} items`);
  const normalized = value.map((item, index) => requiredString(item, `${label} item ${index + 1}`, maxLength));
  return Array.from(new Set(normalized));
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

function optionalBoolean(value: unknown, label: string, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== 'boolean') throw badRequest(`${label} must be a boolean`);
  return value;
}

function optionalDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === '') return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) throw badRequest(`${label} must be a valid date`);
  return date;
}

function enumValue<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
  const normalized = requiredString(value, label, 100);
  if (!allowed.includes(normalized as T[number])) throw badRequest(`${label} is invalid`);
  return normalized as T[number];
}

function sanitizeSlug(value: string): string {
  if (!value) return '';
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw badRequest('Slug must contain lowercase letters, numbers and single hyphens only');
  }
  return value;
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
