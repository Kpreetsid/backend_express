import { applicationLogger } from '../observability/logger';
import { AssetModel } from "../models/asset.model";

class SnoozeAlarmService {
    public async runSnoozeAlarm(): Promise<void> {
        try {
            const assets = await AssetModel.find({ snoozeAlarm: true, snoozeValue: { $gt: 0 } });
            applicationLogger.info(`${new Date().toISOString()} → Running snooze alarm tick for ${assets.length} assets`);
            for (const asset of assets) {
                try {
                    asset.snoozeValue!--;
                    if (asset.snoozeValue === 0) {
                        asset.snoozeAlarm = false;
                    }
                    await asset.save();
                    applicationLogger.info(`${new Date().toISOString()} → Snooze alarm tick for asset: ${asset.asset_name}`);
                } catch (indivError) {
                    applicationLogger.error({ err: indivError }, `❌ Snooze tick failed for asset "${asset.asset_name}":`);
                }
            }
            applicationLogger.info(`${new Date().toISOString()} → Snooze alarm tick completed`);
        } catch (error) {
            applicationLogger.error({ err: error }, "Error in runSnoozeAlarm:");
        }
    }
}

export const snoozeAlarmService = new SnoozeAlarmService();