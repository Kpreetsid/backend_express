import { afterEach, describe, expect, it } from 'vitest';
import { assetReportPdfJobConfig } from '../../configDB';
import {
  buildAssetReportPdfPayload,
  createInlineChartImages,
  normalizeChartManifest,
  selectPdfRequestPayload,
  validateChartImageBuffer
} from './asset-pdf-request';

describe('asset-report PDF request validation', () => {
  const originalMaxRequestBytes = assetReportPdfJobConfig.maxRequestBytes;

  afterEach(() => {
    assetReportPdfJobConfig.maxRequestBytes = originalMaxRequestBytes;
  });

  it('selects only supported rendering fields and enforces the configured size bound', () => {
    expect(selectPdfRequestPayload({
      labels: { title: 'Report' },
      timezone: 'UTC',
      accountId: 'must-not-survive'
    })).toEqual(expect.objectContaining({
      labels: { title: 'Report' },
      timezone: 'UTC'
    }));
    expect(selectPdfRequestPayload({
      labels: {},
      accountId: 'must-not-survive'
    })).not.toHaveProperty('accountId');

    assetReportPdfJobConfig.maxRequestBytes = 16;
    expect(() => selectPdfRequestPayload({ labels: { title: 'too large' } }))
      .toThrow('PDF request payload is too large');
  });

  it('rejects unsafe nested keys and mismatched chart manifests', () => {
    const unsafe = JSON.parse('{"labels":{"__proto__":{"polluted":true}}}');
    expect(() => selectPdfRequestPayload(unsafe)).toThrow('unsafe key');
    expect(() => normalizeChartManifest('[]', 1))
      .toThrow('Chart image manifest does not match uploaded files');
  });

  it('validates file signatures and rejects active SVG content', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => validateChartImageBuffer('image/png', png)).not.toThrow();
    expect(() => validateChartImageBuffer('image/png', Buffer.from('not-png')))
      .toThrow('does not match');
    expect(() => validateChartImageBuffer(
      'image/svg+xml',
      Buffer.from('<svg><script>alert(1)</script></svg>')
    )).toThrow('does not match');
  });

  it('creates ordered inline snapshots and reconstructs server-owned report fields', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const images = createInlineChartImages([{
      fieldname: 'chartImages',
      originalname: 'chart.png',
      encoding: '7bit',
      mimetype: 'image/png',
      size: png.length,
      buffer: png,
      stream: undefined as never,
      destination: '',
      filename: '',
      path: ''
    }], JSON.stringify([{ key: 'trend', order: 2 }]));
    expect(images[0]).toEqual(expect.objectContaining({
      key: 'trend',
      mimeType: 'image/png',
      dataUri: expect.stringMatching(/^data:image\/png;base64,/)
    }));

    const payload = buildAssetReportPdfPayload({
      assetId: { asset_name: 'Server Pump' },
      endpointRMSData: [],
      files: [],
      Observations: 'Observed',
      Recommendations: ''
    }, { labels: { title: 'PDF' } }, images);
    expect(payload).toEqual(expect.objectContaining({
      assetName: 'Server Pump',
      observations: 'Observed',
      recommendations: null,
      frontendChartImages: images
    }));
  });
});
