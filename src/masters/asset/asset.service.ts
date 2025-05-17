import { Asset, getAllAssets, IAsset } from "../../models/asset.model";
import { NextFunction, Request, Response } from 'express';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const data: IAsset[] | null = await getAllAssets(account_id); 
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getDataById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getAssetsFilteredData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations = [], assets = [], top_level } = req.body;
    const { account_id, _id: user_id } = req.user;
    if (!account_id) {
      throw Object.assign(new Error('Missing accountId'), { status: 403 });
    }
    const query: any = {
      account_id: account_id,
      visible: true
    };
    if(top_level) {
      query.top_level = top_level;
    }
    if (locations && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    if(assets && assets.length > 0) {
      query._id = { $in: assets };
    }
    const data = await Asset.find(query);
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const getAssetsTreeData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locations } = req.body;
    const { account_id, _id: user_id } = req.user;
    if (!account_id) {
      throw Object.assign(new Error('Missing accountId'), { status: 403 });
    }
    const query: any = {
      account_id: account_id,
      visible: true,
      parent_id: { $in: [null, undefined] }
    };

    if (locations && Array.isArray(locations) && locations.length > 0) {
      query.locationId = { $in: locations };
    }
    const rootAssets = await Asset.find(query);
    const data = await Promise.all(rootAssets.map(async (asset) => {
      return {
        ...asset.toObject(),
        children: await getRecursiveAssets(asset)
      };
    }));
    if (!data || data.length === 0) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    return res.status(200).json({ status: true, message: "Data fetched successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

async function getRecursiveAssets(asset: any) {
  const children = await Asset.find({
    parent_id: asset._id,
    visible: true
  });

  const withChildren: any = await Promise.all(children.map(async (child: any) => {
    return {
      ...child.toObject(),
      children: await getRecursiveAssets(child)
    };
  }));

  return withChildren;
}

export const insert = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { account_id, _id: user_id } = req.user;
    const body = req.body;
    const newAsset = new Asset({
      ...body,
      account_id,
      user_id
    });
    const data = await newAsset.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const createAssetsWithImage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log(req.files);
    const newAsset = new Asset(req.body);
    const data = await newAsset.save();
    return res.status(201).json({ status: true, message: "Data created successfully", data });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

export const updateById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const data = await Asset.findByIdAndUpdate(id, req.body, { new: true });
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
    const { id } = req.params;
    const data = await Asset.findById(id);
    if (!data || !data.visible) {
      throw Object.assign(new Error('No data found'), { status: 404 });
    }
    await Asset.findByIdAndUpdate(id, { visible: false }, { new: true });
    return res.status(200).json({ status: true, message: "Data deleted successfully" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};