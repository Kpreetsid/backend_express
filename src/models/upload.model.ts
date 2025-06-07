import mongoose, { Schema, ObjectId, Document } from 'mongoose';

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
    originalName: { type: String, required: true },
    type: { type: String, required: true },
    destination:{ type: String, required: true, select: false },
    folderName: { type: String, required: true },
    fileName: { type: String, required: true },
    filePath: { type: String, required: true, select: false },
    fileURL: { type: String },
    size: { type: Number, required: true }
}, {
    _id: false ,
    timestamps: true,
    versionKey: false
});

export const UploadModel = mongoose.model<IUpload>('Upload', uploadSchema);
