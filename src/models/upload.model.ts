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
  originalName: { type: String, select: false },
  type: { type: String },
  destination: { type: String, select: false },
  folderName: { type: String },
  fileName: { type: String },
  filePath: { type: String, select: false },
  fileURL: { type: String },
  size: { type: Number }
}, {
  _id: false,
  timestamps: true,
  versionKey: false
});

export const UploadModel = mongoose.model<IUpload>('Schema_Upload', uploadSchema);
