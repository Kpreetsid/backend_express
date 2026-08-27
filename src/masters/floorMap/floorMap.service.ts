import { EndpointLocationModel } from "../../models/floorMap.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";
import { mapUserToLocationService } from "../../transaction/mapUserLocation/userLocation.service";
import { mapUserToAssetService } from "../../transaction/mapUserAsset/userAsset.service";

class FloorMapService {
  async getFloorMaps(match: any) {
    const safeMatch = { ...match };
    if (safeMatch.visible === undefined) {
      safeMatch.visible = { $ne: false };
    }
    return await EndpointLocationModel.find(safeMatch);
  }

  async getCoordinates(match: any, account_id: any, user_id?: any, userRole?: any): Promise<any> {
    const floorMaps: any[] = await EndpointLocationModel.find({ ...match, visible: { $ne: false } })
      .populate([{ path: "locationId", model: "Schema_Location", select: "id location_name location_type top_level parent_id visible", match: { visible: true, account_id } }])
      .lean();
    if (!floorMaps.length) return [];

    let allowedLocationIds: string[] | undefined;
    let mappedAssetIds: string[] = [];
    if (userRole !== "admin" && user_id) {
      const mappedLocations = await mapUserToLocationService.getLocationsMappedData(String(user_id));
      allowedLocationIds = mappedLocations.map((m) => String(m.locationId));
      const mappedAssets = await mapUserToAssetService.getAssetsMappedData(String(user_id));
      mappedAssetIds = mappedAssets.map((m) => String(m.assetId));
    }

    const validFloorMaps = floorMaps.filter((item: any) => item.locationId?._id);
    const rootIds = [...new Set(validFloorMaps.map((item: any) => String(item.locationId._id)))];
    const descendantsByRoot = await this.getDescendantLocationIdsByRoot(
      rootIds,
      account_id,
      allowedLocationIds
    );
    const allLocationIds = [...new Set(
      [...descendantsByRoot.values()].flatMap(ids => [...ids])
    )];

    const assetMatch: any = {
      account_id,
      visible: true,
      asset_type: { $nin: ["Flexible", "Rigid", "Belt_Pulley"] },
      locationId: { $in: allLocationIds },
      top_level: true
    };
    if (userRole !== "admin") {
      assetMatch._id = { $in: mappedAssetIds };
    }
    const assets: any[] = allLocationIds.length
      ? await AssetModel.find(assetMatch)
        .select("id asset_name asset_type asset_model locationId top_level parent_id visible")
        .lean()
      : [];

    return validFloorMaps.map((item: any) => {
      const locationId = String(item.locationId._id);
      const allowedForRoot = descendantsByRoot.get(locationId) || new Set<string>();
      const assetList = assets.filter(asset => allowedForRoot.has(String(asset.locationId)));
      return { item, assetList };
    });
  }

  async getAllChildLocationsRecursive(
    parentIds: string[],
    user_id?: any,
    userRole?: any,
    account_id?: any
  ): Promise<string[]> {
    if (!parentIds.length) return [];
    let allowedLocationIds: string[] | undefined;
    if (userRole !== "admin") {
      const mapped = await mapUserToLocationService.getLocationsMappedData(String(user_id));
      allowedLocationIds = mapped.map((m) => String(m.locationId));
    }
    const descendantsByRoot = await this.getDescendantLocationIdsByRoot(
      parentIds.map(String),
      account_id,
      allowedLocationIds
    );
    const roots = new Set(parentIds.map(String));
    return [...new Set(
      [...descendantsByRoot.values()]
        .flatMap(ids => [...ids])
        .filter(id => !roots.has(id))
    )];
  }

  private async getDescendantLocationIdsByRoot(
    rootIds: string[],
    account_id?: any,
    allowedLocationIds?: string[]
  ): Promise<Map<string, Set<string>>> {
    const allowed = allowedLocationIds ? new Set(allowedLocationIds.map(String)) : null;
    const result = new Map<string, Set<string>>();
    let frontier: Array<{ rootId: string; locationId: string }> = [];

    for (const rootId of [...new Set(rootIds.map(String))]) {
      const ids = new Set<string>();
      if (!allowed || allowed.has(rootId)) {
        ids.add(rootId);
        frontier.push({ rootId, locationId: rootId });
      }
      result.set(rootId, ids);
    }

    let depth = 0;
    while (frontier.length && depth < 100) {
      const parentIds = [...new Set(frontier.map(item => item.locationId))];
      const query: any = { parent_id: { $in: parentIds }, visible: true };
      if (account_id) query.account_id = account_id;
      if (allowed) query._id = { $in: [...allowed] };

      const children: any[] = await LocationModel.find(query)
        .select("_id parent_id")
        .lean();
      if (!children.length) {
        frontier = [];
        break;
      }

      const rootsByParent = new Map<string, Set<string>>();
      for (const item of frontier) {
        const roots = rootsByParent.get(item.locationId) || new Set<string>();
        roots.add(item.rootId);
        rootsByParent.set(item.locationId, roots);
      }

      const nextFrontier: Array<{ rootId: string; locationId: string }> = [];
      for (const child of children) {
        const childId = String(child._id);
        const parentId = String(child.parent_id);
        for (const rootId of rootsByParent.get(parentId) || []) {
          const ids = result.get(rootId)!;
          if (ids.has(childId)) continue;
          if (ids.size >= 10000) {
            throw Object.assign(new Error("Location hierarchy is too large"), { status: 400 });
          }
          ids.add(childId);
          nextFrontier.push({ rootId, locationId: childId });
        }
      }
      frontier = nextFrontier;
      depth += 1;
    }
    if (frontier.length) {
      throw Object.assign(new Error("Location hierarchy exceeds the supported depth"), { status: 400 });
    }
    return result;
  }

  async insertFloorMapCoordinates(body: any, account_id: any, user_id: any): Promise<any> {
    const endpointLocation = new EndpointLocationModel({
      coordinate: body.coordinate,
      locationId: body.locationId,
      account_id,
      data_type: body.data_type,
      createdBy: user_id,
      visible: true
    });
    if (body.data_type === "asset") {
      endpointLocation.end_point_id = body.end_point_id;
      endpointLocation.end_point = body.end_point;
    }
    return await endpointLocation.save();
  }

  async updateById(id: any, body: any, user_id: any, account_id: any): Promise<any> {
    return await EndpointLocationModel.findOneAndUpdate(
      { _id: id, account_id, visible: { $ne: false } },
      {
        coordinate: body.coordinate,
        locationId: body.locationId,
        data_type: body.data_type,
        end_point_id: body.end_point_id,
        end_point: body.end_point,
        updatedBy: user_id
      },
      { returnDocument: 'after' }
    );
  }

  async removeById(id: any, user_id: any, account_id: any): Promise<any> {
    return await EndpointLocationModel.findOneAndUpdate(
      { _id: id, account_id, visible: { $ne: false } },
      { visible: false, updatedBy: user_id },
      { returnDocument: 'after' }
    );
  }

  async deleteCoordinates(match: any) {
    return await EndpointLocationModel.findOneAndDelete(match);
  }
}

export const floorMapService = new FloorMapService();
