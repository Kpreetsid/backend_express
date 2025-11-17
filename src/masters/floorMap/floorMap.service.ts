import { EndpointLocationModel } from "../../models/floorMap.model";
import { LocationModel } from "../../models/location.model";
import { AssetModel } from "../../models/asset.model";

export const getFloorMaps = async (match: any) => {
  return await EndpointLocationModel.find(match);
};

export const getCoordinates = async (match: any, account_id: any): Promise<any> => {
  const floorMaps = await EndpointLocationModel.find(match).populate([{ path: 'locationId', model: "Schema_Location", select: 'location_name' }]);
  if (!floorMaps || floorMaps.length === 0) {
    throw Object.assign(new Error('No coordinates found for the given location'), { status: 404 });
  }
  return await Promise.all(
    floorMaps.map(async (item: any) => {
      const childLocations = await getAllChildLocationsRecursive([`${item.locationId._id}`]);
      const finalLocIds = [item.locationId, ...childLocations];
      const assetsMatch: any = { locationId: { $in: finalLocIds }, visible: true, account_id, asset_type: { $nin: ['Flexible', 'Rigid', 'Belt_Pulley'] } };
      const assetList = await AssetModel.find(assetsMatch).select('asset_name asset_type');
      return { item, assetList };
    })
  );
};

export const getAllChildLocationsRecursive = async (parentIds: any): Promise<any> => {
  let childIds: string[] = [];
  for (const parentId of parentIds) {
    const parent = await LocationModel.findById(parentId);
    if (!parent) continue;
    const match = { parent_id: parent._id, visible: true };
    const children = await LocationModel.find(match);
    if (children?.length > 0) {
      const childrenIds = children.map((child: any) => child._id.toString());
      childIds.push(...childrenIds);
      const grandChildren = await getAllChildLocationsRecursive(childrenIds);
      childIds.push(...grandChildren);
    }
  }
  return childIds;
}

export const insertFloorMap = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const endpointLocation = new EndpointLocationModel({
    coordinate: body.coordinate,
    locationId: body.locationId,
    account_id,
    data_type: body.data_type,
    createdBy: user_id
  });
  if (body.data_type === 'asset') {
    endpointLocation.end_point_id = body.end_point_id;
    endpointLocation.end_point = body.end_point;
  }
  return await endpointLocation.save();
};

export const updateById = async (id: any, body: any, user_id: any): Promise<any> => {
  return await EndpointLocationModel.findByIdAndUpdate(id, { coordinate: body.coordinate, locationId: body.locationId, data_type: body.data_type, updatedBy: user_id }, { new: true });
}

export const removeById = async (id: any, user_id: any): Promise<any> => {
  return await EndpointLocationModel.findByIdAndUpdate(id, { updatedBy: user_id, visible: false }, { new: true });
};

export const insertCoordinates = async (body: any, account_id: any, user_id: any): Promise<any> => {
  const newMappedCoordinates = new EndpointLocationModel({
    "coordinate": body.coordinate,
    "locationId": body.locationId,
    "account_id": account_id,
    "data_type": body.data_type,
    "createdBy": user_id
  });
  if (body.data_type === 'asset') {
    newMappedCoordinates.end_point_id = body.end_point_id;
    newMappedCoordinates.end_point = body.end_point;
  }
  return await newMappedCoordinates.save();
};

export const deleteCoordinates = async (match: any) => {
  return await EndpointLocationModel.findOneAndDelete(match);
};