import mongoose, { Document, ObjectId, Schema } from "mongoose";

export const ANALYSIS_FEATURE_COLLECTION_NAME = `analysis_feature`;

export interface IAnalysisFeature extends Document {
    account_id: string,
    featuresJson: object[],
    updatedBy: ObjectId,
    createdBy: ObjectId,
}

const featureSchema = new Schema<IAnalysisFeature>({
    account_id: {
        type: String,
        required: true
    },
    featuresJson: {
        type: [Object],
        required: true
    },
    updatedBy: {
        type: Schema.Types.ObjectId,
        ref: "UserModel"
    },
    createdBy: {
        type: Schema.Types.ObjectId,
        ref: "UserModel"
    }
}, {
    collection: ANALYSIS_FEATURE_COLLECTION_NAME,
    timestamps: true,
    versionKey: false
})

featureSchema.index({ account_id: 1 });

export const AnalysisFeatureModel = mongoose.model("AnalysisFeatureModel", featureSchema)
