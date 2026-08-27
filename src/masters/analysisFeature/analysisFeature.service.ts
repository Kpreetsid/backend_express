import { AccountModel } from "../../models/account.model";
import { AnalysisFeatureModel } from "../../models/analysisFeature.model";
import { DEFAULT_ANALYSIS_FEATURES } from "./defaultAnalysisFeatures";
import { mergeDefaultFeatureSelections, sanitizeAnalysisFeatureSelection } from "./selectionPolicy";

class AnalysisFeatureService {

    async getFeatureData(filter: any) {
        return await AnalysisFeatureModel.findOne(filter)
    }

    async createFeatureData(body: any, session?: any) {
        const feature = new AnalysisFeatureModel(body);
        return await feature.save({ session });
    }

    async getOrCreateFeatureData(accountId: any, userId?: any) {
        const existing = await this.getFeatureData({ account_id: accountId });
        if (existing) return existing;
        return await this.createFeatureData({
            account_id: String(accountId),
            featuresJson: DEFAULT_ANALYSIS_FEATURES,
            createdBy: userId
        });
    }

    async updateFeatureData(id: string, accountId: any, requestedFeatures: any[], userId: any) {
        const existing: any = await AnalysisFeatureModel.findOne({ _id: id, account_id: accountId });
        if (!existing) return null;
        const featuresJson = sanitizeAnalysisFeatureSelection(existing.featuresJson, requestedFeatures);
        return await AnalysisFeatureModel.findOneAndUpdate(
            { _id: id, account_id: accountId },
            { $set: { featuresJson, updatedBy: userId } },
            { returnDocument: 'after', runValidators: true }
        );
    }

    async removeFeatureData(id: string) {
        return await AnalysisFeatureModel.findByIdAndUpdate(id, { visible: false }, { returnDocument: 'after' })
    }

    async syncDefaultFeaturesForAllAccounts() {
        const accounts = await AccountModel.find({ visible: true }, { _id: 1 }).lean();
        if (!accounts.length) {
            return { updatedAccounts: 0, insertedAccounts: 0 };
        }

        const accountIds = accounts.map((account: any) => String(account._id));
        const existingFeatureDocs = await AnalysisFeatureModel.find(
            { account_id: { $in: accountIds } },
            { account_id: 1, featuresJson: 1 }
        ).lean();
        const existingAccountIds = new Set(existingFeatureDocs.map((doc: any) => String(doc.account_id)));
        const missingAccountIds = accountIds.filter((accountId) => !existingAccountIds.has(accountId));

        const bulkOperations = existingFeatureDocs.map((doc: any) => ({
            updateMany: {
                filter: { _id: doc._id, account_id: doc.account_id },
                update: { $set: { featuresJson: mergeDefaultFeatureSelections(DEFAULT_ANALYSIS_FEATURES, doc.featuresJson) } }
            }
        }));

        if (bulkOperations.length) {
            await AnalysisFeatureModel.bulkWrite(bulkOperations);
        }

        if (missingAccountIds.length) {
            await AnalysisFeatureModel.insertMany(
                missingAccountIds.map((accountId) => ({
                    account_id: accountId,
                    featuresJson: DEFAULT_ANALYSIS_FEATURES
                }))
            );
        }

        return {
            updatedAccounts: existingFeatureDocs.length,
            insertedAccounts: missingAccountIds.length
        };
    }

}

export const analysisFeatureService = new AnalysisFeatureService()
