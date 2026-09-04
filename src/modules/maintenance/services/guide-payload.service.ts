const GUIDE_TAGS = ['General Info', 'Maintenance', 'Quality', 'Safety', 'Production'] as const;
const MAX_STEPS = 25;
const MAX_IMAGE_DATA_LENGTH = 2_800_000;
const MAX_DECODED_IMAGE_SIZE = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_DATA_LENGTH = 10_000_000;
const DATA_IMAGE_PATTERN = /^data:image\/(png|jpe?g|webp);base64,[a-z\d+/=\r\n]+$/i;

type GuidePayloadKind = 'instruction' | 'troubleshooting';

const isPlainObject = (value: unknown): value is Record<string, any> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const boundedText = (value: unknown, field: string, maxLength: number, required = false): string => {
  if (value === undefined || value === null) {
    if (required) throw Object.assign(new Error(`${field} is required`), { status: 400 });
    return '';
  }
  if (typeof value !== 'string') {
    throw Object.assign(new Error(`${field} must be a string`), { status: 400 });
  }
  const normalized = value.trim();
  if (required && !normalized) {
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  }
  if (normalized.length > maxLength) {
    throw Object.assign(new Error(`${field} must not exceed ${maxLength} characters`), { status: 400 });
  }
  return normalized;
};

const normalizeImage = (value: unknown, stepIndex: number): { file: string; type: string }[] => {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 1) {
    throw Object.assign(new Error(`Step ${stepIndex + 1} may contain at most one image`), { status: 400 });
  }
  if (value.length === 0) return [];
  const image = value[0];
  if (!isPlainObject(image) || typeof image.file !== 'string' ||
      image.file.length > MAX_IMAGE_DATA_LENGTH || !DATA_IMAGE_PATTERN.test(image.file)) {
    throw Object.assign(new Error(`Step ${stepIndex + 1} contains an invalid or oversized image`), { status: 400 });
  }
  const subtype = image.file.slice(11, image.file.indexOf(';')).toLowerCase().replace('jpg', 'jpeg');
  const encoded = image.file.slice(image.file.indexOf(',') + 1).replace(/[\r\n]/g, '');
  const decoded = Buffer.from(encoded, 'base64');
  const isPng = subtype === 'png' && decoded.length >= 8 && decoded.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'));
  const isJpeg = subtype === 'jpeg' && decoded.length >= 3 && decoded[0] === 0xff && decoded[1] === 0xd8 && decoded[2] === 0xff;
  const isWebp = subtype === 'webp' && decoded.length >= 12 &&
    decoded.subarray(0, 4).toString('ascii') === 'RIFF' && decoded.subarray(8, 12).toString('ascii') === 'WEBP';
  if (decoded.length === 0 || decoded.length > MAX_DECODED_IMAGE_SIZE || (!isPng && !isJpeg && !isWebp)) {
    throw Object.assign(new Error(`Step ${stepIndex + 1} contains an invalid or oversized image`), { status: 400 });
  }
  return [{ file: image.file, type: `image/${subtype}` }];
};

const normalizeSteps = (value: unknown, kind: GuidePayloadKind): any[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_STEPS) {
    throw Object.assign(new Error(`A guide must contain between 1 and ${MAX_STEPS} steps`), { status: 400 });
  }
  let totalImageLength = 0;
  return value.map((step, index) => {
    if (!isPlainObject(step)) {
      throw Object.assign(new Error(`Step ${index + 1} must be an object`), { status: 400 });
    }
    const image = normalizeImage(step.image ?? step.files, index);
    totalImageLength += image[0]?.file.length || 0;
    if (totalImageLength > MAX_TOTAL_IMAGE_DATA_LENGTH) {
      throw Object.assign(new Error('Guide images exceed the total size limit'), { status: 400 });
    }
    const normalized: any = {
      title: boundedText(step.title, `Step ${index + 1} title`, 160, true),
      description: boundedText(step.description, `Step ${index + 1} description`, 5000, true),
      id: index + 1,
      Position: index + 1
    };
    if (kind === 'instruction') {
      normalized.image = image;
    } else {
      normalized.image = image;
    }
    return normalized;
  });
};

const normalizeContext = (value: Record<string, any>): { assetId?: string; locationId?: string } => {
  const assetId = value.assetId === undefined || value.assetId === null || value.assetId === ''
    ? undefined
    : String(value.assetId);
  const locationId = value.locationId === undefined || value.locationId === null || value.locationId === ''
    ? undefined
    : String(value.locationId);
  if ((assetId ? 1 : 0) + (locationId ? 1 : 0) !== 1) {
    throw Object.assign(new Error('Exactly one asset or location is required'), { status: 400 });
  }
  if (assetId && !/^[a-f\d]{24}$/i.test(assetId)) {
    throw Object.assign(new Error('Invalid asset ID'), { status: 400 });
  }
  if (locationId && !/^[a-f\d]{24}$/i.test(locationId)) {
    throw Object.assign(new Error('Invalid location ID'), { status: 400 });
  }
  return assetId ? { assetId } : { locationId };
};

export const sanitizeInstructionPayload = (value: unknown): Record<string, any> => {
  if (!isPlainObject(value)) {
    throw Object.assign(new Error('Work instruction payload is required'), { status: 400 });
  }
  const tag = boundedText(value.tag, 'Tag', 40) || 'General Info';
  if (!GUIDE_TAGS.includes(tag as any)) {
    throw Object.assign(new Error('Invalid work instruction tag'), { status: 400 });
  }
  return {
    title: boundedText(value.title, 'Title', 160, true),
    tag,
    description: boundedText(value.description, 'Description', 2000),
    WI_steps: normalizeSteps(value.WI_steps, 'instruction'),
    ...normalizeContext(value)
  };
};

export const sanitizeTroubleshootingPayload = (value: unknown): Record<string, any> => {
  if (!isPlainObject(value)) {
    throw Object.assign(new Error('Troubleshooting guide payload is required'), { status: 400 });
  }
  const tags = boundedText(value.tags ?? value.tag, 'Tag', 40) || 'General Info';
  if (!GUIDE_TAGS.includes(tags as any)) {
    throw Object.assign(new Error('Invalid troubleshooting guide tag'), { status: 400 });
  }
  return {
    title: boundedText(value.title, 'Title', 160, true),
    description: boundedText(value.description, 'Description', 2000),
    tags,
    troubleshooting_steps: normalizeSteps(value.troubleshooting_steps, 'troubleshooting'),
    ...normalizeContext(value)
  };
};

export const GUIDE_LIMITS = Object.freeze({
  maxSteps: MAX_STEPS,
  maxImageDataLength: MAX_IMAGE_DATA_LENGTH,
  maxTotalImageDataLength: MAX_TOTAL_IMAGE_DATA_LENGTH
});
