import fs from 'fs';
import path from 'path';
import { NextFunction, Request, Response } from 'express';

const startsWith = (buffer: Buffer, signature: number[]): boolean =>
  buffer.length >= signature.length && signature.every((value, index) => buffer[index] === value);

export const isAllowedUploadSignature = (buffer: Buffer, extension: string): boolean => {
  const ext = String(extension || '').toLowerCase();
  if (ext === '.png') return startsWith(buffer, [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  if (ext === '.jpg' || ext === '.jpeg') return startsWith(buffer, [0xff,0xd8,0xff]);
  if (ext === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  return false;
};

const removeUploadedFiles = async (files: any[]): Promise<void> => {
  await Promise.all(files.map(async file => {
    try {
      if (file?.path) await fs.promises.unlink(file.path);
    } catch {
      // Best-effort cleanup; validation still fails closed.
    }
  }));
};

export const enforceUploadSignatures = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const files = Array.isArray(req.files) ? req.files as Express.Multer.File[] : [];
  try {
    for (const file of files) {
      const handle = await fs.promises.open(file.path, 'r');
      try {
        const probe = Buffer.alloc(16);
        const { bytesRead } = await handle.read(probe, 0, probe.length, 0);
        if (!isAllowedUploadSignature(probe.subarray(0, bytesRead), path.extname(file.originalname))) {
          await removeUploadedFiles(files);
          next(Object.assign(new Error('Uploaded file content does not match an allowed file type'), { status: 400 }));
          return;
        }
      } finally {
        await handle.close();
      }
    }
    next();
  } catch (error) {
    await removeUploadedFiles(files);
    next(error);
  }
};
