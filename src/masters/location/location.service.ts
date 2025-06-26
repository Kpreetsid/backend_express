import { LocationMaster, ILocationMaster } from "../../models/location.model";
import { Request, Response, NextFunction } from 'express';
import { IMapUserLocation, MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { getData } from "../../util/queryBuilder";
import { get } from "lodash";
import { IUser, User } from "../../models/user.model";
import { Asset } from "../../models/asset.model";
import mongoose from "mongoose";

export const getAll = async (match: any) => {
  return await LocationMaster.find(match).populate([{ path: 'parent_id', select: 'location_name' }]);
};

const buildTree = async (parentId: string | null, account_id: any): Promise<any[]> => {
  const match: any = {
    account_id,
    visible: true,
    parent_id: parentId ? parentId : { $exists: false },
  };

  const nodes = await getData(LocationMaster, { filter: match });

  return Promise.all(
    nodes.map(async (node: any) => {
      const children = await buildTree(node._id.toString(), account_id);
      return { ...node, childs: children }; // Return empty array if no children
    })
  );
};

export const getTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { location_id, location_floor_map_tree } = req.query;

    let match: any = { account_id, visible: true };
    let rootId: string | null = null;

    if (location_floor_map_tree) {
      match.top_level = true;
      if (location_id) {
        match._id = location_id;
        rootId = location_id.toString();
      }
    } else {
      if (location_id) {
        match._id = location_id;
        rootId = location_id.toString();
      } else {
        match.parent_id = { $exists: false };
      }
    }

    // Restrict for non-admins
    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocation.find({ userId: user_id });
      const allowedLocationIds = mapData?.map(doc => doc.locationId?.toString()) || [];

      if (allowedLocationIds.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }

      // Apply permission filtering
      if (match._id) {
        const isAllowed = allowedLocationIds.includes(match._id.toString());
        if (!isAllowed) {
          throw Object.assign(new Error('No access to this location'), { status: 403 });
        }
      } else {
        match._id = { $in: allowedLocationIds };
      }
    }

    const rootLocations = await getData(LocationMaster, { filter: match });
    if (!rootLocations?.length) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }

    let treeData: any[];

    if (location_id) {
      // Get the parent node directly
      const parentNode = rootLocations[0];
      const children = await buildTree(parentNode._id.toString(), account_id);
      treeData = [{ ...parentNode, childs: children }];
    } else {
      // Build the tree for all top-level or root locations
      treeData = await Promise.all(
        rootLocations.map(async (node: any) => {
          const children = await buildTree(node._id.toString(), account_id);
          return { ...node, childs: children };
        })
      );
    }

    res.status(200).json({
      status: true,
      message: "Data fetched successfully",
      data: treeData,
    });
  } catch (error) {
    console.error("getTree error:", error);
    next(error);
  }
};

export const kpiFilterLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { visible: true, account_id };
    if (userRole !== 'admin') {
      const mapLocationData: IMapUserLocation[] = await getData(MapUserAssetLocation, { filter: { userId: user_id } });
      if (!mapLocationData.length) {
        throw Object.assign(new Error('No location mapping found for user'), { status: 404 });
      }
      const locationIds = mapLocationData.map(doc => doc.locationId?.toString()).filter(Boolean);
      if (!locationIds.length) {
        throw Object.assign(new Error('No valid location IDs found'), { status: 404 });
      }
      match._id = { $in: locationIds };
    }
    const locations: ILocationMaster[] = await getData(LocationMaster, { filter: match });
    if (!locations?.length) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    // Build tree from flat location list
    const idMap: Record<string, any> = {};
    locations.forEach((loc: any) => {
      idMap[loc._id.toString()] = { ...loc, children: [] };
    });
    const rootNodes: any[] = [];
    locations.forEach((loc: any) => {
      const locId = loc._id.toString();
      const parentId = loc.parent_id?.toString();
      if (parentId && idMap[parentId]) {
        idMap[parentId].children.push(idMap[locId]);
      } else {
        rootNodes.push(idMap[locId]);
      }
    });
    // Group by levels
    const levelOneLocations: any[] = [];
    const levelTwoLocations: any[] = [];
    const levelThreeLocations: any[] = [];
    const traverse = (nodes: any[], level: number) => {
      for (const node of nodes) {
        const formatted = {
          location_name: node.location_name,
          id: node._id.toString(),
        };
        if (level === 1) levelOneLocations.push(formatted);
        else if (level === 2) levelTwoLocations.push(formatted);
        else if (level === 3) levelThreeLocations.push(formatted);
        if (node.children?.length) {
          traverse(node.children, level + 1);
        }
      }
    };
    traverse(rootNodes, 1);
    return res.status(200).json({ status: true, message: "Data Found", data: { levelOneLocations, levelTwoLocations, levelThreeLocations }});
  } catch (error) {
    console.error("kpiFilterLocations Error:", error);
    next(error);
  }
};

