import mongoose, { Document, Schema } from 'mongoose';

export type AssetReportPdfJobStatus =
  'queued' | 'processing' | 'retrying' | 'completed' | 'failed';

export interface IAssetReportPdfChartImage {
  key: string;
  title: string;
  order: number;
  width?: number;
  height?: number;
  mimeType: string;
  size: number;
  fileName: string;
  folderName: string;
  checksumSha256: string;
}

export interface IAssetReportPdfOutput {
  fileName: string;
  folderName: string;
  mimeType: 'application/pdf';
  size: number;
  checksumSha256: string;
}

export interface IAssetReportPdfJob extends Document {
  jobId: string;
  accountId: mongoose.Types.ObjectId;
  actorId: mongoose.Types.ObjectId;
  reportId: mongoose.Types.ObjectId;
  status: AssetReportPdfJobStatus;
  requestPayload: Record<string, unknown>;
  chartImages: IAssetReportPdfChartImage[];
  output?: IAssetReportPdfOutput;
  lastError?: string;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const chartImageSchema = new Schema<IAssetReportPdfChartImage>({
  key: { type: String, required: true },
  title: { type: String, default: '' },
  order: { type: Number, required: true },
  width: Number,
  height: Number,
  mimeType: { type: String, enum: ['image/png', 'image/jpeg', 'image/svg+xml'], required: true },
  size: { type: Number, required: true },
  fileName: { type: String, required: true },
  folderName: { type: String, required: true },
  checksumSha256: { type: String, required: true }
}, { _id: false, versionKey: false });

const outputSchema = new Schema<IAssetReportPdfOutput>({
  fileName: { type: String, required: true },
  folderName: { type: String, required: true },
  mimeType: { type: String, enum: ['application/pdf'], required: true },
  size: { type: Number, required: true },
  checksumSha256: { type: String, required: true }
}, { _id: false, versionKey: false });

const assetReportPdfJobSchema = new Schema<IAssetReportPdfJob>({
  jobId: { type: String, required: true, immutable: true },
  accountId: { type: Schema.Types.ObjectId, ref: 'Schema_Account', required: true, immutable: true },
  actorId: { type: Schema.Types.ObjectId, ref: 'Schema_User', required: true, immutable: true },
  reportId: { type: Schema.Types.ObjectId, ref: 'Schema_ReportAsset', required: true, immutable: true },
  status: {
    type: String,
    enum: ['queued', 'processing', 'retrying', 'completed', 'failed'],
    default: 'queued',
    required: true
  },
  requestPayload: { type: Schema.Types.Mixed, required: true },
  chartImages: { type: [chartImageSchema], default: [] },
  output: outputSchema,
  lastError: String,
  startedAt: Date,
  completedAt: Date,
  expiresAt: { type: Date, required: true }
}, {
  collection: 'asset_report_pdf_jobs',
  timestamps: true,
  versionKey: false
});

assetReportPdfJobSchema.index({ accountId: 1, jobId: 1 }, { unique: true });
assetReportPdfJobSchema.index({ accountId: 1, reportId: 1, createdAt: -1 });
assetReportPdfJobSchema.index({ status: 1, updatedAt: 1 });
assetReportPdfJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AssetReportPdfJobModel = mongoose.model<IAssetReportPdfJob>(
  'Schema_AssetReportPdfJob',
  assetReportPdfJobSchema
);
