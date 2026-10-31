import { SettingsModel } from "@modules/settings/models/settings.model";

class SettingsService {
  async getAll(filter: any = {}): Promise<any> {
    return await SettingsModel.find(filter);
  }
}

export const settingsService = new SettingsService();