export const childAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location_id } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    var finalList = [];
    const lOne = location_id.levelOneLocations;
    const lTwo = location_id.levelTwoLocations;

    const childIds = await getAllChildLocationsRecursive(lTwo);
    finalList = [...childIds, ...lOne, ...lTwo]
    const data: any = await getData(Asset, { filter: { locationId: { $in: finalList }, account_id: account_id, visible: true }, select: 'id top_level asset_name asset_type' });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: { assetList: data, locationList: finalList } });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

const getAllChildLocationsRecursive = async (parentIds: any) => {
  try {
    let childIds: any = [];
    for (let i = 0; i < parentIds.length; i++) {
      const parent: any = await LocationMaster.findById(parentIds[i]);
      const children = await LocationMaster.find({
        where: {
          parent_id: parent.id,
          visible: true,
        }
      });
      if (children.length > 0) {
        const childrenIds = children.map(child => child.id);
        childIds = [...childIds, ...childrenIds];
        const grandChildrenIds = await getAllChildLocationsRecursive(childrenIds);
        childIds = [...childIds, ...grandChildrenIds];
      }
    }
    return childIds;
  } catch (error) {
    return [];
  }
}

export const insertLocation = async (body: any) => {
  const newLocation = new LocationMaster(body);
  newLocation.top_level_location_id = body.top_level_location_id || newLocation._id as mongoose.Types.ObjectId;
  body.parent_id = body.top_level_location_id || newLocation._id as mongoose.Types.ObjectId;
  return await newLocation.save();
};

export const updateById = async (id: string, body: any) => {
  await MapUserAssetLocation.deleteMany({ locationId: id });
  await LocationMaster.updateOne({ _id: id }, body, { new: true });
  return await LocationMaster.findById(id);
};

export const removeById = async (id: string, data: any) => {
  const promiseList: any = [];
  const totalIds = [id];
  if(data.top_level) {
    const childIds = await getAllChildLocationsRecursive([id]);
    totalIds.push(...childIds);
    promiseList.push(LocationMaster.updateMany({ _id: { $in: childIds } }, { visible: false }));
  }
  promiseList.push(Asset.updateMany({ locationId: { $in: totalIds } }, { visible: false }));
  promiseList.push(LocationMaster.updateMany({ _id: { $in: totalIds } }, { visible: false }));
  await Promise.all(promiseList);
  return true;
};

export const updateFloorMapImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { selected_location_id, top_level_location_image } = req.body;
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    if(userRole !== 'admin') {
      throw Object.assign(new Error('Unauthorized access'), { status: 401 });
    }
    const updateResult = await LocationMaster.updateOne({ _id: selected_location_id, account_id }, { $set: { top_level_location_image, updatedBy: user_id }});
    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ status: false, message: "Location not found" });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully"});
  } catch (error) {
    console.error(error);
    next(error);
  }
};
