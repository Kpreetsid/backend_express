import { createHash } from 'node:crypto';
import { assetReportPdfJobConfig, storageConfig } from '../../configDB';

export interface FrontendChartImage {
  key: string;
  title: string;
  order: number;
  width?: number;
  height?: number;
  mimeType: string;
  size: number;
  dataUri: string;
}

export interface ChartManifestItem {
  key: string;
  title: string;
  order: number;
  width?: number;
  height?: number;
}

const allowedChartMimeTypes = new Set(['image/png', 'image/jpeg', 'image/svg+xml']);
const unsafeJsonKeys = new Set(['__proto__', 'prototype', 'constructor']);

export const parsePdfJsonField = <T>(value: unknown, fallback: T): T => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') return value as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    throw Object.assign(new Error('Invalid PDF request payload'), { status: 400 });
  }
};

const validateJsonValue = (value: unknown, depth = 0): void => {
  if (depth > 12) {
    throw Object.assign(new Error('PDF request payload is too deeply nested'), { status: 400 });
  }
  if (
    value === undefined
    || value === null
    || ['string', 'number', 'boolean'].includes(typeof value)
  ) return;
  if (Array.isArray(value)) {
    if (value.length > 2000) {
      throw Object.assign(new Error('PDF request payload contains too many items'), { status: 400 });
    }
    value.forEach((item) => validateJsonValue(item, depth + 1));
    return;
  }
  if (typeof value !== 'object') {
    throw Object.assign(new Error('PDF request payload contains an unsupported value'), { status: 400 });
  }
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (unsafeJsonKeys.has(key)) {
      throw Object.assign(new Error('PDF request payload contains an unsafe key'), { status: 400 });
    }
    validateJsonValue(nested, depth + 1);
  }
};

export const selectPdfRequestPayload = (body: any): Record<string, unknown> => {
  const selected = {
    labels: body?.labels || {},
    timezone: body?.timezone,
    locale: body?.locale || body?.labels?.locale,
    assetCondition: body?.assetCondition,
    faultData: body?.faultData || [],
    chartOptions: body?.chartOptions || {},
    chartStates: body?.chartStates || {}
  };
  validateJsonValue(selected);
  const serialized = JSON.stringify(selected);
  if (Buffer.byteLength(serialized, 'utf8') > assetReportPdfJobConfig.maxRequestBytes) {
    throw Object.assign(new Error('PDF request payload is too large'), { status: 413 });
  }
  return selected;
};

export const normalizeChartManifest = (
  value: unknown,
  fileCount: number
): ChartManifestItem[] => {
  const manifest = parsePdfJsonField<any[]>(value, []);
  if (!fileCount && !manifest.length) return [];
  if (!Array.isArray(manifest) || manifest.length !== fileCount) {
    throw Object.assign(new Error('Chart image manifest does not match uploaded files'), { status: 400 });
  }
  return manifest.map((item, index) => ({
    key: typeof item?.key === 'string' ? item.key.slice(0, 200) : `chart-${index + 1}`,
    title: typeof item?.title === 'string' ? item.title.slice(0, 500) : '',
    order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index,
    ...(Number.isFinite(Number(item?.width)) ? { width: Number(item.width) } : {}),
    ...(Number.isFinite(Number(item?.height)) ? { height: Number(item.height) } : {})
  }));
};

export const validateChartImageBuffer = (mimeType: string, buffer: Buffer): void => {
  if (!allowedChartMimeTypes.has(mimeType)) {
    throw Object.assign(new Error('Only SVG, PNG, and JPEG chart snapshots are allowed'), { status: 400 });
  }
  const isPng = mimeType === 'image/png'
    && buffer.length >= 8
    && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = mimeType === 'image/jpeg'
    && buffer.length >= 3
    && buffer[0] === 0xff
    && buffer[1] === 0xd8
    && buffer[2] === 0xff;
  const svg = mimeType === 'image/svg+xml' ? buffer.toString('utf8').trim() : '';
  const isSvg = mimeType === 'image/svg+xml'
    && /^(?:<\?xml[\s\S]*?\?>\s*)?<svg[\s>]/i.test(svg)
    && !/<script[\s>]/i.test(svg)
    && !/\son[a-z]+\s*=/i.test(svg)
    && !/javascript\s*:/i.test(svg);
  if (!isPng && !isJpeg && !isSvg) {
    throw Object.assign(new Error('Chart image content does not match its declared type'), { status: 400 });
  }
};

export const validateChartImage = (file: Express.Multer.File): void =>
  validateChartImageBuffer(file.mimetype, file.buffer);

export const createInlineChartImages = (
  files: Express.Multer.File[],
  manifestValue: unknown
): FrontendChartImage[] => {
  const manifest = normalizeChartManifest(manifestValue, files.length);
  return files.map((file, index) => {
    validateChartImage(file);
    return {
      ...manifest[index]!,
      mimeType: file.mimetype,
      size: file.size,
      dataUri: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
    };
  }).sort((left, right) => left.order - right.order);
};

export const checksumChartImage = (buffer: Buffer): string =>
  createHash('sha256').update(buffer).digest('hex');

export const buildAssetReportPdfPayload = (
  report: any,
  requestPayload: Record<string, any>,
  frontendChartImages: FrontendChartImage[]
): Record<string, unknown> => ({
  ...requestPayload,
  assetName: report.assetId?.asset_name || report.assetName || 'NA',
  assetImage: report.assetId?.image_path || report.assetImage || null,
  analysisDate: report.createdOn,
  location: report.locationId?.location_name || report.locationName || 'NA',
  sensorsMapped: report.endpointRMSData?.length || 0,
  conditionClass: report.EquipmentHealth,
  observations: report.Observations && report.Observations.trim() ? report.Observations : null,
  recommendations: report.Recommendations && report.Recommendations.trim() ? report.Recommendations : null,
  iso: report.ISO,
  healthHistory: report.asset_health_history || [],
  createdFrom: report.createdFrom || 'Asset Report',
  chartDetail: report.chartDetail || [],
  harmonicIndex: report.harmonicIndex || [],
  frontendChartImages,
  readings: (report.endpointRMSData || []).map((point: any) => {
    const getTimestamp = (source: any) =>
      source?.Axial?.timestamp || source?.Horizontal?.timestamp || source?.Vertical?.timestamp;
    return {
      point: `${point.asset_name} > ${point.point_name}-${point.mount_location}`,
      compositeId: point.composite_id || '',
      timestamp: getTimestamp(point?.acceleration) || getTimestamp(point?.velocity) || null,
      acceleration: {
        h: point?.acceleration?.Horizontal?.rms ?? '-',
        v: point?.acceleration?.Vertical?.rms ?? '-',
        a: point?.acceleration?.Axial?.rms ?? '-'
      },
      velocity: {
        h: point?.velocity?.Horizontal?.rms ?? '-',
        v: point?.velocity?.Vertical?.rms ?? '-',
        a: point?.velocity?.Axial?.rms ?? '-'
      }
    };
  }),
  attachments: (report.files || []).map((image: any) =>
    image.folderName
      ? `${storageConfig.baseUrl}/${image.folderName}/${image.fileName}`
      : `${storageConfig.baseUrl}/${image.fileName}`
  )
});
