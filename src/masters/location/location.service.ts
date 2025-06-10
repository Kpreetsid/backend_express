import { LocationMaster, ILocationMaster } from "../../models/location.model";
import { Request, Response, NextFunction } from 'express';
import { IMapUserLocation, MapUserAssetLocation } from "../../models/mapUserLocation.model";
import { getData } from "../../util/queryBuilder";
import { hasPermission } from "../../_config/permission";
const moduleName: string = "location";

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const match: any = { visible: true, account_id: account_id };
    if(!hasPermission('admin')) {
      match.userId = user_id;
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

export const getTree = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const match: any = { visible: true, account_id: account_id };
    const mapLocationData: IMapUserLocation[] = await MapUserAssetLocation.find({ userId: user_id });
    if (mapLocationData?.length > 0) {
      const locationIds = mapLocationData.map(doc => doc.locationId).filter(id => id);
      match._id = { $in: locationIds };
    }

    const data: ILocationMaster[] = await LocationMaster.find(match).sort({ _id: 1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const locations = data.map(doc => doc.toObject());
    const idMap: { [key: string]: any } = {};
    locations.forEach(loc => {
      idMap[loc._id.toString()] = { ...loc, childs: [] };
    });

    const rootNodes: any[] = [];
    locations.forEach(loc => {
      const parentId = loc.parent_id?.toString();
      if (parentId && idMap[parentId]) {
        idMap[parentId].childs.push(idMap[loc._id.toString()]);
      } else {
        rootNodes.push(idMap[loc._id.toString()]);
      }
    });
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: rootNodes });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const kpiFilterLocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = (req as any).user;
    const match: any = { visible: true, account_id: account_id };
    const mapLocationData: IMapUserLocation[] = await MapUserAssetLocation.find({ userId: user_id });
    if (mapLocationData?.length > 0) {
      const locationIds = mapLocationData.map(doc => doc.locationId).filter(id => id);
      match._id = { $in: locationIds };
    }

    const data: ILocationMaster[] = await LocationMaster.find(match).sort({ _id: 1 });
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }

    const locations = data.map(doc => doc.toObject());
    const idMap: { [key: string]: any } = {};
    locations.forEach(loc => {
      idMap[loc._id.toString()] = { ...loc, children: [] };
    });

    const rootNodes: any[] = [];
    locations.forEach(loc => {
      const parentId = loc.parent_id?.toString();
      if (parentId && idMap[parentId]) {
        idMap[parentId].children.push(idMap[loc._id.toString()]);
      } else {
        rootNodes.push(idMap[loc._id.toString()]);
      }
    });
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
        if (node.children?.length > 0) {
          traverse(node.children, level + 1);
        }
      }
    };
    traverse(rootNodes, 1);
    return res.status(200).json({ status: true, message: "Data Found", data: { levelOneLocations, levelTwoLocations, levelThreeLocations }});
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { account_id, _id: user_id } = (req as any).user;
    const mapData = await MapUserAssetLocation.find({userId: user_id , locationId: id}).populate('userId');
    if(!mapData || mapData.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const data: ILocationMaster | null = await LocationMaster.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataByFilter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const params: any = req.query;
    const match: any = { account_id: account_id, visible: true };
    if(params?._id && params?._id.toString().split(',').length > 0) {
      match.locationId = { $in: params._id.toString().split(',') };
    }
    console.log(params.assetId);
    if(params?.assetID && params?.assetID.toString().split(',').length > 0) {
      match.equipment_id = { $in: params.assetID.toString().split(',') };
    }
    const data: IMapUserLocation[] = await MapUserAssetLocation.find(match).populate('userId');
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
}

export const childAssetsAgainstLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { location_id } = req.body;
    const { account_id, _id: user_id } = (req as any).user;
    const dataOne = await LocationMaster.find({ account_id: account_id, _id: { $in: location_id.levelOneLocations } });
    const childDataOne = await LocationMaster.find({ account_id: account_id, parent_id: { $in: location_id.levelOneLocations } });
    const dataTwo = await LocationMaster.find({ account_id: account_id, _id: { $in: location_id.levelTwoLocations } });
    const childDataTwo = await LocationMaster.find({ account_id: account_id, parent_id: { $in: location_id.levelTwoLocations } });
    const data = [...dataOne, ...childDataOne, ...dataTwo, ...childDataTwo];
    if(!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    const locationList = data.map((doc: any) => doc._id.toString());
    return res.status(200).json({ status: true, message: "Data fetched successfully", data: { locationList } });
  } catch (error) {
    console.error(error);
    next(error);
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