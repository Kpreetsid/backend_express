import mongoose, { Schema, Types } from 'mongoose';

export const GUIDE_CATEGORIES = [
  { id: 'sensor-installation', label: 'Sensor Installation' },
  { id: 'configuration', label: 'Configuration' },
  { id: 'application-walkthroughs', label: 'Application Walkthroughs' },
  { id: 'troubleshooting', label: 'Troubleshooting' }
] as const;

export interface KnowledgeBaseGuide {
  title: string;
  description: string;
  category: string;
  fileName: string;
  size: number;
  published: boolean;
  createdByInternalUser?: Types.ObjectId;
  updatedByInternalUser?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const knowledgeBaseGuideSchema = new Schema<KnowledgeBaseGuide>({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, default: '', maxlength: 600 },
  category: { type: String, required: true, enum: GUIDE_CATEGORIES.map(category => category.id) },
  fileName: { type: String, required: true, match: /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.pdf$/i },
  size: { type: Number, required: true, min: 1 },
  published: { type: Boolean, default: false },
  createdByInternalUser: { type: Schema.Types.ObjectId },
  updatedByInternalUser: { type: Schema.Types.ObjectId }
}, {
  collection: 'knowledge_base_guides', timestamps: true, versionKey: false,
  autoCreate: false, autoIndex: false
});

// This is a global product-documentation catalog, independent of customer assets.
export const KnowledgeBaseGuideModel = mongoose.model<KnowledgeBaseGuide>(
  'KnowledgeBaseGuide', knowledgeBaseGuideSchema
);
