import { IUser } from "../models/user.model";
import { mapUserToLocationService } from "../transaction/mapUserLocation/userLocation.service";
import { mapUserToAssetService } from "../transaction/mapUserAsset/userAsset.service";

type MappingType = "location" | "asset" | "";

interface RoleFilterOptions {
  user: IUser;
  baseFilter?: Record<string, any>;
  accountField?: string;
  createdByField?: string;
  mapping?: MappingType;
}
export const applyRoleFilter = async ({
  user,
  baseFilter = {},
  accountField = "account_id",
  createdByField = "createdBy",
  mapping = "",
  idField = "_id",
}: RoleFilterOptions & { idField?: string }): Promise<Record<string, any>> => {
  const finalFilter: any = { ...baseFilter };
  switch (user.user_role) {
    case "admin":
      return { ...finalFilter, [accountField]: user.account_id, visible: true };

    /** ACCOUNT + MAPPING LEVEL */
    case "manager":
    case "employee":
    case "customer": {
      let mappedIds: any[] | null = null;
      if (mapping === "location") {
        const mappedLocations = await mapUserToLocationService.getLocationsMappedData(user._id);
        mappedIds = mappedLocations.map((doc: any) => doc.locationId);
      }
      if (mapping === "asset") {
        const mappedAssets = await mapUserToAssetService.getAssetsMappedData(user._id);
        mappedIds = mappedAssets.map((doc: any) => doc.assetId);
      }

      if (mappedIds) {
        const requestedScope = finalFilter[idField];
        if (requestedScope) {
          finalFilter.$and = [
            ...(Array.isArray(finalFilter.$and) ? finalFilter.$and : []),
            { [idField]: requestedScope },
            { [idField]: { $in: mappedIds } }
          ];
          delete finalFilter[idField];
        } else {
          finalFilter[idField] = { $in: mappedIds };
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
