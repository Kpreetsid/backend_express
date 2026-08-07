import { AccountModel } from "../../models/account.model";
import { AnalysisFeatureModel } from "../../models/analysisFeature.model";
import { DEFAULT_ANALYSIS_FEATURES } from "./defaultAnalysisFeatures";

class AnalysisFeatureService {

    async getFeatureData(filter: any) {
        return await AnalysisFeatureModel.findOne(filter)
    }

    async createFeatureData(body: any) {
        return await AnalysisFeatureModel.create(body)
    }

    async updateFeatureData(id: string, body: any, user_id: any) {
        return await AnalysisFeatureModel.findByIdAndUpdate(id, { ...body, updatedBy: user_id });
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
        const existingFeatureDocs = await AnalysisFeatureModel.find({ account_id: { $in: accountIds } }, { account_id: 1 }).lean();
        const existingAccountIds = new Set(existingFeatureDocs.map((doc: any) => String(doc.account_id)));
        const missingAccountIds = accountIds.filter((accountId) => !existingAccountIds.has(accountId));

        const bulkOperations = accountIds.map((accountId) => ({
            updateMany: {
                filter: { account_id: accountId },
                update: { $set: { featuresJson: DEFAULT_ANALYSIS_FEATURES } }
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
            updatedAccounts: accountIds.length,
            insertedAccounts: missingAccountIds.length
        };
    }

}

export const analysisFeatureService = new AnalysisFeatureService()
