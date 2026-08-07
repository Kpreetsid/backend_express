import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { storageProvider } from '../_config/storage';
import { uploadFilesService } from './upload.multer';
import { uploadService } from './upload.service';

describe('tenant-owned upload service boundary', () => {
  const accountId = '507f1f77bcf86cd799439011';
  const userId = '507f1f77bcf86cd799439012';
  const originalSignedUrl = storageProvider.getSignedURL;

  const response = () => {
    const value: any = {
      status: vi.fn(),
      send: vi.fn()
    };
    value.status.mockReturnValue(value);
    return value;
  };

  const persistedFile = {
    filename: 'stored-diagram.png',
    originalname: 'diagram.png',
    mimetype: 'image/png',
    destination: 'uploadFiles/assets',
    path: 'uploadFiles/assets/stored-diagram.png',
    size: 42
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    if (originalSignedUrl) {
      storageProvider.getSignedURL = originalSignedUrl;
    } else {
      delete storageProvider.getSignedURL;
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalSignedUrl) {
      storageProvider.getSignedURL = originalSignedUrl;
    } else {
      delete storageProvider.getSignedURL;
    }
  });

  it('persists multipart files with immutable actor and tenant context', async () => {
    vi.spyOn(uploadFilesService, 'persistMultipartFiles')
      .mockResolvedValue([persistedFile] as never);
    vi.spyOn(storageProvider, 'getURL')
      .mockReturnValue('https://files.example/assets/stored-diagram.png');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadService({
      files: [{ originalname: 'diagram.png' }],
      params: { folderName: 'assets' },
      user: { account_id: accountId, _id: userId }
    } as any, res, next);

    expect(uploadFilesService.persistMultipartFiles).toHaveBeenCalledWith(
      [{ originalname: 'diagram.png' }],
      'assets',
      accountId,
      userId
    );
    expect(storageProvider.getURL).toHaveBeenCalledWith(
      'stored-diagram.png',
      'assets'
    );
    expect(res.status).toHaveBeenCalledWith(200);
    const payload = res.send.mock.calls[0][0];
    expect(payload).toMatchObject({
      status: true,
      message: 'Files uploaded successfully'
    });
    expect(payload.data[0]).toMatchObject({
      originalName: 'diagram.png',
      fileName: 'stored-diagram.png',
      folderName: 'assets',
      fileURL: 'https://files.example/assets/stored-diagram.png',
      size: 42
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns signed storage URLs without changing the response contract', async () => {
    vi.spyOn(uploadFilesService, 'persistMultipartFiles')
      .mockResolvedValue([persistedFile] as never);
    storageProvider.getSignedURL = vi.fn()
      .mockResolvedValue('https://signed.example/stored-diagram.png');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadService({
      files: [persistedFile],
      params: {},
      user: { account_id: accountId }
    } as any, res, next);

    expect(storageProvider.getSignedURL).toHaveBeenCalledWith(
      'stored-diagram.png',
      undefined
    );
    expect(res.send.mock.calls[0][0].data[0].fileURL)
      .toBe('https://signed.example/stored-diagram.png');
    expect(uploadFilesService.persistMultipartFiles).toHaveBeenCalledWith(
      [persistedFile],
      undefined,
      accountId,
      undefined
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects empty multipart submissions before storage work', async () => {
    const persist = vi.spyOn(uploadFilesService, 'persistMultipartFiles');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadService({
      files: [],
      params: {},
      user: { account_id: accountId }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'No files uploaded',
      status: 400
    }));
    expect(persist).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('rejects multipart storage work without authenticated tenant context', async () => {
    const persist = vi.spyOn(uploadFilesService, 'persistMultipartFiles');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadService({
      files: [persistedFile],
      params: {}
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Authenticated account is required',
      status: 401
    }));
    expect(persist).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('forwards multipart persistence failures to the shared error handler', async () => {
    const failure = Object.assign(new Error('quota exceeded'), { status: 413 });
    vi.spyOn(uploadFilesService, 'persistMultipartFiles')
      .mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await uploadService.uploadService({
      files: [persistedFile],
      params: { folderName: 'assets' },
      user: { account_id: accountId, _id: userId }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.send).not.toHaveBeenCalled();
  });

  it('stores base64 images with the route folder taking precedence', async () => {
    vi.spyOn(uploadFilesService, 'uploadBase64Image')
      .mockResolvedValue({
        fileName: 'base.png',
        originalName: 'base.png',
        type: 'image/png',
        filePath: 'assets/base.png',
        size: 24
      } as never);
    vi.spyOn(storageProvider, 'getURL')
      .mockReturnValue('https://files.example/assets/base.png');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadBaseImageService({
      body: { baseImage: 'data:image/png;base64,AAAA', folderName: 'body-folder' },
      params: { folderName: 'route-folder' },
      user: { account_id: accountId, _id: userId }
    } as any, res, next);

    expect(uploadFilesService.uploadBase64Image).toHaveBeenCalledWith(
      'data:image/png;base64,AAAA',
      'route-folder',
      accountId,
      userId
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send.mock.calls[0][0]).toMatchObject({
      status: true,
      message: 'File uploaded successfully',
      data: {
        fileName: 'base.png',
        folderName: 'route-folder',
        fileURL: 'https://files.example/assets/base.png'
      }
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('uses the body folder and optional actor ID for the legacy base-image route', async () => {
    vi.spyOn(uploadFilesService, 'uploadBase64Image')
      .mockResolvedValue({
        fileName: 'base.png',
        originalName: 'base.png',
        type: 'image/png',
        filePath: 'body-folder/base.png',
        size: 24
      } as never);
    vi.spyOn(storageProvider, 'getURL').mockReturnValue('/body-folder/base.png');
    const res = response();

    await uploadService.uploadBaseImageService({
      body: { baseImage: 'data:image/png;base64,AAAA', folderName: 'body-folder' },
      params: {},
      user: { account_id: accountId }
    } as any, res, vi.fn());

    expect(uploadFilesService.uploadBase64Image).toHaveBeenCalledWith(
      'data:image/png;base64,AAAA',
      'body-folder',
      accountId,
      undefined
    );
  });

  it('rejects malformed base-image requests before tenant or storage work', async () => {
    const upload = vi.spyOn(uploadFilesService, 'uploadBase64Image');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadBaseImageService({
      body: { baseImage: { unexpected: true } },
      params: {},
      user: { account_id: accountId }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Base64 image data is required',
      status: 400
    }));
    expect(upload).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('rejects base-image storage without authenticated tenant context', async () => {
    const upload = vi.spyOn(uploadFilesService, 'uploadBase64Image');
    const res = response();
    const next = vi.fn();

    await uploadService.uploadBaseImageService({
      body: { baseImage: 'data:image/png;base64,AAAA' },
      params: {}
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Authenticated account is required',
      status: 401
    }));
    expect(upload).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });

  it('forwards base-image persistence failures to the shared error handler', async () => {
    const failure = Object.assign(new Error('scanner unavailable'), {
      status: 503
    });
    vi.spyOn(uploadFilesService, 'uploadBase64Image')
      .mockRejectedValue(failure);
    const res = response();
    const next = vi.fn();

    await uploadService.uploadBaseImageService({
      body: { baseImage: 'data:image/png;base64,AAAA' },
      params: { folderName: 'assets' },
      user: { account_id: accountId }
    } as any, res, next);

    expect(next).toHaveBeenCalledWith(failure);
    expect(res.send).not.toHaveBeenCalled();
  });
});
