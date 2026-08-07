import { Types } from 'mongoose';
import { applicationLogger } from '../observability/logger';
import {
  StoredUploadDriver,
  StoredUploadMetadataModel
} from '../models/storedUploadMetadata.model';
import { getStorageKey } from '../_config/storage';

export interface RecordStoredUploadInput {
  accountId: string;
  createdBy?: string;
  originalName: string;
  fileName: string;
  folderName?: string;
  mimeType: string;
  size: number;
  checksumSha256: string;
  storageDriver: StoredUploadDriver;
}

const objectId = (value: string, field: string): Types.ObjectId => {
  if (!Types.ObjectId.isValid(value)) {
    throw Object.assign(new Error(`${field} is invalid`), { status: 400 });
  }
  return new Types.ObjectId(value);
};

class UploadMetadataService {
  async recordUpload(input: RecordStoredUploadInput): Promise<void> {
    const accountId = objectId(input.accountId, 'accountId');
    const storageKey = getStorageKey(input.fileName, input.folderName);
    const existing = await StoredUploadMetadataModel.findOne({ storageKey })
      .select({ account_id: 1 })
      .lean();

    if (existing && String(existing.account_id) !== String(accountId)) {
      throw Object.assign(new Error('Stored file key is already owned by another tenant'), { status: 409 });
    }

    try {
      await StoredUploadMetadataModel.updateOne(
        { storageKey, account_id: accountId },
        {
          $setOnInsert: {
            account_id: accountId,
            ...(input.createdBy ? { createdBy: objectId(input.createdBy, 'createdBy') } : {}),
            originalName: input.originalName,
            fileName: input.fileName,
            folderName: input.folderName || '',
            storageKey,
            mimeType: input.mimeType,
            size: input.size,
            checksumSha256: input.checksumSha256,
            storageDriver: input.storageDriver,
            scanStatus: 'clean',
            status: 'active'
          }
        },
        { upsert: true, runValidators: true }
      );
    } catch (error: any) {
      if (error?.code === 11000) {
        throw Object.assign(new Error('Stored file key is already registered'), { status: 409 });
      }
      throw error;
    }
  }

  async assertTenantOwnership(
    accountId: string,
    fileName: string,
    folderName?: string
  ): Promise<void> {
    const tenantId = objectId(accountId, 'accountId');
    const storageKey = getStorageKey(fileName, folderName);
    const existing = await StoredUploadMetadataModel.findOne({ storageKey })
      .select({ account_id: 1 })
      .lean();

    if (existing && String(existing.account_id) !== String(tenantId)) {
      throw Object.assign(new Error('Stored file does not belong to this tenant'), { status: 403 });
    }
    if (!existing) {
      applicationLogger.warn(
        { accountId, storageKey },
        'Allowing legacy file lifecycle operation without stored upload metadata'
      );
    }
  }

  async markDeleted(
    accountId: string,
    fileName: string,
    folderName?: string,
    deletedBy?: string
  ): Promise<number> {
    const storageKey = getStorageKey(fileName, folderName);
    const deleted = await StoredUploadMetadataModel.findOneAndUpdate(
      {
        account_id: objectId(accountId, 'accountId'),
        storageKey,
        status: 'active'
      },
      {
        $set: {
          status: 'deleted',
          deletedAt: new Date(),
          ...(deletedBy ? { deletedBy: objectId(deletedBy, 'deletedBy') } : {})
        }
      },
      { returnDocument: 'after' }
    );
    return Number(deleted?.size || 0);
  }
}

export const uploadMetadataService = new UploadMetadataService();
