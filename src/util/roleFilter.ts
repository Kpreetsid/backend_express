import { IUser } from "../models/user.model";
import { mapUserToAssetService, mapUserToLocationService } from "../transaction/mapUserLocation/userLocation.service";

type MappingType = "location" | "asset" | "";

interface RoleFilterOptions {
  user: IUser;
  baseFilter?: Record<string, any>;
  accountField?: string;
  createdByField?: string;
  mapping?: MappingType;
}
export const applyRoleFilter = async ({user, baseFilter = {}, accountField = "account_id", createdByField = "createdBy", mapping = ""}: RoleFilterOptions): Promise<Record<string, any>> => {
  const finalFilter: Record<string, any> = { ...baseFilter };
  switch (user.user_role) {
    case "super_admin":
    case "super_employee":
    case "super_user":
      return finalFilter;

    /** ACCOUNT LEVEL */
    case "admin":
      return { ...finalFilter, [accountField]: user.account_id, visible: true };

    /** ACCOUNT + MAPPING LEVEL */
    case "manager":
    case "employee":
    case "customer": {
      if (!finalFilter._id) {
        if (mapping === "location") {
          const mappedLocations = await mapUserToLocationService.getLocationsMappedData(user._id);
          finalFilter._id = { $in: mappedLocations.map((doc: any) => doc.locationId) };
        }
        if (mapping === "asset") {
          const mappedAssets = await mapUserToAssetService.getAssetsMappedData(user._id);
          finalFilter._id = { $in: mappedAssets.map((doc: any) => doc.assetId) };
        }
      }
      finalFilter[accountField] = user.account_id;
      finalFilter.visible = true;
      return finalFilter;
    }

    case "user":
      return { ...finalFilter, [accountField]: user.account_id, [createdByField]: user._id, visible: true };

    default:
      throw new Error("Unknown role — cannot apply role filter.");
  }
};
