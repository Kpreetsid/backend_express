import { NextFunction, Request, Response } from "express";
import { settingsService } from "../services/settings.service";
import { get } from "lodash";
import { IUser } from "../../users/models/user.model";

class SettingsController {
  async getAllSettings(req: Request, res: Response, next: NextFunction): Promise<any> {
    try {
      const { account_id } = get(req, "user", {}) as IUser;
      const match: any = { account_id };
      const data: any = await settingsService.getAll(match);
      if (!data || data.length == 0) {
        throw Object.assign(new Error("Setting not found."), { status: 404 });
      }
      res.status(200).json({ status: true, message: "Settings data fetched successfully", data });
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
