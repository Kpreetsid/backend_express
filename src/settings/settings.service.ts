import { SettingsModel } from "../models/settings.model";

class SettingsService {
  async getAll(filter: any = {}): Promise<any> {
    return await SettingsModel.find({});
  }
}

export const settingsService = new SettingsService();
