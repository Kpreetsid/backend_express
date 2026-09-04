import { AssetModel } from '../../modules/assets/models/asset.model';

class SnoozeAlarmService {
    public async runSnoozeAlarm(): Promise<void> {
        try {
            const assets = await AssetModel.find({ snoozeAlarm: true, snoozeValue: { $gt: 0 } });
            console.log(`${new Date().toISOString()} → Running snooze alarm tick for ${assets.length} assets`);
            for (const asset of assets) {
                try {
                    asset.snoozeValue!--;
                    if (asset.snoozeValue === 0) {
                        asset.snoozeAlarm = false;
                    }
                    await asset.save();
                    console.log(`${new Date().toISOString()} → Snooze alarm tick for asset: ${asset.asset_name}`);
                } catch (indivError) {
                    console.error(`❌ Snooze tick failed for asset "${asset.asset_name}":`, indivError);
                }
            }
            console.log(`${new Date().toISOString()} → Snooze alarm tick completed`);
        } catch (error) {
            console.error("Error in runSnoozeAlarm:", error);
        }
    }
}

export const snoozeAlarmService = new SnoozeAlarmService();
