import { EndpointLocationModel } from "../../models/floorMap.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { mapUserToAssetService } from "../../transaction/mapUserAsset/userAsset.service";

class FloorMapService {
  async getFloorMaps(match: any) {
    return await EndpointLocationModel.find(match);
  }

  async getCoordinates(match: any, account_id: any, user_id?: any, userRole?: any): Promise<any> {
    const floorMaps = await EndpointLocationModel.find(match).populate([{ path: "locationId", model: "Schema_Location", select: "id location_name location_type top_level parent_id visible", match: { visible: true } }]);
    if (!floorMaps.length) {
      throw Object.assign(new Error("No coordinates found"), { status: 404 });
    }
    let mappedAssetIds: string[] = [];
    if (userRole !== "admin" && user_id) {
      const mappedAssets = await mapUserToAssetService.getAssetsMappedData(String(user_id));
      mappedAssetIds = mappedAssets.map((m) => String(m.assetId));
    }
    return Promise.all(
      floorMaps.map(async (item) => {
        if (!item.locationId?._id) return null;
        const locationId = String(item.locationId._id);
        const childLocationIds = await this.getAllChildLocationsRecursive([locationId], user_id, userRole);
        const allowedLocations = [locationId, ...childLocationIds];
        const assetMatch: any = {
          account_id,
          visible: true,
          asset_type: { $nin: ["Flexible", "Rigid", "Belt_Pulley"] },
          locationId: { $in: allowedLocations },
          top_level: true
        };
        if (userRole !== "admin") {
          assetMatch._id = { $in: mappedAssetIds };
        }
        const assetList = await AssetModel.find(assetMatch).select("id asset_name asset_type asset_model top_level parent_id visible");
        return { item, assetList };
      })
    );
  }

  async getAllChildLocationsRecursive(parentIds: string[], user_id?: any, userRole?: any): Promise<string[]> {
    if (!parentIds.length) return [];
    if (userRole !== "admin") {
      const mapped = await mapUserToLocationService.getLocationsMappedData(String(user_id));
      const mappedIds = mapped.map((m) => String(m.locationId));
      parentIds = parentIds.filter((id) => mappedIds.includes(id));
      if (!parentIds.length) return [];
    }
    const children = await LocationModel.find({parent_id: { $in: parentIds }, visible: true}).select("_id");
    if (!children.length) return [];
    const childIds = children.map((c) => String(c._id));
    const grandChildIds = await this.getAllChildLocationsRecursive(childIds, user_id, userRole);
    return [...childIds, ...grandChildIds];
  }

  async insertFloorMapCoordinates(body: any, account_id: any, user_id: any): Promise<any> {
    const endpointLocation = new EndpointLocationModel({
      coordinate: body.coordinate,
      locationId: body.locationId,
      account_id,
      data_type: body.data_type,
      createdBy: user_id
    });
    if (body.data_type === "asset") {
      endpointLocation.end_point_id = body.end_point_id;
      endpointLocation.end_point = body.end_point;
    }
    return await endpointLocation.save();
  }

  async updateById(id: any, body: any, user_id: any): Promise<any> {
    return await EndpointLocationModel.findByIdAndUpdate(id, { coordinate: body.coordinate, locationId: body.locationId, data_type: body.data_type, updatedBy: user_id }, { new: true });
  }

  async removeById(id: any, user_id: any): Promise<any> {
    return await EndpointLocationModel.findByIdAndUpdate(id, { visible: false, updatedBy: user_id }, { new: true });
  }

  async deleteCoordinates(match: any) {
    return await EndpointLocationModel.findOneAndDelete(match);
  }
}

export const floorMapService = new FloorMapService();