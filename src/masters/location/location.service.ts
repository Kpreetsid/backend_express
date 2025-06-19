import { LocationMaster, ILocationMaster } from "../../models/location.model";
import { Request, Response, NextFunction } from 'express';
import { IMapUserLocation, MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { getData } from "../../util/queryBuilder";
const moduleName: string = "location";
import { get } from "lodash";
import { IUser, User } from "../../models/user.model";
import { Asset } from "../../models/asset.model";
import mongoose from "mongoose";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const match: any = { visible: true, account_id: account_id };
    if(userRole !== 'admin') {
      match.userId = user_id;
    }
    const query: any = req.query;
    if (query?.parent_id) {
      match.parent_id = query.parent_id;
    }
    if (query?._id) {
      match.parent_id = query._id;
    }
    const data: ILocationMaster[] | null = await getData(LocationMaster, { filter: match });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

const buildTree = async (parentId: string | null, account_id: any): Promise<any[]> => {
  const match: any = { account_id, visible: true };
  if (parentId) {
    match.parent_id = parentId;
  } else {
    match.parent_id = { $exists: false };
  }
  const nodes = await getData(LocationMaster, { filter: match });
  const tree = await Promise.all(
    nodes.map(async (node: any) => {
      const children = await buildTree(node._id.toString(), account_id);
      return { ...node, childs: children };
    })
  );
  return tree;
};

export const getTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id, user_role: userRole } = get(req, "user", {}) as IUser;
    const { location_id, location_floor_map_tree } = req.query;

    const match: any = { visible: true, account_id };
    let rootId: string | null = null;

    if (location_floor_map_tree) {
      if (location_id) {
        match._id = location_id;
        rootId = location_id.toString();
      }
      match.top_level = true;
    } else {
      if (location_id) {
        match.parent_id = location_id;
        rootId = location_id.toString();
      } else {
        match.parent_id = { $exists: false };
      }
    }

    if (userRole !== 'admin') {
      const mapData = await MapUserAssetLocation.find({userId: user_id});
      if(!mapData || mapData.length === 0) {
        throw Object.assign(new Error('No data found'), { status: 404 });
      }
      match._id = { $in: mapData.map(doc => doc.locationId) };
    }

    const rootLocations = await getData(LocationMaster, { filter: match });

    if (!rootLocations || rootLocations.length === 0) {
      throw Object.assign(new Error("No data found"), { status: 404 });
    }

    let treeData: any[];

    if (location_id) {
      treeData = await buildTree(rootId, account_id);
    } else {
      treeData = await Promise.all(
        rootLocations.map(async (node: any) => {
          const children = await buildTree(node._id.toString(), account_id);
          return { ...node, childs: children };
        })
      );
    }

    return res.status(200).json({ status: true, message: "Data fetched successfully", data: treeData });
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

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
    const mapData = await getData(MapUserAssetLocation, { filter: { userId: user_id, locationId: id }, populate: 'userId' });
    if(!mapData || mapData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data: ILocationMaster[] = await getData(LocationMaster, { filter: { _id: id, account_id: account_id } });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const childAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location_id } = req.body;
    const { account_id, _id: user_id } = get(req, "user", {}) as IUser;
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

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].add_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const newLocation = new LocationMaster(req.body);
    const data: ILocationMaster = await newLocation.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].edit_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { id } = req.params;
    const data: ILocationMaster | null = await LocationMaster.findByIdAndUpdate(id, req.body, { new: true });
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data updated successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const removeById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = (req as any).role;
    if (!role[moduleName].delete_location) {
      throw Object.assign(new Error('Unauthorized access'), { status: 403 });
    }
    const { id } = req.params;
    const data = await LocationMaster.findById(id);
    if (!data || !data.visible) {
        throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await LocationMaster.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};