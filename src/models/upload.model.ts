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
  originalName: { type: String },
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
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform(doc: any, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: function (doc, ret) {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

export const UploadModel = mongoose.model<IUpload>('Schema_Upload', uploadSchema);
