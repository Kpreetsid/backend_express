import mongoose, { Schema, Document } from 'mongoose';

export interface IUpload extends Document {
  originalName: string;
  type: string;
  destination: string;
  folderName: string;
  fileName: string;
  filePath: string;
  fileURL?: string;
  size: number;
}

export const uploadSchema = new Schema<IUpload>({
  originalName: { type: String, trim: true, select: false },
  type: { type: String, trim: true },
  destination: { type: String, trim: true, select: false },
  folderName: { type: String, trim: true },
  fileName: { type: String, trim: true },
  filePath: { type: String, trim: true, select: false },
  fileURL: { type: String, trim: true },
  size: { type: Number }
}, {
  _id: false,
  timestamps: true,
  versionKey: false
});

export const UploadModel = mongoose.model<IUpload>('Schema_Upload', uploadSchema);
