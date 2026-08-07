import { afterEach, describe, expect, it, vi } from 'vitest';
import { storageProvider } from '../../_config/storage';
import { uploadMetadataService } from '../../upload/upload-metadata.service';
import { PdfService } from './asset-pdf.service';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('asset PDF tenant image loading', () => {
  const accountId = '507f1f77bcf86cd799439011';

  const render = async (data: Record<string, unknown>): Promise<string> => {
    const service = new PdfService();
    vi.spyOn(service as any, 'getEchartsScript').mockReturnValue('');
    return (service as any).buildHtml({
      assetName: 'Pump 1',
      chartData: {},
      readings: [],
      faultData: [],
      ...data
    }, accountId);
  };

  it('loads asset and attachment images through tenant-checked storage keys', async () => {
    vi.spyOn(uploadMetadataService, 'assertTenantOwnership').mockResolvedValue();
    vi.spyOn(storageProvider, 'readBuffer')
      .mockResolvedValueOnce(Buffer.from('asset-image'))
      .mockResolvedValueOnce(Buffer.from('attachment-image'));

    const html = await render({
      assetImage: 'https://files.example/assets/pump.png?signature=test',
      attachments: ['https://files.example/reports/inspection.jpg?signature=test']
    });

    expect(uploadMetadataService.assertTenantOwnership)
      .toHaveBeenNthCalledWith(1, accountId, 'pump.png', 'assets');
    expect(uploadMetadataService.assertTenantOwnership)
      .toHaveBeenNthCalledWith(2, accountId, 'inspection.jpg', 'reports');
    expect(storageProvider.readBuffer).toHaveBeenNthCalledWith(1, 'pump.png', 'assets');
    expect(storageProvider.readBuffer).toHaveBeenNthCalledWith(2, 'inspection.jpg', 'reports');
    expect(html).toContain(`data:image/png;base64,${Buffer.from('asset-image').toString('base64')}`);
    expect(html).toContain(`data:image/jpeg;base64,${Buffer.from('attachment-image').toString('base64')}`);
  });

  it('does not read or embed a file when tenant ownership is denied', async () => {
    vi.spyOn(uploadMetadataService, 'assertTenantOwnership')
      .mockRejectedValue(Object.assign(new Error('cross-tenant'), { status: 403 }));
    const readSpy = vi.spyOn(storageProvider, 'readBuffer');

    const html = await render({
      assetImage: 'assets/other-tenant.png',
      attachments: ['reports/other-tenant.jpg']
    });

    expect(readSpy).not.toHaveBeenCalled();
    expect(html).toContain('<div class="asset-initials">Pump 1</div>');
    expect(html).not.toContain('data:image/');
  });

  it('preserves validated inline chart-style images without a storage lookup', async () => {
    const inline = `data:image/png;base64,${Buffer.from('inline').toString('base64')}`;
    const ownershipSpy = vi.spyOn(uploadMetadataService, 'assertTenantOwnership');
    const readSpy = vi.spyOn(storageProvider, 'readBuffer');

    const html = await render({ assetImage: inline, attachments: [] });

    expect(html).toContain(inline);
    expect(ownershipSpy).not.toHaveBeenCalled();
    expect(readSpy).not.toHaveBeenCalled();
  });
});
