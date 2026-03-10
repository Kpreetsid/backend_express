import { getExternalData } from "../utils/externalAPI";

class ProcessorAPIService {
    private assetHealthArray: Record<any, string> = { 1: "Critical", 2: "Danger", 3: "Alert", 4: "Healthy", 5: "Not Defined" };

    setAssetHealthStatus = async (assetsList: any, account_id: any, user_id: any, token: any): Promise<any> => {
        const assetIdList: string[] = assetsList.map((item: any) => `${item.assetId}`);
        const match = { org_id: `${account_id}`, asset_status: "Not Defined", asset_id: [...new Set(assetIdList)] };
        return await getExternalData(`/asset_health_status/`, 'POST', JSON.parse(JSON.stringify(match)), token, `${user_id}`);
    }

    updateAssetHealthStatus = async (body: any, account_id: any, user_id: any, token: any) => {
        const payload: any = { "asset_id": body.assetId, "asset_status": body.status, "org_id": account_id };
        if (body.alarmId) {
            payload.alarm_id = body.alarmId;
        }
        await getExternalData(`/asset_health_status/`, 'PATCH', payload, token, user_id);
    }

    updateAssetHealthStatusOld = async (body: any, account_id: any, user_id: any, token: any) => {
        const payload: any = { "asset_id": body.assetId, "asset_status": this.assetHealthArray[body.EquipmentHealth], "org_id": account_id };
        await getExternalData(`/asset_health_status/`, 'PATCH', payload, token, user_id);
    }

    createEndPoint = async (assetsList: any, user_id: any, token: any): Promise<any> => {
        return await getExternalData(`/endPointApi/`, 'POST', assetsList, token, `${user_id}`);
    }

    getEndPoints = async (asset_id: string[], token: string, user_id: any) => {
        return await getExternalData(`/getAllEndPoints/`, 'POST', { asset_id }, token, `${user_id}`);
    }

    updateAlarmHistoryData = async (body: any, user_id: any, token: any) => {
        return await getExternalData(`/get_alarm_history_data/`, 'PATCH', body, token, user_id);
    }

    assetHealthFreezeStatus = async (body: any, user_id: any, token: any) => {
        return await getExternalData(`/asset_health_freeze_status/`, 'POST', body, token, user_id);
    }
}

export const processorAPIService = new ProcessorAPIService();