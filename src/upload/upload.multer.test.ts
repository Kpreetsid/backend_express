import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storageProvider } from '../_config/storage';
import { storageConfig } from '../configDB';
import { uploadFilesService } from './upload.multer';
import { uploadMetadataService } from './upload-metadata.service';
import { uploadQuotaService } from './upload-quota.service';

describe('multipart file validation', () => {
  const originalDriver = storageConfig.driver;

  beforeEach(() => {
    vi.spyOn(uploadMetadataService, 'recordUpload').mockResolvedValue();
  });

  afterEach(() => {
    storageConfig.driver = originalDriver;
    vi.restoreAllMocks();
  });

  it('accepts content with a matching PNG signature', async () => {
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      originalname: 'diagram.png',
      mimetype: 'image/png',
      size: 9
    };
    await expect(uploadFilesService.persistMultipartFile(file)).resolves.toBe(file);
  });

  it('rejects an extension-only spoofed upload', async () => {
    const file = {
      buffer: Buffer.from('not a pdf'),
      originalname: 'malicious.pdf',
      mimetype: 'application/pdf',
      size: 9
    };
    await expect(uploadFilesService.persistMultipartFile(file))
      .rejects.toMatchObject({ message: 'File content does not match the allowed file type', status: 400 });
  });

  it('accepts PDF and JPEG signatures', async () => {
    await expect(uploadFilesService.persistMultipartFile({
      buffer: Buffer.from('%PDF-valid'),
      originalname: 'manual.pdf',
      mimetype: 'application/pdf'
    })).resolves.toMatchObject({ originalname: 'manual.pdf' });
    await expect(uploadFilesService.persistMultipartFile({
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]),
      originalname: 'photo.jpeg',
      mimetype: 'image/jpeg'
    })).resolves.toMatchObject({ originalname: 'photo.jpeg' });
  });

  it('generates opaque names without losing tenant and folder context', () => {
    const fileName = uploadFilesService.generateFileName('png', 'Asset Images', 'account-1');
    expect(fileName).toMatch(/^\d{8}-\d+-asset-images-account-1-[a-f0-9]{8}\.png$/);
    expect(uploadFilesService.generateFileName('.pdf')).toMatch(
      /^\d{8}-\d+-[a-f0-9]{8}\.pdf$/
    );
  });

  it('stores validated multipart content through S3 when configured', async () => {
    storageConfig.driver = 's3';
    vi.spyOn(storageProvider, 'upload').mockResolvedValue({
      fileName: 'stored.png',
      originalName: 'diagram.png',
      mimeType: 'image/png',
      size: 9,
      path: 'account/stored.png',
      url: 'https://storage.example/account/stored.png',
      checksumSha256: '0'.repeat(64)
    });
    const file = {
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]),
      originalname: 'diagram.png',
      mimetype: 'image/png',
      size: 9
    };

    await expect(uploadFilesService.persistMultipartFile(file, 'assets', 'account-1'))
      .resolves.toMatchObject({ fileName: 'stored.png', path: 'account/stored.png' });
  });

  it('validates and stores base64 images', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    vi.spyOn(storageProvider, 'upload').mockResolvedValue({
      fileName: 'stored.png',
      originalName: 'stored.png',
      mimeType: 'image/png',
      size: png.length,
      path: 'assets/stored.png',
      url: 'https://storage.example/assets/stored.png',
      checksumSha256: '0'.repeat(64)
    });

    await expect(uploadFilesService.uploadBase64Image(
      `data:image/png;base64,${png.toString('base64')}`,
      'assets',
      'account-1'
    )).resolves.toMatchObject({
      type: 'image/png',
      filePath: 'assets/stored.png',
      size: png.length
    });
  });

  it('rejects invalid base64 declarations and delegates deletion', async () => {
    await expect(uploadFilesService.uploadBase64Image('')).rejects.toMatchObject({ status: 400 });
    await expect(uploadFilesService.uploadBase64Image(
      `data:image/png;base64,${Buffer.from('not-png').toString('base64')}`
    )).rejects.toMatchObject({ message: 'Image content does not match its declared type' });

    const deleteSpy = vi.spyOn(storageProvider, 'delete').mockResolvedValue();
    await uploadFilesService.deleteBase64Image('stored.png', 'assets');
    expect(deleteSpy).toHaveBeenCalledWith('stored.png', 'assets');
  });

  it('enforces tenant ownership and quota release for deletion', async () => {
    const ownership = vi.spyOn(uploadMetadataService, 'assertTenantOwnership')
      .mockResolvedValue({} as any);
    const markDeleted = vi.spyOn(uploadMetadataService, 'markDeleted')
      .mockResolvedValue(4096);
    const releaseActive = vi.spyOn(uploadQuotaService, 'releaseActive')
      .mockResolvedValue();
    const deleteSpy = vi.spyOn(storageProvider, 'delete').mockResolvedValue();

    await uploadFilesService.deleteBase64Image(
      'stored.png',
      'assets',
      'account-1',
      'user-1'
    );

    expect(ownership).toHaveBeenCalledWith('account-1', 'stored.png', 'assets');
    expect(deleteSpy).toHaveBeenCalledWith('stored.png', 'assets');
    expect(markDeleted).toHaveBeenCalledWith(
      'account-1',
      'stored.png',
      'assets',
      'user-1'
    );
    expect(releaseActive).toHaveBeenCalledWith('account-1', 4096);
  });

  it('fails closed when tenant-owned deletion cannot be authorized', async () => {
    vi.spyOn(uploadMetadataService, 'assertTenantOwnership')
      .mockRejectedValue(new Error('tenant mismatch'));
    const deleteSpy = vi.spyOn(storageProvider, 'delete');

    await expect(uploadFilesService.deleteBase64Image(
      'stored.png',
      'assets',
      'account-1'
    )).rejects.toThrow('tenant mismatch');
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it('removes the stored object when metadata persistence fails', async () => {
    storageConfig.driver = 's3';
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
    vi.spyOn(storageProvider, 'upload').mockResolvedValue({
      fileName: 'stored.png',
      originalName: 'diagram.png',
      mimeType: 'image/png',
      size: png.length,
      path: 'assets/stored.png',
      url: 'https://storage.example/assets/stored.png',
      checksumSha256: '0'.repeat(64)
    });
    const deleteSpy = vi.spyOn(storageProvider, 'delete').mockResolvedValue();
    vi.mocked(uploadMetadataService.recordUpload)
      .mockRejectedValueOnce(new Error('metadata unavailable'));

    await expect(uploadFilesService.persistMultipartFile({
      buffer: png,
      originalname: 'diagram.png',
      mimetype: 'image/png',
      size: png.length
    }, 'assets', '507f1f77bcf86cd799439011'))
      .rejects.toThrow('metadata unavailable');

    expect(deleteSpy).toHaveBeenCalledWith('stored.png', 'assets');
  });

  it('rolls back earlier files when a later multipart file fails', async () => {
    const first = { filename: 'first.png', fileName: 'first.png' };
    vi.spyOn(uploadFilesService, 'persistMultipartFile')
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(Object.assign(new Error('Tenant upload storage quota exceeded'), {
        status: 507
      }));
    const cleanupSpy = vi.spyOn(uploadFilesService, 'deleteBase64Image').mockResolvedValue();

    await expect(uploadFilesService.persistMultipartFiles(
      [{ originalname: 'first.png' }, { originalname: 'second.png' }],
      'assets',
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea'
    )).rejects.toMatchObject({ status: 507 });

    expect(cleanupSpy).toHaveBeenCalledWith(
      'first.png',
      'assets',
      '507f1f77bcf86cd799439011',
      '507f191e810c19729de860ea'
    );
  });
});
